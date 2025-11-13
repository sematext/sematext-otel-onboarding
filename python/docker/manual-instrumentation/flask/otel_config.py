import os
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry._logs import set_logger_provider
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor

def configure_opentelemetry():
    """Configure OpenTelemetry with manual instrumentation for Flask"""

    # Get configuration from environment or use defaults
    service_name = os.getenv('OTEL_SERVICE_NAME', 'python-flask-docker-manual')
    service_version = os.getenv('OTEL_SERVICE_VERSION', '1.0.0')

    traces_endpoint = os.getenv(
        'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
        os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://sematext-agent:4338')
    )
    metrics_endpoint = os.getenv(
        'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
        'http://sematext-agent:4318'
    )
    logs_endpoint = os.getenv(
        'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
        'http://sematext-agent:4328'
    )

    # Create resource with service information
    resource = Resource.create({
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
    })

    # Configure Tracing
    trace_provider = TracerProvider(resource=resource)
    trace_exporter = OTLPSpanExporter(endpoint=traces_endpoint)
    trace_provider.add_span_processor(BatchSpanProcessor(trace_exporter))
    trace.set_tracer_provider(trace_provider)

    # Configure Metrics
    metric_exporter = OTLPMetricExporter(endpoint=metrics_endpoint)
    metric_reader = PeriodicExportingMetricReader(
        exporter=metric_exporter,
        export_interval_millis=60000  # Export every 60 seconds
    )
    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[metric_reader]
    )
    metrics.set_meter_provider(meter_provider)

    # Configure Logging
    logger_provider = LoggerProvider(resource=resource)
    log_exporter = OTLPLogExporter(endpoint=logs_endpoint)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    set_logger_provider(logger_provider)

    # Attach OTLP handler to root logger
    handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)

    # Manual instrumentation: explicitly configure Flask instrumentation
    # This will be applied when Flask app is created
    FlaskInstrumentor().instrument()

    # Also instrument outgoing HTTP requests if needed
    RequestsInstrumentor().instrument()

    print('=== OpenTelemetry Manual Instrumentation Configured ===')
    print(f'Service Name: {service_name}')
    print(f'Service Version: {service_version}')
    print(f'Traces Endpoint: {traces_endpoint}')
    print(f'Metrics Endpoint: {metrics_endpoint}')
    print(f'Logs Endpoint: {logs_endpoint}')
    print('=======================================================')

    return {
        'trace_provider': trace_provider,
        'meter_provider': meter_provider,
        'logger_provider': logger_provider
    }
