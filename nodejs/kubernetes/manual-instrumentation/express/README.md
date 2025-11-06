# Node.js Express - Manual Instrumentation (Kubernetes)

This example demonstrates manual OpenTelemetry instrumentation for a Node.js Express application deployed to Kubernetes.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` configured to access your cluster
- Sematext Agent deployed to Kubernetes (via Helm)
- Sematext Cloud account with Apps created

## Quick Start

### 1. Deploy Sematext Agent

```bash
helm install sematext-agent sematext/sematext-agent \
  --namespace sematext \
  --create-namespace \
  --set infraToken=your-infra-token \
  --set region=US \
  --set otel.enabled=true \
  --set otel.traces.enabled=true \
  --set otel.metrics.enabled=true \
  --set otel.logs.enabled=true \
  --set otel.services.nodejs-express-manual=nodejs-group \
  --set otel.token-groups.nodejs-group.monitoring-token=your-monitoring-token \
  --set otel.token-groups.nodejs-group.logs-token=your-logs-token \
  --set otel.token-groups.nodejs-group.traces-token=your-traces-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 2. Build Docker Image Locally

```bash
docker build -t nodejs-express-manual:latest .
```

The deployment.yaml is already configured to use `nodejs-express-manual:latest` with `imagePullPolicy: IfNotPresent`, which will use your local image.

### 3. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 4. Verify and Test

```bash
# Check deployment
kubectl get pods -l app=nodejs-express-manual

# Port-forward
kubectl port-forward svc/nodejs-express-manual 8080:80

# Test
curl http://localhost:8080/users/123
```

## Manual Instrumentation Benefits

This example demonstrates **manual instrumentation** capabilities:

### Custom Nested Spans

The application creates explicit parent-child span relationships:

**Example from `/users/:id` endpoint:**
```
get-user-operation (parent)
├── database.lookup (child)
└── process.user.data (child)
```

### Rich Span Attributes

Manual spans include domain-specific attributes:
- `db.system`: Database type
- `db.operation`: SQL operation
- `db.table`: Table name
- `user.id`: Business entity ID

### Error Tracking

Detailed error context with manual exception recording:
```javascript
span.recordException(error);
span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message
});
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

## Kubernetes Configuration

Same Kubernetes setup as auto-instrumentation, but with manual span creation in application code.

See [Auto-Instrumentation K8s README](../auto-instrumentation/express/README.md) for detailed Kubernetes configuration.

## Viewing Custom Spans in Sematext

In your Sematext Tracing App, you'll see:

- **Hierarchical traces**: Multi-level span nesting
- **Custom attributes**: Business and technical context
- **Span duration**: Timing for each operation
- **Error details**: Full exception information

## Comparing Traces

**Auto-Instrumentation Trace:**
```
HTTP GET /users/123
└── express.middleware
```

**Manual Instrumentation Trace:**
```
HTTP GET /users/123
├── express.middleware
└── get-user-operation
    ├── database.lookup (db.system=postgresql)
    └── process.user.data (operation=transform)
```

Manual instrumentation provides deeper insights into application logic.

## Common Tasks

Same as auto-instrumentation example. See [Auto-Instrumentation K8s README](../auto-instrumentation/express/README.md).

## Troubleshooting

### Custom Spans Not Appearing

1. **Verify spans are ended**:
   Check application logs for span lifecycle

2. **Check tracer initialization**:
   Look for "OpenTelemetry Manual Instrumentation Configured" in logs

3. **Verify span status is set**:
   All spans should have status set before ending

### Spans Not Nested Correctly

Use `startActiveSpan` for automatic context propagation:

```javascript
// ✅ Correct
await tracer.startActiveSpan('parent', async (parent) => {
    await tracer.startActiveSpan('child', async (child) => {
        child.end();
    });
    parent.end();
});
```

## Production Considerations

Same as auto-instrumentation:
- Use ConfigMaps for configuration
- Set resource limits
- Implement health probes
- Use HorizontalPodAutoscaler

See [Auto-Instrumentation K8s README](../auto-instrumentation/express/README.md) for details.

## Next Steps

- **Add custom metrics**: Implement business KPIs as metrics
- **Enhance span attributes**: Add more domain context
- **Compare with auto**: Deploy both and compare trace detail
- **Set up alerts**: Create alerts on custom span attributes

## Resources

- [OpenTelemetry Manual Instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [Tracer API Reference](https://open-telemetry.github.io/opentelemetry-js-api/interfaces/_opentelemetry_api.Tracer.html)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
