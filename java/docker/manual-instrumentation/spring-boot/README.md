# Java Spring Boot - Manual Instrumentation (Docker)

This example demonstrates manual OpenTelemetry instrumentation for a Java Spring Boot application running in Docker containers.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Update Configuration in docker-compose.yaml

Edit `docker-compose.yaml` and update:

**Region** - Set based on your Sematext Cloud region:
```yaml
- REGION=EU  # US for Sematext Cloud US, EU for Sematext Cloud EU
```

**Infrastructure Token** - Replace with your Sematext Infrastructure token:
```yaml
- INFRA_TOKEN=your-infra-token
```

**App Tokens** - Replace with your actual Sematext App tokens:
```yaml
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_MY_TOKEN_GROUP_SERVICES="all-services"
```

Get your tokens from each App in Sematext Cloud.

### 2. Start the Stack

```bash
docker-compose up -d
```

### 3. Generate Test Traffic

```bash
curl http://localhost:8080/
curl http://localhost:8080/users/123
curl http://localhost:8080/slow
curl http://localhost:8080/error
```

### 4. View in Sematext Cloud

Check your Sematext Tracing, Monitoring, and Logs Apps for telemetry data.

## Creating Custom Spans

Manual instrumentation provides full control over span creation:

### Simple Span

```java
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.api.trace.StatusCode;

Span span = tracer.spanBuilder("my-operation").startSpan();
try {
    span.setAttribute("key", "value");
    // Your code here
    span.setStatus(StatusCode.OK);
} finally {
    span.end();
}
```

### Active Span with Context Propagation

```java
import io.opentelemetry.context.Scope;

Span span = tracer.spanBuilder("my-operation").startSpan();
try (Scope scope = span.makeCurrent()) {
    span.setAttribute("key", "value");

    // Child spans automatically inherit context
    someOperation();

    span.setStatus(StatusCode.OK);
} finally {
    span.end();
}
```

### Nested Spans

```java
Span parentSpan = tracer.spanBuilder("get-user-operation").startSpan();
try (Scope parentScope = parentSpan.makeCurrent()) {
    parentSpan.setAttribute("user.id", userId);

    // Database lookup span
    Span dbSpan = tracer.spanBuilder("database.lookup").startSpan();
    try (Scope dbScope = dbSpan.makeCurrent()) {
        dbSpan.setAttribute("db.system", "postgresql");
        dbSpan.setAttribute("db.operation", "SELECT");
        dbSpan.setStatus(StatusCode.OK);
    } finally {
        dbSpan.end();
    }

    // Processing span
    Span processSpan = tracer.spanBuilder("process.user.data").startSpan();
    try (Scope processScope = processSpan.makeCurrent()) {
        processSpan.setAttribute("operation", "transform");
        processSpan.setStatus(StatusCode.OK);
    } finally {
        processSpan.end();
    }

    parentSpan.setStatus(StatusCode.OK);
} finally {
    parentSpan.end();
}
```

### Error Handling

```java
Span span = tracer.spanBuilder("my-operation").startSpan();
try (Scope scope = span.makeCurrent()) {
    // Your code
} catch (Exception e) {
    span.recordException(e);
    span.setStatus(StatusCode.ERROR, e.getMessage());
} finally {
    span.end();
}
```

## Creating Custom Metrics

Manual instrumentation allows creating custom metrics:

```java
import io.opentelemetry.api.metrics.Meter;
import io.opentelemetry.api.metrics.LongCounter;
import io.opentelemetry.api.metrics.DoubleHistogram;
import io.opentelemetry.api.metrics.LongUpDownCounter;
import io.opentelemetry.api.common.Attributes;

// Counter - total requests
LongCounter requestCounter = meter
    .counterBuilder("http.server.requests")
    .setDescription("Total number of HTTP requests")
    .setUnit("1")
    .build();

requestCounter.add(1, Attributes.builder()
    .put("endpoint", "/")
    .put("method", "GET")
    .build());

// Histogram - request duration
DoubleHistogram requestDuration = meter
    .histogramBuilder("http.server.duration")
    .setDescription("HTTP request duration")
    .setUnit("ms")
    .build();

requestDuration.record(duration, Attributes.builder()
    .put("endpoint", "/")
    .put("method", "GET")
    .build());

// UpDownCounter - active requests
LongUpDownCounter activeRequests = meter
    .upDownCounterBuilder("http.server.active_requests")
    .setDescription("Number of active HTTP requests")
    .setUnit("1")
    .build();

activeRequests.add(1);  // increment
activeRequests.add(-1); // decrement
```

## Creating Custom Logs

Manual instrumentation enables structured logs with trace correlation:

```java
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributeKey;

private void emitLog(Severity severity, String message, Attributes attributes) {
    Span currentSpan = Span.current();
    var logAttributesBuilder = Attributes.builder();
    attributes.forEach((key, value) ->
        logAttributesBuilder.put((AttributeKey<Object>) key, value));

    // Add trace correlation
    if (currentSpan != null && currentSpan.getSpanContext().isValid()) {
        logAttributesBuilder.put("trace_id", currentSpan.getSpanContext().getTraceId());
        logAttributesBuilder.put("span_id", currentSpan.getSpanContext().getSpanId());
        logAttributesBuilder.put("trace_flags",
            String.format("%02x", currentSpan.getSpanContext().getTraceFlags().asByte()));
    }

    otelLogger.logRecordBuilder()
        .setSeverity(severity)
        .setBody(message)
        .setTimestamp(java.time.Instant.now())
        .setAllAttributes(logAttributesBuilder.build())
        .emit();
}

// Usage
emitLog(Severity.INFO, "Request processed",
    Attributes.of(AttributeKey.stringKey("user.id"), userId));
emitLog(Severity.ERROR, "Failed to process request",
    Attributes.of(AttributeKey.stringKey("error.type"), "ValidationError"));
```

## Docker Configuration

The `docker-compose.yaml` sets up:

1. **Sematext Agent** (`sematext/agent:latest-4`) - Receives OTLP telemetry and forwards to Sematext Cloud
   - Runs in privileged mode with host volumes mounted for infrastructure monitoring
   - Exposes OTLP receivers on ports 4317-4318 (metrics), 4327-4328 (logs), 4337-4338 (traces)
2. **Java Application** - Spring Boot app with manual instrumentation

The application sends telemetry to the agent via OTLP HTTP endpoints:
- Traces: `http://sematext-agent:4338/v1/traces`
- Metrics: `http://sematext-agent:4318/v1/metrics`
- Logs: `http://sematext-agent:4328/v1/logs`

## Viewing Custom Spans

In Sematext Tracing App, you'll see:

- **Nested span relationships**: Parent → Database → Processing
- **Custom attributes**: `db.system`, `db.operation`, `user.id`, etc.
- **Error details**: Exception type, message, and stack trace
- **Operation types**: Distinguished by custom attributes

## Common Tasks

```bash
# View application logs
docker-compose logs -f java-app

# Restart after code changes
docker-compose up -d --build

# Stop and remove
docker-compose down
```

## Troubleshooting

### Custom Spans Not Appearing

1. **Check spans are ended**:
   Every `startSpan()` must have a corresponding `end()` call

2. **Verify span status**:
   Set span status before ending:
   ```java
   span.setStatus(StatusCode.OK);
   span.end();
   ```

3. **Check OpenTelemetry initialization**:
   Look for "OpenTelemetry initialized successfully" in logs

### Spans Not Nested Properly

Use `makeCurrent()` for automatic context propagation:

```java
// ✅ Correct: Uses makeCurrent()
Span parentSpan = tracer.spanBuilder("parent").startSpan();
try (Scope parentScope = parentSpan.makeCurrent()) {
    Span childSpan = tracer.spanBuilder("child").startSpan();
    try (Scope childScope = childSpan.makeCurrent()) {
        // Automatically nested
    } finally {
        childSpan.end();
    }
} finally {
    parentSpan.end();
}
```

### Logs Not Appearing

1. **Check OTLP endpoint**:
   Verify `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` points to `http://sematext-agent:4328/v1/logs`

2. **Verify log processor**:
   Ensure `BatchLogRecordProcessor` is configured correctly

3. **Check token configuration**:
   Verify logs token is set in docker-compose.yaml

## Production Considerations

- **Use Docker secrets** for tokens instead of environment variables
- **Add resource limits** to prevent memory/CPU issues
- **Implement health checks** for both services
- **Use multi-stage builds** to minimize image size
- **Configure logging rotation** for container logs

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes manual example](../../kubernetes/manual-instrumentation/spring-boot/)
- **Compare with Auto**: See [Auto-Instrumentation Docker example](../auto-instrumentation/spring-boot/)
- **Add custom metrics**: Extend with manual metric creation

## Resources

- [OpenTelemetry Java Manual Instrumentation](https://opentelemetry.io/docs/languages/java/instrumentation/)
- [OpenTelemetry Java SDK](https://github.com/open-telemetry/opentelemetry-java)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
