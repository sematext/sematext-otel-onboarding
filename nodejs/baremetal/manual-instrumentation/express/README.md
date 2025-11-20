# Node.js Express - Manual Instrumentation (Baremetal)

This example demonstrates manual OpenTelemetry instrumentation for a Node.js Express application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Node.js 14+ installed
- npm or yarn
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Set environment variables for OpenTelemetry:

```bash
export OTEL_SERVICE_NAME=my-nodejs-app
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4328
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Explicit endpoints are required for manual instrumentation to send all three signal types (traces, metrics, logs) correctly.

### 3. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 4. Configure Sematext Agent

**Enable OpenTelemetry with traces, metrics, and logs:**

```bash
# Enable all signals at once
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type all

# Or enable individually
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type traces
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type metrics
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type logs
```

**Configure token group with your Sematext App tokens:**

```bash
# Add traces token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-token-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add logs token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-token-group" \
  --type logs \
  --token "YOUR_LOGS_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-token-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --all-services \
  --token-group "my-token-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 5. Run the Application

```bash
npm start
```

The application will start on port 8080.

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
2. **Metrics**: Open your Sematext Monitoring App to see HTTP metrics
3. **Logs**: Open your Sematext Logs App to see console logs

## Creating Custom Spans

Manual instrumentation provides full control over span creation:

### Simple Span

```javascript
const { trace, SpanStatusCode } = require('@opentelemetry/api');
const tracer = trace.getTracer('my-app', '1.0.0');

const span = tracer.startSpan('my-operation');
span.setAttribute('key', 'value');
span.setStatus({ code: SpanStatusCode.OK });
span.end();
```

### Active Span with Context Propagation

```javascript
await tracer.startActiveSpan('my-operation', async (span) => {
    span.setAttribute('key', 'value');

    // Child spans automatically inherit context
    await someAsyncOperation();

    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
});
```

### Nested Spans

```javascript
await tracer.startActiveSpan('parent-operation', async (parentSpan) => {
    parentSpan.setAttribute('parent.attr', 'value');

    await tracer.startActiveSpan('child-operation', async (childSpan) => {
        childSpan.setAttribute('child.attr', 'value');
        childSpan.setStatus({ code: SpanStatusCode.OK });
        childSpan.end();
    });

    parentSpan.setStatus({ code: SpanStatusCode.OK });
    parentSpan.end();
});
```

### Database Query Span

```javascript
await tracer.startActiveSpan('database.lookup', async (dbSpan) => {
    dbSpan.setAttributes({
        'db.system': 'postgresql',
        'db.operation': 'SELECT',
        'db.table': 'users',
        'user.id': userId
    });

    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);

    dbSpan.setStatus({ code: SpanStatusCode.OK });
    dbSpan.end();
});
```

### Business Logic Span

```javascript
await tracer.startActiveSpan('process.user.data', async (processSpan) => {
    processSpan.setAttributes({
        'operation': 'transform',
        'user.id': userId
    });

    const processed = transformUserData(data);

    processSpan.setStatus({ code: SpanStatusCode.OK });
    processSpan.end();
});
```

### Error Handling

```javascript
try {
    // Your code
} catch (error) {
    span.recordException(error);
    span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
    });
    span.end();
}
```

## Creating Custom Metrics

Manual instrumentation allows creating custom metrics for your application:

### Counter Metric

```javascript
const { metrics } = require('@opentelemetry/api');
const meter = metrics.getMeter('my-app', '1.0.0');

// Create counter
const requestCounter = meter.createCounter('http.server.requests', {
    description: 'Total number of HTTP requests',
    unit: '1'
});

// Increment counter
requestCounter.add(1, { endpoint: '/', method: 'GET' });
```

### Histogram Metric

```javascript
// Create histogram for duration tracking
const requestDuration = meter.createHistogram('http.server.duration', {
    description: 'HTTP request duration',
    unit: 'ms'
});

// Record value
const duration = Date.now() - startTime;
requestDuration.record(duration, { endpoint: '/', method: 'GET' });
```

### UpDownCounter Metric

```javascript
// Create up/down counter for active connections
const activeRequests = meter.createUpDownCounter('http.server.active_requests', {
    description: 'Number of active HTTP requests',
    unit: '1'
});

// Increment
activeRequests.add(1, { endpoint: '/' });

// Decrement
activeRequests.add(-1, { endpoint: '/' });
```

## Creating Custom Logs

Manual instrumentation enables structured logs with automatic trace correlation:

### Basic Log Emission

```javascript
const { logs } = require('@opentelemetry/api-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');

const logger = logs.getLogger('my-app', '1.0.0');

logger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: 'Request processed successfully',
    attributes: {
        'endpoint': '/',
        'user.id': '123'
    },
    timestamp: Date.now()
});
```

### Logs with Trace Correlation

```javascript
const { trace } = require('@opentelemetry/api');

function emitLog(severityText, body, attributes = {}) {
    const activeSpan = trace.getActiveSpan();
    const logAttributes = { ...attributes };

    // Automatically add trace correlation
    if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        logAttributes['trace_id'] = spanContext.traceId;
        logAttributes['span_id'] = spanContext.spanId;
        logAttributes['trace_flags'] = spanContext.traceFlags;
    }

    logger.emit({
        severityNumber: getSeverityNumber(severityText),
        severityText: severityText.toUpperCase(),
        body: body,
        attributes: logAttributes,
        timestamp: Date.now()
    });
}

// Usage
emitLog('info', 'Processing user request', { 'user.id': userId });
emitLog('error', 'Failed to process request', { 'error.type': 'ValidationError' });
```

### Severity Levels

```javascript
const { SeverityNumber } = require('@opentelemetry/api-logs');

// Available severity levels:
SeverityNumber.TRACE   // Detailed trace information
SeverityNumber.DEBUG   // Debug information
SeverityNumber.INFO    // Informational messages
SeverityNumber.WARN    // Warning messages
SeverityNumber.ERROR   // Error messages
SeverityNumber.FATAL   // Fatal error messages
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `nodejs-express-manual` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Yes | `http://localhost:4328` | OTLP endpoint for logs |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |
| `PORT` | No | `8080` | Application port |

## Advantages of Manual Instrumentation

1. **Full Control**: Explicitly define what gets traced
2. **Custom Spans**: Create spans for business-critical operations
3. **Rich Attributes**: Add domain-specific attributes
4. **Nested Spans**: Model complex operations with parent-child relationships
5. **Selective Instrumentation**: Only instrument what matters

## When to Use Manual Instrumentation

- **Business Logic Tracing**: Track domain-specific operations
- **Fine-Grained Control**: Need precise control over span lifecycle
- **Custom Attributes**: Add application-specific context
- **Selective Instrumentation**: Only instrument critical paths
- **Complex Workflows**: Model multi-step processes accurately

## Comparison with Auto-Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| Setup Complexity | Low | Medium |
| Code Changes | Minimal | Moderate |
| Control | Limited | Full |
| Custom Spans | Via API calls | Native |
| Learning Curve | Easy | Moderate |

## Troubleshooting

### No Custom Spans Appearing

1. **Verify tracer is initialized**:
   Check console for "OpenTelemetry Manual Instrumentation Configured" message

2. **Ensure spans are ended**:
   ```javascript
   span.end(); // Always end your spans!
   ```

3. **Check span status**:
   ```javascript
   span.setStatus({ code: SpanStatusCode.OK }); // Set status before ending
   ```

### Spans Not Nested Properly

Use `startActiveSpan` instead of `startSpan` for automatic context propagation:

```javascript
// ✅ Good: Automatic context propagation
await tracer.startActiveSpan('parent', async (parent) => {
    await tracer.startActiveSpan('child', async (child) => {
        // child automatically nested under parent
        child.end();
    });
    parent.end();
});

// ❌ Bad: Manual context management required
const parent = tracer.startSpan('parent');
const child = tracer.startSpan('child', { parent }); // Must explicitly set parent
```

## Next Steps

- **Add metrics**: Implement custom metrics with `@opentelemetry/api-metrics`
- **Log correlation**: Add trace context to application logs
- **Deploy to Docker**: See [Docker example](../../../docker/manual-instrumentation/express/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/manual-instrumentation/express/)

## Resources

- [OpenTelemetry Node.js Documentation](https://opentelemetry.io/docs/languages/js/)
- [OpenTelemetry API Reference](https://open-telemetry.github.io/opentelemetry-js-api/)
- [Span API](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/_opentelemetry_api.Span.html)
- [Tracer API](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/_opentelemetry_api.Tracer.html)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
