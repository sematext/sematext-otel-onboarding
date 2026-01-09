# .NET ASP.NET Core - Auto-Instrumentation (Docker)

This example demonstrates automatic OpenTelemetry instrumentation for a .NET ASP.NET Core application running in Docker containers using OpenTelemetry .NET Automatic Instrumentation.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and ASP.NET Core instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../../manual-instrumentation/aspnetcore/) for logs support |

## Prerequisites

- Docker installed
- Docker Compose installed
- Sematext Cloud account with Apps created (Tracing, Monitoring)

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
- OTEL_MY_TOKEN_GROUP_SERVICES=all-services
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

# Users endpoint
curl http://localhost:8080/api/users/123

# Slow endpoint
curl http://localhost:8080/api/slow

# Error endpoint
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
- **Tracing App**: View distributed traces
- **Monitoring App**: View metrics

Look for the service name: `dotnet-aspnetcore-docker-auto`

## Application Structure

```
.
├── Dockerfile                 # Multi-stage build with OpenTelemetry .NET auto-instrumentation
├── docker-compose.yaml        # Docker Compose configuration
├── Program.cs                 # Application entry point
├── dotnet-app.csproj         # Project file
└── README.md                  # This file
```

## How Auto-Instrumentation Works

The application uses OpenTelemetry .NET Automatic Instrumentation (v1.12.0) to automatically capture telemetry without code changes:

1. **Download**: Dockerfile downloads the instrumentation package from GitHub releases
2. **Configure**: Environment variables enable the profiler and configure paths
3. **Inject**: CLR profiler injects instrumentation at runtime
4. **Export**: Telemetry is automatically exported via OTLP to Sematext agent

Key environment variables in the Dockerfile:
```dockerfile
ENV CORECLR_ENABLE_PROFILING=1
ENV CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
ENV CORECLR_PROFILER_PATH=/otel-dotnet-auto/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so
ENV DOTNET_ADDITIONAL_DEPS=/otel-dotnet-auto/AdditionalDeps
ENV DOTNET_SHARED_STORE=/otel-dotnet-auto/store
ENV DOTNET_STARTUP_HOOKS=/otel-dotnet-auto/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll
ENV OTEL_DOTNET_AUTO_HOME=/otel-dotnet-auto
```

## What Gets Instrumented

The automatic instrumentation captures:

**HTTP Requests**:
- Request method, URL, status code
- Response time
- Headers (configurable)

**Database Queries**:
- SQL Server, PostgreSQL, MySQL (if used)
- Query execution time
- Database name

**External HTTP Calls**:
- HttpClient requests
- Response times
- Status codes

## Troubleshooting

### Container not starting

Check if the OpenTelemetry instrumentation was downloaded successfully:
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

- Try [manual instrumentation](../../manual-instrumentation/aspnetcore/) for custom spans and logs
- Deploy to Kubernetes with [Kubernetes examples](../../kubernetes/)
- Add custom attributes to spans
- Configure sampling rates
