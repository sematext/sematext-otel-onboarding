<?php

namespace App\OpenTelemetry;

use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Trace\Propagation\TraceContextPropagator;
use OpenTelemetry\Contrib\Otlp\LogsExporter;
use OpenTelemetry\Contrib\Otlp\MetricExporter;
use OpenTelemetry\Contrib\Otlp\SpanExporter;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Common\Export\Http\PsrTransportFactory;
use OpenTelemetry\SDK\Logs\LoggerProvider;
use OpenTelemetry\SDK\Logs\Processor\BatchLogRecordProcessor;
use OpenTelemetry\SDK\Metrics\MeterProvider;
use OpenTelemetry\SDK\Metrics\MetricReader\ExportingReader;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Trace\SpanProcessor\BatchSpanProcessor;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SemConv\ResourceAttributes;

class OtelConfig
{
    private static ?TracerProvider $tracerProvider = null;
    private static ?MeterProvider $meterProvider = null;
    private static ?LoggerProvider $loggerProvider = null;

    public static function configure(): void
    {
        $serviceName = env('OTEL_SERVICE_NAME', 'php-laravel-baremetal-manual');
        $serviceVersion = env('OTEL_SERVICE_VERSION', '1.0.0');

        $tracesEndpoint = env(
            'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
            env('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4338')
        );
        $metricsEndpoint = env(
            'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
            'http://localhost:4318'
        );
        $logsEndpoint = env(
            'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
            'http://localhost:4328'
        );

        // Create resource with service information
        $resource = ResourceInfo::create(Attributes::create([
            ResourceAttributes::SERVICE_NAME => $serviceName,
            ResourceAttributes::SERVICE_VERSION => $serviceVersion,
        ]));

        // Configure Tracing
        $transportFactory = PsrTransportFactory::discover();
        $traceTransport = $transportFactory->create($tracesEndpoint . '/v1/traces', 'application/x-protobuf');
        $traceExporter = new SpanExporter($traceTransport);
        self::$tracerProvider = TracerProvider::builder()
            ->addSpanProcessor(new BatchSpanProcessor($traceExporter))
            ->setResource($resource)
            ->build();

        // Configure Metrics
        $metricTransport = $transportFactory->create($metricsEndpoint . '/v1/metrics', 'application/x-protobuf');
        $metricExporter = new MetricExporter($metricTransport);
        $metricReader = new ExportingReader($metricExporter);
        self::$meterProvider = MeterProvider::builder()
            ->addReader($metricReader)
            ->setResource($resource)
            ->build();

        // Configure Logging
        $logTransport = $transportFactory->create($logsEndpoint . '/v1/logs', 'application/x-protobuf');
        $logExporter = new LogsExporter($logTransport);
        self::$loggerProvider = LoggerProvider::builder()
            ->addLogRecordProcessor(new BatchLogRecordProcessor($logExporter))
            ->setResource($resource)
            ->build();

        // Register providers globally
        Globals::registerInitializer(function () use ($resource) {
            return Globals::configurator()
                ->withTracerProvider(self::$tracerProvider)
                ->withMeterProvider(self::$meterProvider)
                ->withLoggerProvider(self::$loggerProvider)
                ->withPropagator(TraceContextPropagator::getInstance())
                ->create();
        });

        // Ensure providers flush on process shutdown
        register_shutdown_function([self::class, 'shutdown']);

        error_log("OpenTelemetry configured: service={$serviceName}, traces={$tracesEndpoint}");
    }

    public static function shutdown(): void
    {
        self::$tracerProvider?->shutdown();
        self::$meterProvider?->shutdown();
        self::$loggerProvider?->shutdown();
    }
}
