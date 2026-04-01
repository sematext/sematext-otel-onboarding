# Host Metrics — OTel Collector → Sematext

This example collects host-level infrastructure metrics (CPU, memory, disk, network, processes) using the OTel Collector's [hostmetrics receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/hostmetricsreceiver) and forwards them to Sematext Cloud.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ❌ | Not applicable |
| **Metrics** | ✅ | CPU, memory, disk, filesystem, network, load, processes |
| **Logs** | ❌ | Use a filelog receiver for log collection |

### Metrics Collected

| Scraper | Metrics |
|---------|---------|
| `cpu` | CPU utilization per core and state |
| `disk` | Disk I/O operations, bytes, time |
| `filesystem` | Used, free, and total filesystem space |
| `load` | 1m, 5m, 15m load averages |
| `memory` | Used, free, cached, buffered memory |
| `network` | Bytes and packets sent/received per interface |
| `process` | Per-process CPU, memory, and disk I/O |

## Architecture

```
┌─────────────────────────────────────────┐
│  Host OS                                │
│                                         │
│  /proc, /sys, filesystem                │
│       │                                 │
│  ┌────▼────────────────┐  OTLP gRPC    │
│  │  otel-collector     │ ─────────────▶ Sematext Cloud
│  │  (hostmetrics)      │               │
│  └─────────────────────┘               │
└─────────────────────────────────────────┘
```

The collector reads host metrics directly from the Linux `/proc` and `/sys` filesystems, which are mounted into the container as read-only volumes.

## Prerequisites

- Docker installed
- Docker Compose installed
- Linux host (hostmetrics reads from `/proc` and `/sys`)
- Sematext Cloud account with a Monitoring App

## Quick Start

### 1. Update Token in docker-compose.yaml

```yaml
otel-collector:
  environment:
    - METRICS_TOKEN=your-metrics-token
```

Get your token from your Sematext Monitoring App.

### 2. Start the Collector

```bash
docker-compose up -d
```

### 3. View Collector Logs

```bash
docker-compose logs -f otel-collector
```

### 4. View in Sematext Cloud

Open your Sematext Monitoring App to see host infrastructure metrics.

## Configuration

### otel-collector-config.yaml

Key settings:

```yaml
receivers:
  hostmetrics:
    root_path: /hostfs          # Host filesystem mounted into the container
    collection_interval: 60s    # How often metrics are scraped
    scrapers:
      cpu:
      memory:
      disk:
      filesystem:
      load:
      network:
      process:
```

The `root_path: /hostfs` tells the receiver to read from the mounted host filesystem rather than the container's own filesystem.

The `resourcedetection` processor automatically adds the hostname and OS details as resource attributes on all metrics.

### docker-compose.yaml Volumes

| Mount | Purpose |
|-------|---------|
| `/proc:/hostfs/proc:ro` | Process and kernel statistics |
| `/sys:/hostfs/sys:ro` | System and hardware information |
| `/:/hostfs:ro,rslave` | Full host filesystem for disk/filesystem metrics |

## Troubleshooting

**No metrics in Sematext:**
1. Check collector logs: `docker-compose logs otel-collector`
2. Verify the `METRICS_TOKEN` is set correctly
3. Confirm host volumes are accessible: `docker-compose exec otel-collector ls /hostfs/proc`

**Process metrics missing:**
- The `mute_*_error: true` flags suppress common permission errors when reading process details. If you need full process metrics, run the collector with elevated privileges.

**Filesystem metrics show container paths instead of host paths:**
- Ensure `root_path: /hostfs` is set in the config and all three volume mounts are present in `docker-compose.yaml`.

## Resources

- [OTel Collector hostmetrics Receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/hostmetricsreceiver)
- [OTel Collector resourcedetection Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/resourcedetectionprocessor)
- [Sematext OTLP Ingestion](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
