# Java Spring Boot - Manual Instrumentation (Baremetal)

This example demonstrates manual OpenTelemetry instrumentation for a Java Spring Boot application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Java 21+ installed
- Maven 3.6+ installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Install Dependencies

```bash
mvn clean package
```

This will compile your application and create an executable JAR file in the `target/` directory.

### 2. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 3. Configure Sematext Agent

**Enable OpenTelemetry with traces, metrics, and logs:**

```bash
# Enable all signals individually
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type traces
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type metrics
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type logs
```

**Configure token group with your Sematext App tokens:**

```bash
# Add traces token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add logs token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type logs \
  --token "YOUR_LOGS_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --all-services \
  --token-group "my-otel-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 4. Configure Environment Variables

Set environment variables for OpenTelemetry:

```bash
export OTEL_SERVICE_NAME=java-spring-baremetal-manual
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338/v1/traces
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4328/v1/logs
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Explicit endpoints are required for manual instrumentation to send all three signal types (traces, metrics, logs) correctly.

### 5. Run the Application

Run the application:

```bash
java -jar target/app.jar
```

The application will start on port 8080. You should see OpenTelemetry configuration logs in the console.

### 6. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8080/

# User endpoint with nested spans
curl http://localhost:8080/users/123

# Slow endpoint with multiple spans
curl http://localhost:8080/slow

# Error endpoint with error tracking
curl http://localhost:8080/error
```

### 7. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see custom spans
2. **Metrics**: Open your Sematext Monitoring App to see custom metrics
3. **Logs**: Open your Sematext Logs App to see structured logs with trace correlation

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

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint with custom span and metrics |
| `/users/:id` | GET | Get user with nested spans and custom attributes |
| `/slow` | GET | Slow endpoint - simulates 2s latency |
| `/error` | GET | Error endpoint with error tracking |
| `/actuator/health` | GET | Health check endpoint |
| `/actuator/info` | GET | Application info endpoint |
| `/actuator/metrics` | GET | Metrics endpoint |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `java-spring-baremetal-manual` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338/v1/traces` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318/v1/metrics` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Yes | `http://localhost:4328/v1/logs` | OTLP endpoint for logs |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |

## Viewing Custom Spans

In Sematext Tracing App, you'll see:

- **Nested span relationships**: Parent → Database → Processing
- **Custom attributes**: `db.system`, `db.operation`, `user.id`, etc.
- **Error details**: Exception type, message, and stack trace
- **Operation types**: Distinguished by custom attributes

## Troubleshooting

### No Custom Spans Appearing

1. **Check OpenTelemetry initialization**:
   Look for "OpenTelemetry Manual Instrumentation Configured" in logs

2. **Verify spans are ended**:
   Every `startSpan()` must have a corresponding `end()` call

3. **Check span status**:
   Set span status before ending:
   ```java
   span.setStatus(StatusCode.OK);
   span.end();
   ```

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
   Verify `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` points to `http://localhost:4328/v1/logs`

2. **Verify log processor**:
   Ensure `BatchLogRecordProcessor` is configured correctly

3. **Check token configuration**:
   Verify logs token is set in agent config

### No Data in Sematext

1. **Check agent is running**:
   ```bash
   sudo systemctl status sematext-agent
   ```

2. **Verify service name matches**:
   ```bash
   echo $OTEL_SERVICE_NAME
   cat /opt/spm/properties/otel.yml
   ```

3. **Check OTLP endpoints are accessible**:
   ```bash
   curl http://localhost:4338
   curl http://localhost:4318
   curl http://localhost:4328
   ```

## Advantages of Manual Instrumentation

1. **Full Control**: Explicitly define what gets traced
2. **Custom Spans**: Create spans for business-critical operations
3. **Rich Attributes**: Add domain-specific attributes
4. **Nested Spans**: Model complex operations with parent-child relationships
5. **Selective Instrumentation**: Only instrument what matters
6. **Custom Metrics**: Track application-specific metrics
7. **Structured Logs**: Full control over log attributes and correlation

## When to Use Manual Instrumentation

- **Business Logic Tracing**: Track domain-specific operations
- **Fine-Grained Control**: Need precise control over span lifecycle
- **Custom Attributes**: Add application-specific context
- **Selective Instrumentation**: Only instrument critical paths
- **Complex Workflows**: Model multi-step processes accurately
- **Custom Metrics**: Track business KPIs and application metrics

## Comparison with Auto-Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| Setup Complexity | Low | Medium |
| Code Changes | Minimal | Moderate |
| Control | Limited | Full |
| Custom Spans | Via API calls | Native |
| Custom Metrics | Limited | Full |
| Custom Logs | Automatic | Full control |
| Learning Curve | Easy | Moderate |
| Best For | Quick setup | Custom logic |

## Next Steps

- **Try Auto**: See [Auto-Instrumentation baremetal example](../../auto-instrumentation/spring-boot/)
- **Deploy to Docker**: See [Docker manual example](../../../docker/manual-instrumentation/spring-boot/)
- **Deploy to Kubernetes**: See [Kubernetes manual example](../../../kubernetes/manual-instrumentation/spring-boot/)
- **Add custom metrics**: Extend with manual metric creation
- **Database instrumentation**: Add custom database spans

## Resources

- [OpenTelemetry Java Manual Instrumentation](https://opentelemetry.io/docs/languages/java/instrumentation/)
- [OpenTelemetry Java SDK](https://github.com/open-telemetry/opentelemetry-java)
- [Span API](https://opentelemetry.io/docs/languages/java/api/)
- [Metrics API](https://opentelemetry.io/docs/languages/java/metrics/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
