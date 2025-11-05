const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { logs } = require('@opentelemetry/api-logs');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

function configureOpenTelemetry() {
    // Get configuration from environment or use defaults
    const serviceName = process.env.OTEL_SERVICE_NAME || 'nodejs-express-manual';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';

    const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
                           process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
                           'http://localhost:4338';
    const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
                            'http://localhost:4318';
    const logsEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
                         'http://localhost:4328';

    // Create resource with service information
    const resource = Resource.default().merge(
        new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
            [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        }),
    );

    // Configure exporters
    const traceExporter = new OTLPTraceExporter({
        url: tracesEndpoint,
    });

    const metricExporter = new OTLPMetricExporter({
        url: metricsEndpoint,
    });

    const logExporter = new OTLPLogExporter({
        url: logsEndpoint,
    });

    // Configure metrics reader
    const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export every 60 seconds
    });

    // Configure logs
    const loggerProvider = new LoggerProvider({ resource });
    loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
    logs.setGlobalLoggerProvider(loggerProvider);

    // Manual instrumentation: explicitly configure each instrumentation
    const sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        loggerProvider,
        instrumentations: [
            // HTTP instrumentation for incoming/outgoing HTTP requests
            new HttpInstrumentation({
                requestHook: (span, request) => {
                    // Add custom attributes to HTTP spans
                    span.setAttribute('custom.http.instrumentation', 'manual');
                },
            }),
            // Express instrumentation for Express framework
            new ExpressInstrumentation({
                requestHook: (span, request) => {
                    // Add custom attributes to Express spans
                    span.setAttribute('custom.express.instrumentation', 'manual');
                },
            }),
        ],
    });

    // Initialize SDK
    sdk.start();

    console.log('=== OpenTelemetry Manual Instrumentation Configured ===');
    console.log(`Service Name: ${serviceName}`);
    console.log(`Service Version: ${serviceVersion}`);
    console.log(`Traces Endpoint: ${tracesEndpoint}`);
    console.log(`Metrics Endpoint: ${metricsEndpoint}`);
    console.log(`Logs Endpoint: ${logsEndpoint}`);
    console.log('=======================================================');

    // Graceful shutdown
    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => console.log('OpenTelemetry SDK shut down'))
            .catch((error) => console.error('Error shutting down SDK', error))
            .finally(() => process.exit(0));
    });

    return sdk;
}

module.exports = { configureOpenTelemetry };
