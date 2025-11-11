package com.sematext.examples.controller;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.LongUpDownCounter;
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanKind;
import io.opentelemetry.api.trace.StatusCode;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.Scope;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class DemoController {

    private final Tracer tracer;
    private final Meter meter;
    private final Logger otelLogger;

    // Custom metrics
    private final LongCounter requestCounter;
    private final DoubleHistogram requestDuration;
    private final LongUpDownCounter activeRequests;

    public DemoController(Tracer tracer, Meter meter, io.opentelemetry.api.OpenTelemetry openTelemetry) {
        this.tracer = tracer;
        this.meter = meter;
        this.otelLogger = openTelemetry
            .getLogsBridge()
            .get("java-spring-boot-manual");

        // Initialize custom metrics
        this.requestCounter = meter.counterBuilder("http.server.requests")
            .setDescription("Total number of HTTP requests")
            .setUnit("1")
            .build();

        this.requestDuration = meter.histogramBuilder("http.server.duration")
            .setDescription("HTTP request duration")
            .setUnit("ms")
            .build();

        this.activeRequests = meter.upDownCounterBuilder("http.server.active_requests")
            .setDescription("Number of active HTTP requests")
            .setUnit("1")
            .build();
    }

    @GetMapping("/")
    public Map<String, String> root() {
        long startTime = System.currentTimeMillis();

        // Increment active requests
        activeRequests.add(1, Attributes.of(
            AttributeKey.stringKey("endpoint"), "/",
            AttributeKey.stringKey("method"), "GET"
        ));

        // Create manual span
        Span span = tracer.spanBuilder("handle-root-request")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("endpoint", "/")
            .setAttribute("method", "GET")
            .setAttribute("instrumentation.type", "manual")
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            // Emit custom log with trace correlation
            emitLog(Severity.INFO, "Root endpoint called", Attributes.empty());

            Map<String, String> response = new HashMap<>();
            response.put("instrumentation", "manual");
            response.put("message", "Hello from Spring Boot with Manual OpenTelemetry!");

            // Record metrics
            long duration = System.currentTimeMillis() - startTime;
            requestCounter.add(1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/",
                AttributeKey.stringKey("method"), "GET",
                AttributeKey.stringKey("status"), "200"
            ));
            requestDuration.record(duration, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/"
            ));

            return response;
        } finally {
            activeRequests.add(-1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/",
                AttributeKey.stringKey("method"), "GET"
            ));
            span.end();
        }
    }

    @GetMapping("/users/{id}")
    public Map<String, Object> getUser(@PathVariable String id) throws InterruptedException {
        long startTime = System.currentTimeMillis();

        activeRequests.add(1, Attributes.of(
            AttributeKey.stringKey("endpoint"), "/users/{id}",
            AttributeKey.stringKey("method"), "GET"
        ));

        Span span = tracer.spanBuilder("handle-get-user")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("endpoint", "/users/{id}")
            .setAttribute("method", "GET")
            .setAttribute("user.id", id)
            .setAttribute("instrumentation.type", "manual")
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            emitLog(Severity.INFO, "Fetching user with id: " + id, Attributes.of(
                AttributeKey.stringKey("user.id"), id
            ));

            // Create a child span for processing
            Span childSpan = tracer.spanBuilder("process-user-data")
                .setSpanKind(SpanKind.INTERNAL)
                .setAttribute("user.id", id)
                .startSpan();

            try (Scope childScope = childSpan.makeCurrent()) {
                // Simulate processing delay
                Thread.sleep(100);
                childSpan.setAttribute("processing.complete", true);
            } finally {
                childSpan.end();
            }

            Map<String, Object> response = new HashMap<>();
            response.put("id", id);
            response.put("name", "User " + id);
            response.put("email", "user" + id + "@example.com");

            emitLog(Severity.INFO, "User fetched successfully: " + id, Attributes.of(
                AttributeKey.stringKey("user.id"), id
            ));

            // Record metrics
            long duration = System.currentTimeMillis() - startTime;
            requestCounter.add(1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/users/{id}",
                AttributeKey.stringKey("method"), "GET",
                AttributeKey.stringKey("status"), "200"
            ));
            requestDuration.record(duration, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/users/{id}"
            ));

            return response;
        } finally {
            activeRequests.add(-1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/users/{id}",
                AttributeKey.stringKey("method"), "GET"
            ));
            span.end();
        }
    }

    @GetMapping("/slow")
    public Map<String, String> slow() throws InterruptedException {
        long startTime = System.currentTimeMillis();

        activeRequests.add(1, Attributes.of(
            AttributeKey.stringKey("endpoint"), "/slow",
            AttributeKey.stringKey("method"), "GET"
        ));

        Span span = tracer.spanBuilder("handle-slow-request")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("endpoint", "/slow")
            .setAttribute("method", "GET")
            .setAttribute("instrumentation.type", "manual")
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            emitLog(Severity.INFO, "Slow endpoint called", Attributes.empty());

            // Simulate slow operation
            Thread.sleep(2000);

            Map<String, String> response = new HashMap<>();
            response.put("message", "Slow operation completed");

            // Record metrics
            long duration = System.currentTimeMillis() - startTime;
            requestCounter.add(1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/slow",
                AttributeKey.stringKey("method"), "GET",
                AttributeKey.stringKey("status"), "200"
            ));
            requestDuration.record(duration, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/slow"
            ));

            return response;
        } finally {
            activeRequests.add(-1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/slow",
                AttributeKey.stringKey("method"), "GET"
            ));
            span.end();
        }
    }

    @GetMapping("/error")
    public ResponseEntity<Map<String, String>> error() {
        long startTime = System.currentTimeMillis();

        activeRequests.add(1, Attributes.of(
            AttributeKey.stringKey("endpoint"), "/error",
            AttributeKey.stringKey("method"), "GET"
        ));

        Span span = tracer.spanBuilder("handle-error-request")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("endpoint", "/error")
            .setAttribute("method", "GET")
            .setAttribute("instrumentation.type", "manual")
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            emitLog(Severity.ERROR, "Error endpoint called - simulating error", Attributes.empty());

            // Record error in span
            span.setStatus(StatusCode.ERROR, "Simulated error");
            span.recordException(new RuntimeException("Simulated error"));

            Map<String, String> response = new HashMap<>();
            response.put("error", "Internal Server Error");
            response.put("message", "This is a simulated error");

            // Record metrics
            long duration = System.currentTimeMillis() - startTime;
            requestCounter.add(1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/error",
                AttributeKey.stringKey("method"), "GET",
                AttributeKey.stringKey("status"), "500"
            ));
            requestDuration.record(duration, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/error"
            ));

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        } finally {
            activeRequests.add(-1, Attributes.of(
                AttributeKey.stringKey("endpoint"), "/error",
                AttributeKey.stringKey("method"), "GET"
            ));
            span.end();
        }
    }

    /**
     * Helper method to emit structured logs with trace correlation
     */
    private void emitLog(Severity severity, String message, Attributes attributes) {
        Span currentSpan = Span.current();
        var logAttributesBuilder = Attributes.builder();

        // Copy provided attributes
        attributes.forEach((key, value) -> logAttributesBuilder.put((AttributeKey<Object>) key, value));

        // Add trace correlation
        if (currentSpan != null && currentSpan.getSpanContext().isValid()) {
            logAttributesBuilder.put("trace_id", currentSpan.getSpanContext().getTraceId());
            logAttributesBuilder.put("span_id", currentSpan.getSpanContext().getSpanId());
            logAttributesBuilder.put("trace_flags", String.format("%02x", currentSpan.getSpanContext().getTraceFlags().asByte()));
        }

        otelLogger.logRecordBuilder()
            .setSeverity(severity)
            .setBody(message)
            .setTimestamp(java.time.Instant.ofEpochMilli(System.currentTimeMillis()))
            .setAllAttributes(logAttributesBuilder.build())
            .emit();

        // Also log to console for visibility
        System.out.printf("[%s] %s%n", severity.name(), message);
    }
}
