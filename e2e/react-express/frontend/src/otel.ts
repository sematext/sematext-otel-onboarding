/*
 * OpenTelemetry initialization for the React frontend.
 *
 * Loaded at the top of main.tsx — must run before any code that we want
 * to be traced. Ships spans to /api/otel-proxy/v1/traces, which the
 * Express backend forwards to Sematext's managed OTLP endpoint.
 * Same-origin POST avoids the CORS issue you would hit if the browser
 * tried to ship directly to otlp-receiver.eu.sematext.com.
 */

// zone.js must be imported before ZoneContextManager so it can patch async APIs.
import 'zone.js';

import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';

const provider = new WebTracerProvider({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'e2e-frontend',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        // Same-origin URL — Vite proxies /api/* to the Express backend in dev.
        // The browser OTLP exporter requires an absolute URL, so we build one
        // from the current page origin. The backend forwards to Sematext's
        // OTLP endpoint with the X-API-TOKEN header attached.
        url: `${window.location.origin}/api/otel-proxy/v1/traces`,
      })
    ),
  ],
});

provider.register({
  contextManager: new ZoneContextManager(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Without this, the fetch instrumentation will NOT add the
      // W3C `traceparent` header to outgoing requests. The list is matched
      // against the request URL; '/api' covers same-origin calls to our
      // backend, which is what we want.
      propagateTraceHeaderCorsUrls: [/.*/],
      clearTimingResources: true,
    }),
  ],
});

console.log('[otel] frontend tracing initialized');
