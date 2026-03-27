# .NET ASP.NET Core - Manual Instrumentation (Baremetal)

This example demonstrates manual OpenTelemetry instrumentation for a .NET ASP.NET Core application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual spans with custom attributes |
| **Metrics** | ✅ | Custom metrics with manual instrumentation |
| **Logs** | ✅ | Correlated logs with trace context |

## Prerequisites

- .NET 8.0 SDK or later installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Build the Application

```bash
dotnet build
```

### 2. Configure Environment

Set environment variables for OpenTelemetry:

```bash
export OTEL_SERVICE_NAME=dotnet-aspnetcore-baremetal-manual
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4328/v1/logs
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Traces use port 4338, metrics use port 4318, logs use port 4328.

### 3. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 4. Configure Sematext Agent

**Enable OpenTelemetry with traces, metrics, and logs:**

```bash
# Enable traces, metrics, and logs individually
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type traces
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type metrics
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type logs
```

**Configure token group with your Sematext App tokens:**

```bash
# Add traces token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"

# Add logs token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type logs \
  --token "YOUR_LOGS_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --all-services \
  --token-group "my-otel-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 5. Run the Application

```bash
dotnet run
```

The application will start on port 8080 with manual instrumentation enabled.

### 6. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8080/

# Users endpoint with custom span
curl http://localhost:8080/api/users/123

# Slow endpoint with nested spans
curl http://localhost:8080/api/slow

# Error endpoint with exception tracking
curl http://localhost:8080/api/error
```

### 7. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see distributed traces with custom spans
2. **Metrics**: Open your Sematext Monitoring App to see custom metrics
3. **Logs**: Open your Sematext Logs App to see correlated logs

## Application Structure

```
.
├── Controllers/
│   └── DemoController.cs      # Controller with manual instrumentation
├── Services/
│   └── OpenTelemetryConfig.cs # OpenTelemetry configuration
├── Program.cs                  # Application entry point
├── dotnet-app.csproj          # Project file with OpenTelemetry packages
└── README.md                   # This file
```

## Manual Instrumentation Features

### Custom Spans

Create custom spans with attributes:

```csharp
using var activity = _activitySource.StartActivity("custom-operation", ActivityKind.Server);
activity?.SetTag("custom.attribute", "value");
activity?.SetStatus(ActivityStatusCode.Ok);
```

### Nested Spans

Create nested spans to track sub-operations:

```csharp
using var parentActivity = _activitySource.StartActivity("parent-operation");

using (var childActivity = _activitySource.StartActivity("child-operation"))
{
    // Child operation logic
    childActivity?.SetTag("operation.type", "database");
}
```

### Exception Tracking

Record exceptions in spans:

```csharp
try
{
    // Operation that might throw
}
catch (Exception ex)
{
    activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
    activity?.AddException(ex);
    _logger.LogError(ex, "Error occurred");
}
```

### Custom Metrics

Create custom metrics:

```csharp
var meter = new Meter("DotnetApp.Manual", "1.0.0");
var counter = meter.CreateCounter<long>("http.server.requests");
counter.Add(1,
    new KeyValuePair<string, object?>("endpoint", "/"),
    new KeyValuePair<string, object?>("status", 200));
```

### Correlated Logs

Logs are automatically correlated with traces:

```csharp
_logger.LogInformation("Processing user {UserId}", id);
// This log will include TraceId and SpanId automatically
```

## OpenTelemetry Configuration

The `Services/OpenTelemetryConfig.cs` file configures:

- **Traces**: ASP.NET Core, HttpClient, and custom spans
- **Metrics**: ASP.NET Core, HttpClient, Runtime, and custom metrics
- **Logs**: OTLP exporter with formatted messages and scopes

Configuration is done using the unified `AddOpenTelemetry()` builder:

```csharp
services.AddOpenTelemetry()
    .ConfigureResource(resource => ...)
    .WithTracing(tracing => ...)
    .WithMetrics(metrics => ...)
    .WithLogging(logging => ...);
```

## Troubleshooting

### Application not starting

1. Verify .NET SDK is installed:
```bash
dotnet --version
```

2. Check application logs for errors:
```bash
dotnet run
```

### No traces appearing

1. Verify Sematext agent is running:
```bash
sudo systemctl status sematext-agent
```

2. Check agent logs:
```bash
sudo journalctl -u sematext-agent -f
```

3. Verify environment variables are set:
```bash
env | grep OTEL
```

4. Verify tokens are configured correctly:
```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups list
sudo /opt/spm/spm-monitor/bin/st-agent otel services list
```

### No logs appearing

1. Verify logs are enabled in agent:
```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel status
```

2. Check if logs endpoint is configured correctly:
```bash
echo $OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
```

3. Verify logs token is set:
```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups list
```

### Testing locally

Generate continuous traffic for testing:
```bash
while true; do
  curl http://localhost:8080/
  curl http://localhost:8080/api/users/$((RANDOM % 100))
  curl http://localhost:8080/api/slow
  curl http://localhost:8080/api/error
  sleep 2
done
```

## Cleanup

Stop the application with Ctrl+C.

## Next Steps

- Deploy to Docker with [Docker examples](../../docker/)
- Deploy to Kubernetes with [Kubernetes examples](../../kubernetes/)
- Add custom instrumentation for your specific use case
- Configure sampling rates
- Add custom resource attributes
