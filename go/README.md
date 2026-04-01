# Go OpenTelemetry Examples

Go application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Docker** | [Gin Auto (eBPF)](docker/auto-instrumentation/gin/) | — |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ (zero code changes, Grafana Beyla eBPF agent)

> Manual instrumentation and Kubernetes/baremetal variants will follow the same structure as other languages in this repo.

## Resources

- [OpenTelemetry Go Documentation](https://opentelemetry.io/docs/languages/go/)
- [Grafana Beyla eBPF Auto-Instrumentation](https://grafana.com/docs/beyla/latest/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
