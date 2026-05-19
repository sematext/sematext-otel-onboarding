/*
 * OpenTelemetry initialization for the Express backend.
 *
 * Loaded via `node --require ./otel.js server.js` so it runs before any
 * application code — that's required for auto-instrumentation to patch
 * the http/express modules at import time.
 *
 * Ships traces to the Sematext managed OTLP endpoint using the
 * Sematext-specific X-API-TOKEN header.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require('@opentelemetry/semantic-conventions');

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  || 'https://otlp-receiver.eu.sematext.com';
const token = process.env.SEMATEXT_TRACING_TOKEN;
const serviceName = process.env.OTEL_SERVICE_NAME || 'e2e-backend';

if (!token) {
  console.error('[otel] SEMATEXT_TRACING_TOKEN is not set — traces will be exported but rejected by Sematext. Set it in .env');
}

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers: {
      'X-API-TOKEN': token,
    },
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // The fs instrumentation is very noisy and not interesting for this demo.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      // Don't trace the OTLP proxy endpoint itself — otherwise every span
      // the browser sends turns into another trace of the POST that
      // forwarded it, polluting the data and risking a feedback loop.
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) =>
          (req.url || '').startsWith('/api/otel-proxy'),
      },
    }),
  ],
});

sdk.start();
console.log(`[otel] backend tracing initialized — service=${serviceName} endpoint=${endpoint}`);

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('[otel] backend tracing shut down'))
    .finally(() => process.exit(0));
});
