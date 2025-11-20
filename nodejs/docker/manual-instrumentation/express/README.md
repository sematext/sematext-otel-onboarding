# Node.js Express - Manual Instrumentation (Docker)

This example demonstrates manual OpenTelemetry instrumentation for a Node.js Express application running in Docker containers.

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

**Infrastructure Token** - Replace with your Sematext Infrastructure token:
```yaml
- INFRA_TOKEN=your-infra-token
```

**Region** - Set based on your Sematext Cloud region:
```yaml
- REGION=US  # US for Sematext Cloud US, EU for Sematext Cloud EU
```

**App Tokens** - Replace with your actual Sematext App tokens:
```yaml
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_MY_TOKEN_GROUP_SERVICES="all-services"
```

Get your tokens from each App in Sematext Cloud.

**Note**: Metrics are commented out by default. To enable metrics, uncomment:
```yaml
- OTEL_METRICS_ENABLED=true
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
```

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
await tracer.startActiveSpan('get-user-operation', async (parentSpan) => {
    parentSpan.setAttribute('user.id', userId);

    // Database lookup span
    await tracer.startActiveSpan('database.lookup', async (dbSpan) => {
        dbSpan.setAttributes({
            'db.system': 'postgresql',
            'db.operation': 'SELECT'
        });
        dbSpan.setStatus({ code: SpanStatusCode.OK });
        dbSpan.end();
    });

    // Processing span
    await tracer.startActiveSpan('process.user.data', async (processSpan) => {
        processSpan.setAttribute('operation', 'transform');
        processSpan.setStatus({ code: SpanStatusCode.OK });
        processSpan.end();
    });

    parentSpan.setStatus({ code: SpanStatusCode.OK });
    parentSpan.end();
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

Manual instrumentation allows creating custom metrics:

```javascript
const { metrics } = require('@opentelemetry/api');
const meter = metrics.getMeter('my-app', '1.0.0');

// Counter - total requests
const requestCounter = meter.createCounter('http.server.requests', {
    description: 'Total number of HTTP requests',
    unit: '1'
});
requestCounter.add(1, { endpoint: '/', method: 'GET' });

// Histogram - request duration
const requestDuration = meter.createHistogram('http.server.duration', {
    description: 'HTTP request duration',
    unit: 'ms'
});
requestDuration.record(duration, { endpoint: '/', method: 'GET' });

// UpDownCounter - active requests
const activeRequests = meter.createUpDownCounter('http.server.active_requests', {
    description: 'Number of active HTTP requests',
    unit: '1'
});
activeRequests.add(1);  // increment
activeRequests.add(-1); // decrement
```

## Creating Custom Logs

Manual instrumentation enables structured logs with trace correlation:

```javascript
const { logs } = require('@opentelemetry/api-logs');
const { SeverityNumber } = require('@opentelemetry/api-logs');
const { trace } = require('@opentelemetry/api');

const logger = logs.getLogger('my-app', '1.0.0');

function emitLog(severityText, body, attributes = {}) {
    const activeSpan = trace.getActiveSpan();
    const logAttributes = { ...attributes };

    // Add trace correlation
    if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        logAttributes['trace_id'] = spanContext.traceId;
        logAttributes['span_id'] = spanContext.spanId;
    }

    logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: severityText.toUpperCase(),
        body: body,
        attributes: logAttributes,
        timestamp: Date.now()
    });
}

// Usage
emitLog('info', 'Request processed', { 'user.id': userId });
emitLog('error', 'Failed to process request', { 'error.type': 'ValidationError' });
```

## Docker Configuration

Same Docker setup as auto-instrumentation example, but with manual span creation in application code.

See [Auto-Instrumentation Docker README](../auto-instrumentation/express/README.md) for detailed Docker configuration.

## Viewing Custom Spans

In Sematext Tracing App, you'll see:

- **Nested span relationships**: Parent → Database → Processing
- **Custom attributes**: `db.system`, `db.operation`, `user.id`, etc.
- **Error details**: Exception type, message, and stack trace
- **Operation types**: Distinguished by custom attributes

## Common Tasks

```bash
# View logs with custom span information
docker-compose logs -f nodejs-app

# Restart after code changes
docker-compose up -d --build

# Stop and remove
docker-compose down
```

## Troubleshooting

### Custom Spans Not Appearing

1. **Check spans are ended**:
   Every `startSpan()` or `startActiveSpan()` must have a corresponding `end()` call

2. **Verify span status**:
   Set span status before ending:
   ```javascript
   span.setStatus({ code: SpanStatusCode.OK });
   span.end();
   ```

3. **Check tracer initialization**:
   Look for "OpenTelemetry Manual Instrumentation Configured" in logs

### Spans Not Nested Properly

Use `startActiveSpan` for automatic context propagation:

```javascript
// ✅ Correct: Uses startActiveSpan
await tracer.startActiveSpan('parent', async (parent) => {
    await tracer.startActiveSpan('child', async (child) => {
        // Automatically nested
        child.end();
    });
    parent.end();
});
```

## Production Considerations

Same as auto-instrumentation:
- Use Docker secrets for tokens
- Add resource limits
- Implement health checks
- Use multi-stage builds

See [Auto-Instrumentation Docker README](../auto-instrumentation/express/README.md) for details.

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes manual example](../../kubernetes/manual-instrumentation/express/)
- **Compare with Auto**: See [Auto-Instrumentation Docker example](../auto-instrumentation/express/)
- **Add custom metrics**: Extend with manual metric creation

## Resources

- [OpenTelemetry Node.js Manual Instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [Tracer API](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/_opentelemetry_api.Tracer.html)
- [Span API](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/_opentelemetry_api.Span.html)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
