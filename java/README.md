# Java OpenTelemetry Examples

Spring Boot application examples with OpenTelemetry instrumentation for Sematext Cloud.

## Examples

| Environment | Auto-Instrumentation | Manual Instrumentation |
|-------------|----------------------|------------------------|
| **Baremetal** | [Spring Boot Auto](baremetal/auto-instrumentation/spring-boot/) | [Spring Boot Manual](baremetal/manual-instrumentation/spring-boot/) |
| **Docker** | [Spring Boot Auto](docker/auto-instrumentation/spring-boot/) | [Spring Boot Manual](docker/manual-instrumentation/spring-boot/) |
| **Kubernetes** | [Spring Boot Auto](kubernetes/auto-instrumentation/spring-boot/) | [Spring Boot Manual](kubernetes/manual-instrumentation/spring-boot/) |

**Auto-Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (zero code changes, OpenTelemetry Java Agent)

**Manual Instrumentation**: Traces ✅ Metrics ✅ Logs ✅ (full control, custom spans, complete observability)

## OTel Java Agent Deployment Methods

The auto-instrumentation examples use different agent deployment strategies depending on the environment:

| Environment | Agent Deployment | How It Works |
|-------------|-----------------|--------------|
| **Baremetal** | Manual download | Download the agent JAR and pass `-javaagent` flag when running |
| **Docker** | Baked in Dockerfile | Agent downloaded during image build via `ADD` instruction |
| **Kubernetes** | Init container | Agent downloaded at pod startup by an init container into a shared volume |

The Kubernetes init container approach keeps application images clean and decoupled from instrumentation, making it easy to update the agent version or toggle instrumentation without rebuilding images.

## Resources

- [OpenTelemetry Java Documentation](https://opentelemetry.io/docs/languages/java/)
- [OpenTelemetry Java Agent](https://opentelemetry.io/docs/zero-code/java/agent/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
