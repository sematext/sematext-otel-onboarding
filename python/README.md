# Python OpenTelemetry Examples

Flask application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Baremetal** | [Flask Auto](baremetal/auto-instrumentation/flask/) | [Flask Manual](baremetal/manual-instrumentation/flask/) |
| **Docker** | [Flask Auto](docker/auto-instrumentation/flask/) | [Flask Manual](docker/manual-instrumentation/flask/) |
| **Kubernetes** | [Flask Auto](kubernetes/auto-instrumentation/flask/) | [Flask Manual](kubernetes/manual-instrumentation/flask/) |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ Logs ❌ (zero code changes, opentelemetry-instrument command)

**Manual Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (full control, custom spans, complete observability)

## Resources

- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/languages/python/)
- [OpenTelemetry Python Auto-Instrumentation](https://opentelemetry.io/docs/zero-code/python/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
