# PHP OpenTelemetry Examples

Laravel application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Baremetal** | [Laravel Auto](baremetal/auto-instrumentation/laravel/) | [Laravel Manual](baremetal/manual-instrumentation/laravel/) |
| **Docker** | [Laravel Auto](docker/auto-instrumentation/laravel/) | [Laravel Manual](docker/manual-instrumentation/laravel/) |
| **Kubernetes** | [Laravel Auto](kubernetes/auto-instrumentation/laravel/) | [Laravel Manual](kubernetes/manual-instrumentation/laravel/) |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ Logs ❌ (zero code changes, ext-opentelemetry extension)

**Manual Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (full control, custom spans, complete observability)

## Resources

- [OpenTelemetry PHP Documentation](https://opentelemetry.io/docs/languages/php/)
- [OpenTelemetry PHP Auto-Instrumentation](https://opentelemetry.io/docs/zero-code/php/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
