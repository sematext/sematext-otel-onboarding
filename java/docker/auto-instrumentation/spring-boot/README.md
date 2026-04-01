# Java Spring Boot - Auto-Instrumentation (Docker)

This example demonstrates automatic OpenTelemetry instrumentation for a Java Spring Boot application running in Docker, using the OpenTelemetry Java Agent and an OTel Collector to forward telemetry to Sematext Cloud.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP, JDBC, and library instrumentation |
| **Metrics** | ✅ | Automatic JVM and HTTP metrics |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Update Configuration in docker-compose.yaml

Edit `docker-compose.yaml` and replace the placeholder tokens:

```yaml
otel-collector:
  environment:
    - TRACES_TOKEN=your-traces-token
    - METRICS_TOKEN=your-metrics-token
    - LOGS_TOKEN=your-logs-token
```

Get your tokens from each App in Sematext Cloud.

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **otel-collector**: Receives OTLP telemetry from the app and forwards to Sematext Cloud
- **java-app**: Your Spring Boot application instrumented with the OpenTelemetry Java agent

### 3. Generate Test Traffic

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

### 4. View Logs

```bash
docker-compose logs -f java-app
docker-compose logs -f otel-collector
```

### 5. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App
2. **Metrics**: Open your Sematext Monitoring App
3. **Logs**: Open your Sematext Logs App

## Architecture

```
┌─────────────────┐  OTLP gRPC  ┌──────────────────────┐  OTLP gRPC  ┌────────────────┐
│                 │             │                      │             │                │
│  java-app       │────────────▶│  otel-collector      │────────────▶│ Sematext Cloud │
│  (port 8080)    │             │  (ports 4317/4318)   │             │                │
│  Java Agent     │             │                      │             │                │
└─────────────────┘             └──────────────────────┘             └────────────────┘
```

The Java app sends all signals to the OTel Collector via a single OTLP gRPC endpoint. The collector routes each signal to Sematext using the appropriate App token.

## Configuration Files

### docker-compose.yaml

- **otel-collector**: Runs `otel/opentelemetry-collector-contrib`, mounts the collector config, and exposes OTLP ports
- **java-app**: Built from the local Dockerfile; sends to `http://otel-collector:4317` via gRPC

### otel-collector-config.yaml

The collector is configured with:
- **Receiver**: `otlp` — accepts gRPC (4317) and HTTP (4318)
- **Processor**: `batch` — buffers and batches telemetry before export
- **Exporters**: Three separate `otlp` exporters (one per signal type) to route each with its own Sematext token

```yaml
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/traces]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/metrics]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/logs]
```

## Dockerfile

Multi-stage build that downloads the OpenTelemetry Java agent and attaches it at runtime:

```dockerfile
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]
```

No code changes are required — the agent automatically instruments Spring MVC, JDBC, HTTP clients, JVM metrics, and log correlation.

## Troubleshooting

**No telemetry in Sematext:**
1. Check the collector received data: `docker-compose logs otel-collector`
2. Verify the Java agent loaded: `docker-compose logs java-app | grep -i opentelemetry`
3. Confirm tokens are set: `docker-compose exec otel-collector env | grep TOKEN`

**App fails to start:**
1. Run `docker-compose build` to check for build errors
2. Ensure Java 17+ is available in the build environment

## Resources

- [OpenTelemetry Java Agent](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
- [OTel Collector OTLP Receiver](https://github.com/open-telemetry/opentelemetry-collector/tree/main/receiver/otlpreceiver)
- [Sematext OTLP Ingestion](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
