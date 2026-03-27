# Python Flask - Manual Instrumentation (Kubernetes)

This example demonstrates manual OpenTelemetry instrumentation for a Python Flask application deployed to Kubernetes.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` configured to access your cluster
- Docker installed locally
- Minikube (for local testing)
- Sematext Cloud account with Apps created

## Quick Start with Minikube

### 1. Start Minikube

```bash
minikube start
```

### 2. Deploy Sematext Agent

```bash
helm repo add sematext https://helm.sematext.com
helm repo update

helm install sematext-agent sematext/sematext-agent \
  --namespace sematext \
  --create-namespace \
  --set infraToken=your-infra-token \
  --set region=US \
  --set otel.enabled=true \
  --set otel.traces.enabled=true \
  --set otel.metrics.enabled=true \
  --set otel.logs.enabled=true \
  --set otel.services.all-services=my-otel-group \
  --set otel.token-groups.my-otel-group.monitoring-token=your-monitoring-token \
  --set otel.token-groups.my-otel-group.logs-token=your-logs-token \
  --set otel.token-groups.my-otel-group.traces-token=your-traces-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 3. Build Docker Image

```bash
docker build -t python-flask-k8s-manual:latest .
```

### 4. Load Image into Minikube

```bash
minikube image load python-flask-k8s-manual:latest
```

This makes your local Docker image available to Minikube.

### 5. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 6. Verify and Test

```bash
# Check deployment
kubectl get pods -l app=python-flask-k8s-manual

# Port-forward
kubectl port-forward svc/python-flask-k8s-manual 8080:80

# Test
curl http://localhost:8080/users/123
```

## Creating Custom Spans

Manual instrumentation provides full control over span creation:

### Simple Span

```python
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer('my-app', '1.0.0')

span = tracer.start_span('my-operation')
span.set_attribute('key', 'value')
span.set_status(Status(StatusCode.OK))
span.end()
```

### Context Manager Span

```python
with tracer.start_as_current_span('my-operation') as span:
    span.set_attribute('key', 'value')
    # Your code here
    span.set_status(Status(StatusCode.OK))
```

### Nested Spans

```python
with tracer.start_as_current_span('get-user-operation') as parent_span:
    parent_span.set_attribute('user.id', user_id)

    # Database lookup span
    with tracer.start_as_current_span('database.lookup') as db_span:
        db_span.set_attributes({
            'db.system': 'postgresql',
            'db.operation': 'SELECT',
            'db.table': 'users'
        })
        db_span.set_status(Status(StatusCode.OK))

    # Processing span
    with tracer.start_as_current_span('process.user.data') as process_span:
        process_span.set_attribute('operation', 'transform')
        process_span.set_status(Status(StatusCode.OK))

    parent_span.set_status(Status(StatusCode.OK))
```

### Error Handling

```python
try:
    # Your code
    pass
except Exception as error:
    span.record_exception(error)
    span.set_status(Status(StatusCode.ERROR, str(error)))
finally:
    span.end()
```

## Creating Custom Metrics

Manual instrumentation allows creating custom metrics:

```python
from opentelemetry import metrics

meter = metrics.get_meter('my-app', '1.0.0')

# Counter - total requests
request_counter = meter.create_counter(
    name='http.server.requests',
    description='Total number of HTTP requests',
    unit='1'
)
request_counter.add(1, {'endpoint': '/', 'method': 'GET'})

# Histogram - request duration
request_duration = meter.create_histogram(
    name='http.server.duration',
    description='HTTP request duration',
    unit='ms'
)
request_duration.record(duration, {'endpoint': '/', 'method': 'GET'})

# UpDownCounter - active requests
active_requests = meter.create_up_down_counter(
    name='http.server.active_requests',
    description='Number of active HTTP requests',
    unit='1'
)
active_requests.add(1)  # increment
active_requests.add(-1) # decrement
```

## Creating Custom Logs

Manual instrumentation enables structured logs with trace correlation:

```python
import logging
from opentelemetry import trace

logger = logging.getLogger(__name__)

def emit_log(level, message, **kwargs):
    """Emit a log with trace correlation"""
    span = trace.get_current_span()
    if span and span.is_recording():
        span_context = span.get_span_context()
        kwargs['trace_id'] = format(span_context.trace_id, '032x')
        kwargs['span_id'] = format(span_context.span_id, '016x')
        kwargs['trace_flags'] = span_context.trace_flags

    log_method = getattr(logger, level.lower(), logger.info)
    log_method(f"{message} {kwargs}")

# Usage
emit_log('info', 'Request processed', user_id=user_id)
emit_log('error', 'Failed to process request', error_type='ValidationError')
```

## Kubernetes Configuration

Same Kubernetes setup as auto-instrumentation, but with manual span creation in application code.

See [Auto-Instrumentation K8s README](../../auto-instrumentation/flask/README.md) for detailed Kubernetes configuration.

### Key Configuration for Manual Instrumentation

**Logs Endpoint**
Manual instrumentation includes logs support:
```yaml
- name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328"
```

Logs port: 4328 (HTTP)

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
└── flask.request
```

**Manual Instrumentation Trace:**
```
HTTP GET /users/123
├── flask.request
└── get-user-operation
    ├── database.lookup (db.system=postgresql)
    └── process.user.data (operation=transform)
```

Manual instrumentation provides deeper insights into application logic.

## Common Tasks

### View Logs

```bash
kubectl logs -l app=python-flask-k8s-manual -f
```

### Scale Deployment

```bash
kubectl scale deployment python-flask-k8s-manual --replicas=3
```

### Update Application

```bash
# Build new image
docker build -t python-flask-k8s-manual:latest .

# Load into Minikube
minikube image load python-flask-k8s-manual:latest

# Restart deployment to use new image
kubectl rollout restart deployment/python-flask-k8s-manual
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

1. **Check pod status**:
   ```bash
   kubectl describe pod -l app=python-flask-k8s-manual
   ```

2. **Check events**:
   ```bash
   kubectl get events --sort-by='.lastTimestamp'
   ```

3. **Check image availability in Minikube**:
   ```bash
   minikube image ls | grep python-flask-k8s-manual
   ```

### Custom Spans Not Appearing

1. **Verify spans are ended**:
   Check application logs for span lifecycle

2. **Check tracer initialization**:
   Look for "OpenTelemetry Manual Instrumentation Configured" in logs

3. **Verify span status is set**:
   All spans should have status set before ending

### Spans Not Nested Correctly

Use `start_as_current_span` for automatic context propagation:

```python
# ✅ Correct
with tracer.start_as_current_span('parent') as parent:
    with tracer.start_as_current_span('child') as child:
        pass
```

### No Data in Sematext

1. **Verify agent is running**:
   ```bash
   kubectl get pods -n sematext
   ```

2. **Check service name matches**:
   ```bash
   kubectl exec -it <pod-name> -- env | grep OTEL_SERVICE_NAME
   ```

3. **Test connectivity to agent**:
   ```bash
   kubectl exec -it <pod-name> -- python -c "import urllib.request; print(urllib.request.urlopen('http://st-agent-sematext-agent.sematext.svc.cluster.local:4338').status)"
   ```

4. **Check agent configuration**:
   ```bash
   kubectl get configmap -n sematext sematext-agent -o yaml | grep -A20 "otel:"
   ```

### DNS Resolution Issues

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup st-agent-sematext-agent.sematext.svc.cluster.local
```

Expected output should show the agent service IP.

## Production Best Practices

Same as auto-instrumentation:
- Use ConfigMaps for configuration
- Set resource limits
- Implement health probes
- Use HorizontalPodAutoscaler

See [Auto-Instrumentation K8s README](../../auto-instrumentation/flask/README.md) for details.

## Next Steps

- **Add custom metrics**: Implement business KPIs as metrics
- **Enhance span attributes**: Add more domain context
- **Compare with auto**: Deploy both and compare trace detail
- **Set up alerts**: Create alerts on custom span attributes

## Resources

- [OpenTelemetry Python Manual Instrumentation](https://opentelemetry.io/docs/languages/python/instrumentation/)
- [Python API Reference](https://opentelemetry-python.readthedocs.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
