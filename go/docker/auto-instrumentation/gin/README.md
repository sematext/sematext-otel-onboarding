# Go Gin - eBPF Auto-Instrumentation (Docker)

This example demonstrates zero-code automatic OpenTelemetry instrumentation for a Go Gin application using [Grafana Beyla](https://grafana.com/docs/beyla/latest/), an eBPF-based auto-instrumentation agent that requires no code changes.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | HTTP request spans, latency, status codes |
| **Metrics** | ✅ | HTTP throughput, duration, error rate |
| **Logs** | ❌ | Not supported by Beyla (application logs sent separately) |

## How It Works

Beyla uses Linux eBPF probes to intercept HTTP traffic at the kernel level. It attaches to the Go application's process (via shared PID namespace) and automatically generates OpenTelemetry traces and metrics — no SDK imports or code modifications required.

```
┌──────────────────────────────────┐
│  Docker Compose                  │
│                                  │
│  ┌─────────────┐                 │
│  │  go-app     │ ◀── HTTP ────── │ ──── curl localhost:8090
│  │  (port 8090)│                 │
│  └──────┬──────┘                 │
│         │ shared PID namespace   │
│  ┌──────▼──────┐  OTLP gRPC     │
│  │  beyla      │ ──────────────▶ Sematext Cloud
│  │  (eBPF)     │                 │
│  └─────────────┘                 │
└──────────────────────────────────┘
```

## Prerequisites

- Docker installed
- Docker Compose installed
- Linux host with kernel ≥ 4.18 (eBPF requirement)
- Sematext Cloud account with Tracing and Monitoring Apps

> **Note**: Beyla requires a Linux kernel. It does not work on Docker Desktop for Mac/Windows (which runs a Linux VM). For local development on Mac/Windows, use a Linux VM or remote Docker host.

## Quick Start

### 1. Update Tokens in docker-compose.yaml

```yaml
beyla:
  environment:
    - OTEL_EXPORTER_OTLP_TRACES_HEADERS=X-API-TOKEN=your-traces-token
    - OTEL_EXPORTER_OTLP_METRICS_HEADERS=X-API-TOKEN=your-metrics-token
```

Get your tokens from your Sematext Tracing and Monitoring Apps.

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **go-app**: The Go Gin HTTP server (no OTel SDK included)
- **beyla**: The eBPF agent that instruments go-app automatically

### 3. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8090/

# User endpoint
curl http://localhost:8090/users/123

# Slow endpoint (2s delay)
curl http://localhost:8090/slow

# Error endpoint (HTTP 500)
curl http://localhost:8090/error
```

### 4. View Logs

```bash
docker-compose logs -f go-app
docker-compose logs -f beyla
```

### 5. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App
2. **Metrics**: Open your Sematext Monitoring App

## Configuration

### Beyla Environment Variables

| Variable | Description |
|----------|-------------|
| `BEYLA_OPEN_PORT` | Port the target app listens on — used to identify the process |
| `OTEL_SERVICE_NAME` | Service name that appears in Sematext |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Sematext OTLP gRPC endpoint |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS` | Sematext Tracing App token |
| `OTEL_EXPORTER_OTLP_METRICS_HEADERS` | Sematext Monitoring App token |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Export protocol (`grpc` or `http/protobuf`) |

### Why `pid: "service:go-app"`?

Beyla uses eBPF uprobes to instrument the Go runtime inside the target process. By sharing the PID namespace (`pid: "service:go-app"`), Beyla can see and attach to the `go-app` process. The `privileged: true` flag and `/sys/kernel/debug` mount give Beyla the kernel-level access needed to load eBPF programs.

## What Gets Instrumented Automatically

Beyla instruments at the HTTP layer via eBPF, capturing:

- **HTTP spans**: Method, URL, status code, duration
- **HTTP metrics**: Request rate, error rate, latency histograms
- **Go runtime**: Detected automatically — no SDK configuration needed

## Troubleshooting

**Beyla exits immediately:**
- Check kernel version: `uname -r` (must be ≥ 4.18)
- Verify `/sys/kernel/debug` is accessible on the host

**No traces in Sematext:**
1. Check Beyla logs: `docker-compose logs beyla`
2. Verify `BEYLA_OPEN_PORT` matches the port go-app listens on (8090)
3. Confirm tokens are correct

**go-app build fails:**
- Ensure `go.sum` is generated: `docker-compose run --rm go-app go mod tidy`

## Resources

- [Grafana Beyla Documentation](https://grafana.com/docs/beyla/latest/)
- [Beyla Docker Setup](https://grafana.com/docs/beyla/latest/setup/docker/)
- [Sematext OTLP Ingestion](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry Go](https://opentelemetry.io/docs/languages/go/)
