# Node.js Express - Auto-Instrumentation (Baremetal)

This example demonstrates automatic OpenTelemetry instrumentation for a Node.js Express application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Express instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../manual-instrumentation/express/) for logs support |

## Prerequisites

- Node.js 14+ installed
- npm or yarn
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring)

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
  --token-group "my-otel-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

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

### 5. Run the Application

```bash
npm start
```

The application will start on port 8080.

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

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/express/).

## How Auto-Instrumentation Works

### Automatic Instrumentation

The `@opentelemetry/auto-instrumentations-node` package automatically instruments:

- **HTTP/HTTPS**: Incoming and outgoing HTTP requests
- **Express**: Route handlers and middleware

No code changes required in your application logic!

**Note**: Logs are not automatically sent via OTLP in auto-instrumentation. Console.log statements are written to stdout but not sent to Sematext. For logs support with OTLP export, use [manual instrumentation](../../manual-instrumentation/express/).

### Configuration

OpenTelemetry configuration is in `otel-config.js`:

```javascript
const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': { enabled: true },
            '@opentelemetry/instrumentation-express': { enabled: true },
        }),
    ],
});
```

### Adding Custom Attributes

While auto-instrumentation handles most tracing, you can add custom attributes:

```javascript
const { trace } = require('@opentelemetry/api');

const span = trace.getActiveSpan();
if (span) {
    span.setAttributes({
        'user.id': userId,
        'operation': 'get_user'
    });
}
```

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint - returns welcome message |
| `/users/:id` | GET | Get user by ID (with custom span attributes) |
| `/slow` | GET | Slow endpoint - simulates 2s latency |
| `/error` | GET | Error endpoint - throws intentional error |
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `nodejs-express-auto` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |
| `PORT` | No | `8080` | Application port |

## Enabling Additional Instrumentations

Uncomment lines in `otel-config.js` to enable database, messaging, or caching instrumentation:

```javascript
instrumentations: [
    getNodeAutoInstrumentations({
        // ... existing config ...

        // Database
        '@opentelemetry/instrumentation-mongodb': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },

        // Caching
        '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
],
```

Then install the required packages:

```bash
npm install @opentelemetry/instrumentation-mongodb \
            @opentelemetry/instrumentation-pg \
            @opentelemetry/instrumentation-redis
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

3. **Check application logs** for OpenTelemetry configuration output

### Port Already in Use

Change the port:

```bash
export PORT=3000
npm start
```

### Logs Not Appearing

Auto-instrumentation does not support OTLP log export. Console.log statements are written to stdout only. For logs with OTLP export, use [manual instrumentation](../../manual-instrumentation/express/).

## Next Steps

- **Add database**: Install PostgreSQL/MongoDB instrumentation
- **Custom spans**: Create custom spans for business logic
- **Deploy to Docker**: See [Docker example](../../../docker/auto-instrumentation/express/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/auto-instrumentation/express/)

## Resources

- [OpenTelemetry Node.js Documentation](https://opentelemetry.io/docs/languages/js/)
- [OpenTelemetry Node.js Auto-Instrumentation](https://opentelemetry.io/docs/zero-code/js/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
