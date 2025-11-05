# Sematext OpenTelemetry Examples

Examples demonstrating OpenTelemetry instrumentation for applications sending telemetry to Sematext Cloud Apps (Tracing App, Monitoring App, Logs App).

## Overview

This repository provides practical examples of how to instrument applications with OpenTelemetry and send traces, metrics, and logs to Sematext Cloud using the [Sematext Agent](https://sematext.com/docs/agents/sematext-agent/opentelemetry/).

## Quick Start

1. **Pick a language** from the table below (click the link)
2. **Read the language README** - it contains all auto/manual instrumentation options and deployment environments
3. **Follow the instructions** in your chosen example

## Examples by Language

| Language | Framework |
|----------|-----------|
| **[Node.js](nodejs/)** | Express |
| **[Java](java/)** | Spring Boot |
| **[Python](python/)** | Flask |
| **[.NET](dotnet/)** | ASP.NET Core |
| **[Go](go/)** | Gin |
| **[PHP](php/)** | Laravel |
| **[Ruby](ruby/)** | Sinatra |

**Note**: Only Node.js examples are currently implemented. Other languages will follow the same structure (baremetal/docker/kubernetes with auto and manual instrumentation).

## Telemetry Data

- **Traces** ✅ - Distributed tracing shows request flow across services
- **Metrics** ✅ - Application and infrastructure metrics (latency, throughput, errors)
- **Logs** - Application logs correlated with traces
  - ❌ Not available with auto-instrumentation
  - ✅ Available with manual instrumentation

## Sematext Cloud

These examples send telemetry to Sematext Cloud Apps:

- **Sematext Tracing App** - Distributed tracing and application performance monitoring
- **Sematext Monitoring App** - Metrics and infrastructure monitoring
- **Sematext Logs App** - Log management and analysis

[Sign up for free](https://sematext.com/cloud/) to get started.

## Resources

- [Sematext Documentation](https://sematext.com/docs/)
- [Sematext Agent OpenTelemetry](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [Sematext Tracing](https://sematext.com/docs/tracing/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [OpenTelemetry Zero-code Instrumentation](https://opentelemetry.io/docs/zero-code/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
