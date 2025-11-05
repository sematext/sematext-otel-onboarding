const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');

function configureOpenTelemetry() {
    // Get configuration from environment or use defaults
    const serviceName = process.env.OTEL_SERVICE_NAME || 'nodejs-express-auto';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';

    const tracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
                           process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
                           'http://localhost:4338';
    const metricsEndpoint = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
                            'http://localhost:4318';

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

    // Configure metrics reader
    const metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 60000, // Export every 60 seconds
    });

    // Create and configure SDK with auto-instrumentations
    const sdk = new NodeSDK({
        resource,
        traceExporter,
        metricReader,
        instrumentations: [
            getNodeAutoInstrumentations({
                // HTTP and Express auto-instrumentation
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                },
                '@opentelemetry/instrumentation-express': {
                    enabled: true,
                },

                // Uncomment to enable additional instrumentations:

                // Database
                // '@opentelemetry/instrumentation-mongodb': { enabled: true },
                // '@opentelemetry/instrumentation-mysql': { enabled: true },
                // '@opentelemetry/instrumentation-mysql2': { enabled: true },
                // '@opentelemetry/instrumentation-pg': { enabled: true },

                // Messaging
                // '@opentelemetry/instrumentation-kafka-js': { enabled: true },
                // '@opentelemetry/instrumentation-amqplib': { enabled: true },

                // Caching & External Services
                // '@opentelemetry/instrumentation-redis': { enabled: true },
                // '@opentelemetry/instrumentation-redis-4': { enabled: true },
            }),
        ],
    });

    // Initialize SDK
    sdk.start();

    console.log('=== OpenTelemetry Auto-Instrumentation Configured ===');
    console.log(`Service Name: ${serviceName}`);
    console.log(`Service Version: ${serviceVersion}`);
    console.log(`Traces Endpoint: ${tracesEndpoint}`);
    console.log(`Metrics Endpoint: ${metricsEndpoint}`);
    console.log('Note: Logs are not supported in auto-instrumentation');
    console.log('      Use manual instrumentation for logs support');
    console.log('=====================================================');

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
