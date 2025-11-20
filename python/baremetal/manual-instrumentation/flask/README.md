# Python Flask - Manual Instrumentation (Baremetal)

This example demonstrates manual OpenTelemetry instrumentation for a Python Flask application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Python 3.8+ installed
- pip package manager
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Install Dependencies

**Create and activate a virtual environment:**

```bash
python3 -m venv venv
source venv/bin/activate
```

**Install dependencies:**

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Set environment variables for OpenTelemetry:

```bash
export OTEL_SERVICE_NAME=python-flask-baremetal-manual
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
# Enable all signals individually
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
python app.py
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
2. **Metrics**: Open your Sematext Monitoring App to see custom metrics
3. **Logs**: Open your Sematext Logs App to see application logs

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
with tracer.start_as_current_span('parent-operation') as parent_span:
    parent_span.set_attribute('parent.attr', 'value')

    with tracer.start_as_current_span('child-operation') as child_span:
        child_span.set_attribute('child.attr', 'value')
        child_span.set_status(Status(StatusCode.OK))

    parent_span.set_status(Status(StatusCode.OK))
```

### Database Query Span

```python
with tracer.start_as_current_span('database.lookup') as db_span:
    db_span.set_attributes({
        'db.system': 'postgresql',
        'db.operation': 'SELECT',
        'db.table': 'users',
        'user.id': user_id
    })

    result = db.query('SELECT * FROM users WHERE id = ?', [user_id])

    db_span.set_status(Status(StatusCode.OK))
```

### Business Logic Span

```python
with tracer.start_as_current_span('process.user.data') as process_span:
    process_span.set_attributes({
        'operation': 'transform',
        'user.id': user_id
    })

    processed = transform_user_data(data)

    process_span.set_status(Status(StatusCode.OK))
```

### Error Handling

```python
try:
    # Your code
    span.set_status(Status(StatusCode.OK))
except Exception as error:
    span.record_exception(error)
    span.set_status(Status(StatusCode.ERROR, str(error)))
```

## Creating Custom Metrics

Manual instrumentation allows creating custom metrics for your application:

### Counter Metric

```python
from opentelemetry import metrics

meter = metrics.get_meter('my-app', '1.0.0')

# Create counter
request_counter = meter.create_counter(
    name='http.server.requests',
    description='Total number of HTTP requests',
    unit='1'
)

# Increment counter
request_counter.add(1, {'endpoint': '/', 'method': 'GET'})
```

### Histogram Metric

```python
# Create histogram for duration tracking
request_duration = meter.create_histogram(
    name='http.server.duration',
    description='HTTP request duration',
    unit='ms'
)

# Record value
duration = (time.time() - start_time) * 1000
request_duration.record(duration, {'endpoint': '/', 'method': 'GET'})
```

### UpDownCounter Metric

```python
# Create up/down counter for active connections
active_requests = meter.create_up_down_counter(
    name='http.server.active_requests',
    description='Number of active HTTP requests',
    unit='1'
)

# Increment
active_requests.add(1, {'endpoint': '/'})

# Decrement
active_requests.add(-1, {'endpoint': '/'})
```

## Creating Custom Logs

Manual instrumentation enables structured logs with automatic trace correlation:

### Basic Log Emission

```python
import logging

# Configure logging handler
from opentelemetry.sdk._logs import LoggingHandler
handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
logging.getLogger().addHandler(handler)

# Use standard Python logging
logger = logging.getLogger(__name__)
logger.info('Request processed successfully', extra={
    'endpoint': '/',
    'user_id': '123'
})
```

### Logs with Trace Correlation

```python
from opentelemetry import trace

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
emit_log('info', 'Processing user request', user_id=user_id)
emit_log('error', 'Failed to process request', error_type='ValidationError')
```

### Severity Levels

```python
import logging

# Available severity levels:
logging.debug('Debug information')
logging.info('Informational messages')
logging.warning('Warning messages')
logging.error('Error messages')
logging.critical('Critical error messages')
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `python-flask-baremetal-manual` | Service name (must match agent config) |
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
6. **Custom Metrics**: Track application-specific metrics
7. **Structured Logs**: Emit logs with trace correlation

## When to Use Manual Instrumentation

- **Business Logic Tracing**: Track domain-specific operations
- **Fine-Grained Control**: Need precise control over span lifecycle
- **Custom Attributes**: Add application-specific context
- **Selective Instrumentation**: Only instrument critical paths
- **Complex Workflows**: Model multi-step processes accurately
- **Custom Metrics**: Track business-specific measurements
- **Log Correlation**: Automatically correlate logs with traces

## Comparing with Auto-Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Use opentelemetry-instrument | Configure SDK manually |
| **Code Changes** | None required | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Metrics** | HTTP metrics | Custom metrics |
| **Logs** | Not supported | Full OTLP support |
| **Overhead** | Slightly higher | Lower |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs |

## Troubleshooting

### No Custom Spans Appearing

1. **Verify tracer is initialized**:
   Check console for "OpenTelemetry Manual Instrumentation Configured" message

2. **Ensure spans are ended**:
   ```python
   span.end()  # Always end your spans!
   ```

3. **Check span status**:
   ```python
   span.set_status(Status(StatusCode.OK))  # Set status before ending
   ```

### Spans Not Nested Properly

Use `start_as_current_span` for automatic context propagation:

```python
# Good: Automatic context propagation
with tracer.start_as_current_span('parent') as parent:
    with tracer.start_as_current_span('child') as child:
        # child automatically nested under parent
        pass

# Bad: Manual context management required
parent = tracer.start_span('parent')
child = tracer.start_span('child', context=trace.set_span_in_context(parent))
```

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

3. **Check application logs** for OpenTelemetry configuration output

### Port Already in Use

Change the port:

```bash
export PORT=3000
python app.py
```

## Next Steps

- **Try Auto**: See [Auto-Instrumentation baremetal example](../../auto-instrumentation/flask/)
- **Add database**: Instrument PostgreSQL/MongoDB queries
- **Deploy to Docker**: See [Docker example](../../../docker/manual-instrumentation/flask/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/manual-instrumentation/flask/)

## Resources

- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/languages/python/)
- [OpenTelemetry Python API Reference](https://opentelemetry-python.readthedocs.io/)
- [Tracer API](https://opentelemetry-python.readthedocs.io/en/latest/api/trace.html)
- [Metrics API](https://opentelemetry-python.readthedocs.io/en/latest/api/metrics.html)
- [Logs API](https://opentelemetry-python.readthedocs.io/en/latest/api/logs.html)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
