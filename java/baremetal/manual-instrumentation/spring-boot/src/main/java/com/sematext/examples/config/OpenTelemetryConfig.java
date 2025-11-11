package com.sematext.examples.config;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.exporter.otlp.http.metrics.OtlpHttpMetricExporter;
import io.opentelemetry.exporter.otlp.http.trace.OtlpHttpSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.metrics.SdkMeterProvider;
import io.opentelemetry.sdk.metrics.export.PeriodicMetricReader;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.sdk.trace.export.BatchSpanProcessor;
import io.opentelemetry.semconv.ResourceAttributes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PreDestroy;
import java.time.Duration;

@Configuration
public class OpenTelemetryConfig {

    private static final Logger logger = LoggerFactory.getLogger(OpenTelemetryConfig.class);

    @Value("${OTEL_SERVICE_NAME:java-spring-baremetal-manual}")
    private String serviceName;

    @Value("${OTEL_SERVICE_VERSION:1.0.0}")
    private String serviceVersion;

    @Value("${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:http://localhost:4338/v1/traces}")
    private String tracesEndpoint;

    @Value("${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:http://localhost:4318/v1/metrics}")
    private String metricsEndpoint;

    @Value("${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:http://localhost:4328/v1/logs}")
    private String logsEndpoint;

    private SdkTracerProvider sdkTracerProvider;
    private SdkMeterProvider sdkMeterProvider;
    private SdkLoggerProvider sdkLoggerProvider;

    @Bean
    public OpenTelemetry openTelemetry() {
        // Create resource with service information
        Resource resource = Resource.getDefault().merge(
            Resource.create(Attributes.builder()
                .put(ResourceAttributes.SERVICE_NAME, serviceName)
                .put(ResourceAttributes.SERVICE_VERSION, serviceVersion)
                .build())
        );

        // Configure trace exporter
        OtlpHttpSpanExporter spanExporter = OtlpHttpSpanExporter.builder()
            .setEndpoint(tracesEndpoint)
            .build();

        // Configure tracer provider
        sdkTracerProvider = SdkTracerProvider.builder()
            .addSpanProcessor(BatchSpanProcessor.builder(spanExporter).build())
            .setResource(resource)
            .build();

        // Configure metrics exporter
        OtlpHttpMetricExporter metricExporter = OtlpHttpMetricExporter.builder()
            .setEndpoint(metricsEndpoint)
            .build();

        // Configure meter provider with periodic reader
        sdkMeterProvider = SdkMeterProvider.builder()
            .registerMetricReader(
                PeriodicMetricReader.builder(metricExporter)
                    .setInterval(Duration.ofSeconds(60))
                    .build()
            )
            .setResource(resource)
            .build();

        // Configure logs exporter
        OtlpHttpLogRecordExporter logExporter = OtlpHttpLogRecordExporter.builder()
            .setEndpoint(logsEndpoint)
            .build();

        // Configure logger provider
        sdkLoggerProvider = SdkLoggerProvider.builder()
            .addLogRecordProcessor(BatchLogRecordProcessor.builder(logExporter).build())
            .setResource(resource)
            .build();

        // Build OpenTelemetry SDK
        OpenTelemetry openTelemetry = OpenTelemetrySdk.builder()
            .setTracerProvider(sdkTracerProvider)
            .setMeterProvider(sdkMeterProvider)
            .setLoggerProvider(sdkLoggerProvider)
            .build();

        // Set as global OpenTelemetry instance
        GlobalOpenTelemetry.set(openTelemetry);

        logger.info("=== OpenTelemetry Manual Instrumentation Configured ===");
        logger.info("Service Name: {}", serviceName);
        logger.info("Service Version: {}", serviceVersion);
        logger.info("Traces Endpoint: {}", tracesEndpoint);
        logger.info("Metrics Endpoint: {}", metricsEndpoint);
        logger.info("Logs Endpoint: {}", logsEndpoint);
        logger.info("=======================================================");

        return openTelemetry;
    }

    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer(serviceName, serviceVersion);
    }

    @Bean
    public Meter meter(OpenTelemetry openTelemetry) {
        return openTelemetry.getMeter(serviceName);
    }

    @PreDestroy
    public void shutdown() {
        logger.info("Shutting down OpenTelemetry SDK...");
        if (sdkTracerProvider != null) {
            sdkTracerProvider.close();
        }
        if (sdkMeterProvider != null) {
            sdkMeterProvider.close();
        }
        if (sdkLoggerProvider != null) {
            sdkLoggerProvider.close();
        }
    }
}
