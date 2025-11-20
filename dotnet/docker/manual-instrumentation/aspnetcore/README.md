# .NET ASP.NET Core - Manual Instrumentation (Docker)

This example demonstrates manual OpenTelemetry instrumentation for a .NET ASP.NET Core application running in Docker containers.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual spans with custom attributes |
| **Metrics** | ✅ | Custom metrics with manual instrumentation |
| **Logs** | ✅ | Correlated logs with trace context |

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Update Configuration in docker-compose.yaml

Edit `docker-compose.yaml` and update:

**Infrastructure Token** - Replace with your Sematext Infrastructure token:
```yaml
- INFRA_TOKEN=your-infra-token
```

**Region** - Set based on your Sematext Cloud region:
```yaml
- REGION=US  # US for Sematext Cloud US, EU for Sematext Cloud EU
```

**App Tokens** - Replace with your actual Sematext App tokens:
```yaml
- OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_MY_TOKEN_GROUP_SERVICES="all-services"
```

Get your tokens from each App in Sematext Cloud.

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **sematext-agent**: Receives telemetry and forwards to Sematext Cloud
- **dotnet-app**: Your instrumented application

### 3. Verify Containers are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS
sematext-agent      ...                 Up
dotnet-app          ...                 Up
```

### 4. Generate Test Traffic

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

### 5. View Logs

```bash
# Application logs
docker-compose logs -f dotnet-app

# Agent logs
docker-compose logs -f sematext-agent
```

### 6. View in Sematext Cloud

Navigate to your Sematext Cloud Apps:
- **Tracing App**: View distributed traces with custom spans
- **Monitoring App**: View custom metrics
- **Logs App**: View correlated logs

Look for the service name: `dotnet-aspnetcore-docker-manual`

## Application Structure

```
.
├── Controllers/
│   └── DemoController.cs      # Controller with manual instrumentation
├── Services/
│   └── OpenTelemetryConfig.cs # OpenTelemetry configuration
├── Dockerfile                  # Multi-stage build
├── docker-compose.yaml         # Docker Compose configuration
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

### Container not starting

Check application logs for errors:
```bash
docker-compose logs dotnet-app
```

### No traces appearing

1. Verify Sematext agent is running:
```bash
docker-compose ps sematext-agent
```

2. Check agent logs for errors:
```bash
docker-compose logs sematext-agent
```

3. Verify tokens are correct in `docker-compose.yaml`

4. Ensure the region (US/EU) matches your Sematext Cloud account

### No logs appearing

1. Verify logs are enabled in docker-compose.yaml:
```yaml
- OTEL_LOGS_ENABLED=true
```

2. Check if logs endpoint is configured correctly:
```yaml
- OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://sematext-agent:4328/v1/logs
```

3. Verify logs token is set:
```yaml
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
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

Stop and remove containers:
```bash
docker-compose down
```

Remove built images:
```bash
docker-compose down --rmi local
```

## Next Steps

- Deploy to Kubernetes with [Kubernetes examples](../../kubernetes/)
- Add custom instrumentation for your specific use case
- Configure sampling rates
- Add custom resource attributes
