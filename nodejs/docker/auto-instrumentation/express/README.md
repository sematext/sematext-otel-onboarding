# Node.js Express - Auto-Instrumentation (Docker)

This example demonstrates automatic OpenTelemetry instrumentation for a Node.js Express application running in Docker containers.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Express instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../manual-instrumentation/express/) for logs support |

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with Apps created (Tracing, Monitoring)

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
- OTEL_NODEJS_APP_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_NODEJS_APP_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_NODEJS_APP_TOKEN_GROUP_SERVICES=nodejs-express-auto
```

Get your tokens from each App in Sematext Cloud.

**Note**: Metrics are commented out by default. To enable metrics, uncomment:
```yaml
- OTEL_METRICS_ENABLED=true
- OTEL_NODEJS_APP_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
```

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **sematext-agent**: Receives telemetry and forwards to Sematext Cloud
- **nodejs-app**: Your instrumented application

### 3. Verify Containers are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS
sematext-agent      ...                 Up
nodejs-app          npm start           Up
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
docker-compose logs -f nodejs-app

# Agent logs
docker-compose logs -f sematext-agent
```

### 6. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App
2. **Metrics**: Open your Sematext Monitoring App

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/express/).

## Docker Compose Architecture

```
┌─────────────────┐         ┌──────────────────┐
│                 │  OTLP   │                  │
│  nodejs-app     │────────▶│  sematext-agent  │─────▶ Sematext Cloud
│  (port 8080)    │         │  (ports 4317-    │
│                 │         │   4338)          │
└─────────────────┘         └──────────────────┘
```

## Configuration

### Application Service

The `nodejs-app` service is configured in `docker-compose.yaml`:

```yaml
nodejs-app:
  build: .
  ports:
    - "8080:8080"
  environment:
    - OTEL_SERVICE_NAME=nodejs-express-auto
    - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://sematext-agent:4338
    - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://sematext-agent:4318
  depends_on:
    - sematext-agent
```

**Key points:**
- Uses service name `sematext-agent` (Docker DNS resolution)
- Traces sent to port 4338, metrics to port 4318
- Depends on agent starting first
- Exposes port 8080 to host

### Agent Service

The `sematext-agent` service configuration:

```yaml
sematext-agent:
  image: sematext/agent:latest
  environment:
    - OTEL_ENABLED=true
    - OTEL_NODEJS_APP_TOKEN_GROUP_SERVICES=nodejs-express-auto
  ports:
    - "4317:4317"  # Metrics gRPC
    - "4318:4318"  # Metrics HTTP
    - "4327:4327"  # Logs gRPC
    - "4328:4328"  # Logs HTTP
    - "4337:4337"  # Traces gRPC
    - "4338:4338"  # Traces HTTP
```

## Dockerfile

The application uses a multi-stage build for efficiency:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 8080

USER node

CMD ["npm", "start"]
```

**Security features:**
- Alpine base image (smaller attack surface)
- Non-root user (`node`)
- Production dependencies only

## Building Custom Image

To build and run with a custom tag:

```bash
# Build image
docker build -t my-nodejs-app:1.0 .

# Update docker-compose.yaml
# Change: image: nodejs-express-auto:latest
# To:     image: my-nodejs-app:1.0

# Run
docker-compose up -d
```

## Environment Variables

### Application Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_SERVICE_NAME` | `nodejs-express-auto` | Service identifier |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://sematext-agent:4338` | Traces endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://sematext-agent:4318` | Metrics endpoint (Docker DNS) |
| `PORT` | `8080` | Application port |

### Agent Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_ENABLED` | `true` | Enable OpenTelemetry |
| `OTEL_METRICS_ENABLED` | `true` | Enable metrics (port 4318) |
| `OTEL_TRACES_ENABLED` | `true` | Enable traces (port 4338) |
| `OTEL_NODEJS_APP_TOKEN_GROUP_*` | Token values | Sematext App tokens |

## Common Tasks

### View Application Logs

```bash
docker-compose logs -f nodejs-app
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

## Troubleshooting

### No Data in Sematext

1. **Check service name matches**:
   ```bash
   docker-compose exec nodejs-app env | grep OTEL_SERVICE_NAME
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
   docker-compose exec nodejs-app curl -v http://sematext-agent:4338
   ```

### Application Won't Start

1. **Check application logs**:
   ```bash
   docker-compose logs nodejs-app
   ```

2. **Verify port not in use**:
   ```bash
   lsof -i :8080  # On host
   ```

3. **Check build errors**:
   ```bash
   docker-compose build nodejs-app
   ```

### Cannot Access from Host

1. **Verify port mapping**:
   ```bash
   docker-compose ps
   # Should show: 0.0.0.0:8080->8080/tcp
   ```

2. **Check firewall**:
   ```bash
   curl http://localhost:8080/health
   ```

## Production Considerations

### Use Secrets for Tokens

Don't hardcode tokens in docker-compose.yaml. Use Docker secrets or environment files:

```bash
# Create .env file (add to .gitignore!)
MONITORING_TOKEN=your-monitoring-token
TRACES_TOKEN=your-traces-token
```

```yaml
# In docker-compose.yaml
environment:
  - OTEL_NODEJS_APP_TOKEN_GROUP_MONITORING_TOKEN=${MONITORING_TOKEN}
  - OTEL_NODEJS_APP_TOKEN_GROUP_TRACES_TOKEN=${TRACES_TOKEN}
```

### Resource Limits

Add resource constraints:

```yaml
nodejs-app:
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
nodejs-app:
  # ... other config ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes example](../../kubernetes/auto-instrumentation/express/)
- **Add databases**: Extend docker-compose with PostgreSQL, MongoDB, etc.
- **Try manual instrumentation**: See [Manual Docker example](../manual-instrumentation/express/)

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
