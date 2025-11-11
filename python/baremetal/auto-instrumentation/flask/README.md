# Python Flask - Auto-Instrumentation (Baremetal)

This example demonstrates automatic OpenTelemetry instrumentation for a Python Flask application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Flask instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../manual-instrumentation/flask/) for logs support |

## Prerequisites

- Python 3.8+ installed
- pip package manager
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring)

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
export OTEL_SERVICE_NAME=python-flask-baremetal-auto
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Traces use port 4338, metrics use port 4318.

### 3. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 4. Configure Sematext Agent

**Enable OpenTelemetry with traces and metrics:**

```bash
# Enable traces and metrics individually
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type traces
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type metrics
```

**Configure token group with your Sematext App tokens:**

```bash
# Add traces token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "python-token-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "python-token-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --service-names "python-flask-baremetal-auto" \
  --token-group "python-token-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 5. Run the Application

Run the application with automatic instrumentation:

```bash
opentelemetry-instrument python app.py
```

The application will start on port 8080. The `opentelemetry-instrument` command automatically configures OpenTelemetry based on environment variables.

### 6. Generate Test Traffic

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

### 7. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see distributed traces
2. **Metrics**: Open your Sematext Monitoring App to see HTTP metrics

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/flask/).

## How Auto-Instrumentation Works

### Automatic Instrumentation

The `opentelemetry-instrument` command automatically instruments:

- **HTTP**: Flask request/response handling
- **Flask**: Route handlers and middleware
- **WSGI**: WSGI application layer

No code changes required in your application logic!

**Note**: Logs are not automatically sent via OTLP in auto-instrumentation. Print statements are written to stdout but not sent to Sematext. For logs support with OTLP export, use [manual instrumentation](../../manual-instrumentation/flask/).

### Configuration

The `opentelemetry-instrument` command uses environment variables to configure OpenTelemetry:

- `OTEL_SERVICE_NAME`: Service name
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: Traces endpoint
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: Metrics endpoint
- `OTEL_EXPORTER_OTLP_PROTOCOL`: Protocol (http/protobuf)

### Adding Custom Attributes

While auto-instrumentation handles most tracing, you can add custom attributes:

```python
from opentelemetry import trace

span = trace.get_current_span()
if span:
    span.set_attributes({
        'user.id': user_id,
        'operation': 'get_user'
    })
```

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint - returns welcome message |
| `/users/<id>` | GET | Get user by ID (with custom span attributes) |
| `/slow` | GET | Slow endpoint - simulates 2s latency |
| `/error` | GET | Error endpoint - throws intentional error |
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `python-flask-baremetal-auto` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |
| `PORT` | No | `8080` | Application port |

## Enabling Additional Instrumentations

The `opentelemetry-distro` package includes many instrumentations by default. To enable additional instrumentations for databases or other libraries, install the relevant packages:

```bash
# Database instrumentations
pip install opentelemetry-instrumentation-psycopg2  # PostgreSQL
pip install opentelemetry-instrumentation-mysql     # MySQL
pip install opentelemetry-instrumentation-pymongo   # MongoDB

# Redis
pip install opentelemetry-instrumentation-redis

# HTTP clients
pip install opentelemetry-instrumentation-requests
pip install opentelemetry-instrumentation-urllib3
```

Then run with the same command:

```bash
opentelemetry-instrument python app.py
```

## Troubleshooting

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

3. **Check application logs** for OpenTelemetry initialization messages

### Port Already in Use

Change the port:

```bash
export PORT=3000
opentelemetry-instrument python app.py
```

### Logs Not Appearing

Auto-instrumentation does not support OTLP log export. Print statements are written to stdout only. For logs with OTLP export, use [manual instrumentation](../../manual-instrumentation/flask/).

### Command Not Found: opentelemetry-instrument

Ensure `opentelemetry-distro` is installed:

```bash
pip install opentelemetry-distro
```

## Comparing with Manual Instrumentation

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

## Next Steps

- **Try Manual**: See [Manual Instrumentation baremetal example](../../manual-instrumentation/flask/)
- **Add database**: Install PostgreSQL/MongoDB instrumentation
- **Custom spans**: Create custom spans for business logic
- **Deploy to Docker**: See [Docker example](../../../docker/auto-instrumentation/flask/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/auto-instrumentation/flask/)

## Resources

- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/languages/python/)
- [OpenTelemetry Python Auto-Instrumentation](https://opentelemetry.io/docs/zero-code/python/)
- [Supported Libraries](https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
