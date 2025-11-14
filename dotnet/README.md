# .NET OpenTelemetry Examples

ASP.NET Core application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Baremetal** | [ASP.NET Core Auto](baremetal/auto-instrumentation/aspnetcore/) | [ASP.NET Core Manual](baremetal/manual-instrumentation/aspnetcore/) |
| **Docker** | [ASP.NET Core Auto](docker/auto-instrumentation/aspnetcore/) | [ASP.NET Core Manual](docker/manual-instrumentation/aspnetcore/) |
| **Kubernetes** | [ASP.NET Core Auto](kubernetes/auto-instrumentation/aspnetcore/) | [ASP.NET Core Manual](kubernetes/manual-instrumentation/aspnetcore/) |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ Logs ❌ (zero code changes, OpenTelemetry .NET Automatic Instrumentation)

**Manual Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (full control, custom spans, complete observability)

## Resources

- [OpenTelemetry .NET Documentation](https://opentelemetry.io/docs/languages/dotnet/)
- [OpenTelemetry .NET Automatic Instrumentation](https://opentelemetry.io/docs/zero-code/dotnet/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
