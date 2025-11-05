# Node.js OpenTelemetry Examples

Express application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Baremetal** | [Express Auto](baremetal/auto-instrumentation/express/) | [Express Manual](baremetal/manual-instrumentation/express/) |
| **Docker** | [Express Auto](docker/auto-instrumentation/express/) | [Express Manual](docker/manual-instrumentation/express/) |
| **Kubernetes** | [Express Auto](kubernetes/auto-instrumentation/express/) | [Express Manual](kubernetes/manual-instrumentation/express/) |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ Logs ❌ (zero code changes, automatic instrumentation)

**Manual Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (full control, custom spans, complete observability)

## Resources

- [OpenTelemetry Node.js Documentation](https://opentelemetry.io/docs/languages/js/)
- [OpenTelemetry Auto-Instrumentation](https://opentelemetry.io/docs/zero-code/js/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
