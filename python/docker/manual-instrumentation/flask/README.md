# Python Flask - Manual Instrumentation (Docker)

This example demonstrates manual OpenTelemetry instrumentation for a Python Flask application running in Docker containers with full control over traces, metrics, and logs.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with custom attributes |
| **Metrics** | ✅ | Custom metrics (counters, histograms, gauges) |
| **Logs** | ✅ | Full OTLP logs export with trace correlation |

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
- OTEL_PYTHON_APP_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_PYTHON_APP_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_PYTHON_APP_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_PYTHON_APP_TOKEN_GROUP_SERVICES=python-flask-docker-manual
```

Get your tokens from each App in Sematext Cloud.

**Note**: Metrics are commented out by default. To enable metrics, uncomment:
```yaml
- OTEL_METRICS_ENABLED=true
- OTEL_PYTHON_APP_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
```

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **sematext-agent**: Receives telemetry and forwards to Sematext Cloud
- **python-app**: Your instrumented application

### 3. Verify Containers are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS
sematext-agent      ...                 Up
python-app          ...                 Up
```

### 4. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8080/

# User endpoint
curl http://localhost:8080/users/123

# Slow endpoint
curl http://localhost:8080/slow

# Error endpoint
curl http://localhost:8080/error
```

### 5. View Logs

```bash
# Application logs
docker-compose logs -f python-app

# Agent logs
docker-compose logs -f sematext-agent
```

### 6. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App - see custom spans with nested operations
2. **Metrics**: Open your Sematext Monitoring App - view custom metrics
3. **Logs**: Open your Sematext Logs App - see correlated logs with trace IDs

## Docker Compose Architecture

```
┌─────────────────┐         ┌──────────────────┐
│                 │  OTLP   │                  │
│  python-app     │────────▶│  sematext-agent  │─────▶ Sematext Cloud
│  (port 8080)    │         │  (ports 4317-    │
│                 │         │   4338)          │
└─────────────────┘         └──────────────────┘
```

The application sends telemetry to the agent via OTLP HTTP endpoints:
- Traces: `http://sematext-agent:4338/v1/traces`
- Metrics: `http://sematext-agent:4318/v1/metrics`
- Logs: `http://sematext-agent:4328/v1/logs`

## Configuration

### Application Service

The `python-app` service is configured in `docker-compose.yaml`:

```yaml
python-app:
  build: .
  ports:
    - "8080:8080"
  environment:
    - OTEL_SERVICE_NAME=python-flask-docker-manual
    - OTEL_SERVICE_VERSION=1.0.0
    - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://sematext-agent:4338
    - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://sematext-agent:4318
    - OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://sematext-agent:4328
    - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
  depends_on:
    - sematext-agent
```

**Key points:**
- Uses service name `sematext-agent` (Docker DNS resolution)
- Separate OTLP endpoints for traces (4338), metrics (4318), and logs (4328)
- All signals sent via HTTP/protobuf protocol
- Manual instrumentation configured in `otel_config.py`
- Depends on agent starting first
- Exposes port 8080 to host

### Agent Service

The `sematext-agent` service configuration:

```yaml
sematext-agent:
  image: sematext/agent:latest-4
  environment:
    - OTEL_ENABLED=true
    - OTEL_LOGS_ENABLED=true
    - OTEL_TRACES_ENABLED=true
    - OTEL_PYTHON_APP_TOKEN_GROUP_SERVICES=python-flask-docker-manual
  ports:
    - "4317:4317"  # Metrics gRPC
    - "4318:4318"  # Metrics HTTP
    - "4327:4327"  # Logs gRPC
    - "4328:4328"  # Logs HTTP
    - "4337:4337"  # Traces gRPC
    - "4338:4338"  # Traces HTTP
```

## Dockerfile

The application uses a lightweight Python image:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY otel_config.py .

EXPOSE 8080

CMD ["python", "app.py"]
```

**Key points:**
- Uses `python:3.11-slim` for smaller image size
- Installs OpenTelemetry SDK and OTLP exporters
- Includes both `app.py` and `otel_config.py`
- Runs directly with Python (instrumentation configured in code)

## Manual Instrumentation Features

### Custom Traces
The application creates manual spans with custom attributes:

```python
with tracer.start_as_current_span('get-user-operation') as span:
    span.set_attributes({
        'user.id': user_id,
        'operation': 'get_user'
    })

    # Nested spans for detailed tracing
    with tracer.start_as_current_span('database.lookup') as db_span:
        db_span.set_attributes({
            'db.system': 'postgresql',
            'db.operation': 'SELECT',
            'db.table': 'users'
        })
        # ... database operation ...
```

### Custom Metrics
The application tracks custom metrics:

```python
# Counter for total requests
request_counter.add(1, {'endpoint': '/', 'status': 200})

# Histogram for request duration
request_duration.record(duration_ms, {'endpoint': '/', 'status': 200})

# UpDownCounter for active requests
active_requests.add(1, {'endpoint': '/'})  # Increment
active_requests.add(-1, {'endpoint': '/'})  # Decrement
```

### Structured Logs with Trace Correlation
Logs automatically include trace IDs for correlation:

```python
def emit_log(level, message, **kwargs):
    """Emit a log with trace correlation"""
    span = trace.get_current_span()
    if span and span.is_recording():
        span_context = span.get_span_context()
        kwargs['trace_id'] = format(span_context.trace_id, '032x')
        kwargs['span_id'] = format(span_context.span_id, '016x')

    logger.info(f"{message} {kwargs}")
```

## What Gets Instrumented Manually

### Traces
- **Manual Spans**: Created explicitly with `start_as_current_span()`
- **Nested Operations**: Database queries, API calls, business logic
- **Custom Attributes**: User IDs, operation types, metadata
- **Error Tracking**: Explicit exception recording with `record_exception()`

### Metrics
- **Request Counter**: Total HTTP requests by endpoint and status
- **Request Duration**: HTTP request duration histogram
- **Active Requests**: Gauge for current active requests

### Logs
- **Structured Logging**: JSON-formatted logs with metadata
- **Trace Correlation**: Automatic trace_id and span_id injection
- **Log Levels**: INFO, WARN, ERROR, DEBUG
- **Custom Fields**: User IDs, operation metadata, errors

## Building Custom Image

To build and run with a custom tag:

```bash
# Build image
docker build -t my-python-app:1.0 .

# Update docker-compose.yaml
# Change: build: .
# To:     image: my-python-app:1.0

# Run
docker-compose up -d
```

## Environment Variables

### Application Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_SERVICE_NAME` | `python-flask-docker-manual` | Service identifier |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://sematext-agent:4338` | Traces endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://sematext-agent:4318` | Metrics endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | `http://sematext-agent:4328` | Logs endpoint (Docker DNS) |
| `PORT` | `8080` | Application port |

### Agent Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_ENABLED` | `true` | Enable OpenTelemetry |
| `OTEL_METRICS_ENABLED` | `true` | Enable metrics (port 4318) |
| `OTEL_LOGS_ENABLED` | `true` | Enable logs (port 4328) |
| `OTEL_TRACES_ENABLED` | `true` | Enable traces (port 4338) |
| `OTEL_PYTHON_APP_TOKEN_GROUP_*` | Token values | Sematext App tokens |

## Common Tasks

### View Application Logs

```bash
docker-compose logs -f python-app
```

### View Agent Logs

```bash
docker-compose logs -f sematext-agent
```

### Restart Services

```bash
docker-compose restart
```

### Stop and Remove

```bash
docker-compose down
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Inspect a Running Container

```bash
docker-compose exec python-app bash
```

## Troubleshooting

### No Data in Sematext

1. **Check service name matches**:
   ```bash
   docker-compose exec python-app env | grep OTEL_SERVICE_NAME
   ```

2. **Verify agent is running**:
   ```bash
   docker-compose ps sematext-agent
   ```

3. **Check agent logs for errors**:
   ```bash
   docker-compose logs sematext-agent | grep ERROR
   ```

4. **Test connectivity**:
   ```bash
   docker-compose exec python-app curl -v http://sematext-agent:4338
   ```

5. **Verify OTLP endpoints**:
   ```bash
   docker-compose exec python-app env | grep OTLP
   ```

### Application Won't Start

1. **Check application logs**:
   ```bash
   docker-compose logs python-app
   ```

2. **Verify port not in use**:
   ```bash
   lsof -i :8080  # On host
   ```

3. **Check build errors**:
   ```bash
   docker-compose build python-app
   ```

4. **Verify Python dependencies**:
   ```bash
   docker-compose run --rm python-app pip list
   ```

### No Logs in Sematext

1. **Check logs endpoint**:
   ```bash
   docker-compose exec python-app env | grep LOGS_ENDPOINT
   ```
   Should be: `http://sematext-agent:4328`

2. **Verify logs token**:
   Check that `OTEL_PYTHON_APP_TOKEN_GROUP_LOGS_TOKEN` is set in agent config

3. **Check log handler**:
   ```bash
   docker-compose logs python-app | grep -i "logging"
   ```

### Custom Metrics Not Appearing

1. **Check metric export interval** (default 60 seconds):
   Wait at least 1 minute after generating traffic

2. **Verify metrics endpoint**:
   ```bash
   docker-compose exec python-app env | grep METRICS_ENDPOINT
   ```

3. **Enable metrics in agent**:
   Uncomment `OTEL_METRICS_ENABLED=true` in docker-compose.yaml

## Production Considerations

### Use Secrets for Tokens

Don't hardcode tokens in docker-compose.yaml. Use Docker secrets or environment files:

```bash
# Create .env file (add to .gitignore!)
MONITORING_TOKEN=your-monitoring-token
LOGS_TOKEN=your-logs-token
TRACES_TOKEN=your-traces-token
```

```yaml
# In docker-compose.yaml
environment:
  - OTEL_PYTHON_APP_TOKEN_GROUP_MONITORING_TOKEN=${MONITORING_TOKEN}
  - OTEL_PYTHON_APP_TOKEN_GROUP_LOGS_TOKEN=${LOGS_TOKEN}
  - OTEL_PYTHON_APP_TOKEN_GROUP_TRACES_TOKEN=${TRACES_TOKEN}
```

### Resource Limits

Add resource constraints:

```yaml
python-app:
  # ... other config ...
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M
```

### Health Checks

Add Docker health checks:

```yaml
python-app:
  # ... other config ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Use Production WSGI Server

For production, use Gunicorn instead of Flask's development server:

**Update requirements.txt:**
```
gunicorn==21.2.0
```

**Update Dockerfile CMD:**
```dockerfile
CMD ["gunicorn", "-b", "0.0.0.0:8080", "-w", "4", "app:app"]
```

### Logging Configuration

Configure log levels and handlers:

```python
# In otel_config.py
handler = LoggingHandler(level=logging.WARNING, logger_provider=logger_provider)
logging.getLogger().setLevel(logging.WARNING)
```

## Comparing with Auto-Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Use opentelemetry-instrument | Configure SDK explicitly |
| **Code Changes** | Minimal | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Nested Spans** | Basic | Deep nesting with custom spans |
| **Metrics** | HTTP metrics only | Custom metrics (counters, histograms, gauges) |
| **Logs** | Not supported | Full OTLP logs with trace correlation |
| **Overhead** | Slightly higher | Lower (optimized) |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs, production |

## Advanced Usage

### Add Database Instrumentation

To instrument PostgreSQL:

1. Add to `requirements.txt`:
   ```
   psycopg2-binary==2.9.9
   opentelemetry-instrumentation-psycopg2==0.46b0
   ```

2. In `otel_config.py`:
   ```python
   from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
   Psycopg2Instrumentor().instrument()
   ```

### Add Redis Instrumentation

To instrument Redis:

1. Add to `requirements.txt`:
   ```
   redis==5.0.1
   opentelemetry-instrumentation-redis==0.46b0
   ```

2. In `otel_config.py`:
   ```python
   from opentelemetry.instrumentation.redis import RedisInstrumentor
   RedisInstrumentor().instrument()
   ```

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes example](../../kubernetes/manual-instrumentation/flask/)
- **Add databases**: Extend docker-compose with PostgreSQL, MongoDB, etc.
- **Compare with auto**: See [Auto Docker example](../auto-instrumentation/flask/)
- **Customize metrics**: Add business-specific metrics and dashboards

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [OpenTelemetry Python](https://opentelemetry.io/docs/languages/python/)
- [OpenTelemetry Python Manual Instrumentation](https://opentelemetry.io/docs/languages/python/instrumentation/)
- [OpenTelemetry Python API Reference](https://opentelemetry-python.readthedocs.io/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
