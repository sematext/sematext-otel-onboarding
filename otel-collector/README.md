# OTel Collector Examples

Examples using the [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) as an intermediary to receive, process, and forward telemetry to Sematext Cloud.

## Examples

| Example | Description | Signals |
|---------|-------------|---------|
| **[Java Auto + OTLP Receiver](../java/docker/auto-instrumentation/spring-boot/)** | Java app → OTel Collector (OTLP) → Sematext | Traces, Metrics, Logs |
| **[Apache Receiver](docker/apache-receiver/)** | OTel Collector pulls Apache mod_status metrics | Metrics |
| **[Host Metrics](docker/host-metrics/)** | OTel Collector collects host CPU/memory/disk/network | Metrics |

## Why Use the OTel Collector?

Using the OTel Collector as a gateway between your apps and Sematext provides several advantages:

- **Centralize token management**: One place to update Sematext tokens instead of per-app config
- **Add processing**: Batch, filter, sample, or enrich telemetry before export
- **Third-party scraping**: Pull metrics from services that don't emit OTLP (Apache, Prometheus endpoints, etc.)
- **Fan-out**: Send the same telemetry to multiple backends simultaneously
- **Decouple apps from backends**: Change the export destination without redeploying your app

## Resources

- [OpenTelemetry Collector Documentation](https://opentelemetry.io/docs/collector/)
- [OTel Collector Contrib Receivers](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver)
- [Sematext OTLP Ingestion](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
