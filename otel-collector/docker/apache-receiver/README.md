# Apache Receiver — OTel Collector → Sematext

This example demonstrates using the OTel Collector's [Apache receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/apachereceiver) to pull metrics from Apache's `mod_status` endpoint and forward them to Sematext Cloud — no code changes or agents required on the Apache side.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ❌ | Not applicable for third-party service scraping |
| **Metrics** | ✅ | Apache server metrics via mod_status |
| **Logs** | ❌ | Use a filelog receiver for Apache access/error logs |

### Metrics Collected

| Metric | Description |
|--------|-------------|
| `apache.current_connections` | Active connections |
| `apache.requests` | Request rate |
| `apache.scoreboard` | Worker state distribution |
| `apache.traffic` | Bytes transferred |
| `apache.uptime` | Server uptime |
| `apache.workers` | Busy and idle worker counts |

## Architecture

```
┌─────────────┐  GET /server-status?auto  ┌──────────────────────┐  OTLP gRPC  ┌────────────────┐
│             │ ◀──── pull (60s) ─────── │                      │            │                │
│  apache     │                           │  otel-collector      │───────────▶│ Sematext Cloud │
│  mod_status │                           │  (apache receiver)   │            │                │
└─────────────┘                           └──────────────────────┘            └────────────────┘
```

The OTel Collector **pulls** metrics from Apache's `mod_status` endpoint on a configurable interval (default: 60s). No changes to Apache are needed beyond enabling `mod_status`.

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with a Monitoring App

## Quick Start

### 1. Update Token in docker-compose.yaml

```yaml
otel-collector:
  environment:
    - METRICS_TOKEN=your-metrics-token
```

Get your token from your Sematext Monitoring App.

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **apache**: Apache httpd with `mod_status` enabled
- **otel-collector**: Scrapes Apache metrics and forwards to Sematext

### 3. Verify Apache mod_status

```bash
# Should return Apache status in plain text
curl http://localhost:80/server-status?auto
```

### 4. View Collector Logs

```bash
docker-compose logs -f otel-collector
```

### 5. View in Sematext Cloud

Open your Sematext Monitoring App to see Apache metrics.

## Configuration

### otel-collector-config.yaml

```yaml
receivers:
  apache:
    endpoint: http://apache:80/server-status?auto
    collection_interval: 60s
```

The `apache` receiver periodically fetches the mod_status page and parses the metrics. The `collection_interval` controls how often it scrapes (default: 60s).

### Dockerfile (Apache)

The custom Dockerfile enables `mod_status` in the default Apache config:
1. Uncomments `LoadModule status_module` in `httpd.conf`
2. Adds a `<Location /server-status>` block accessible from within the Docker network

### Using with an Existing Apache Instance

To scrape an existing Apache server instead of the bundled container:

1. Enable `mod_status` on your Apache server
2. Remove the `apache` service from `docker-compose.yaml`
3. Update the endpoint in `otel-collector-config.yaml`:
   ```yaml
   receivers:
     apache:
       endpoint: http://your-apache-host/server-status?auto
   ```

## Troubleshooting

**No metrics in Sematext:**
1. Verify Apache returns status data: `curl http://localhost:80/server-status?auto`
2. Check collector logs: `docker-compose logs otel-collector`
3. Confirm the `METRICS_TOKEN` is set correctly

**`mod_status` returns 403 Forbidden:**
- The `Require ip` directive in the Dockerfile allows Docker network ranges (`172.16.0.0/12`, `10.0.0.0/8`). If your Docker network uses a different subnet, update the Dockerfile accordingly.

## Resources

- [OTel Collector Apache Receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/apachereceiver)
- [Apache mod_status Documentation](https://httpd.apache.org/docs/current/mod/mod_status.html)
- [Sematext OTLP Ingestion](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
