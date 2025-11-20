# .NET ASP.NET Core - Auto-Instrumentation (Baremetal)

This example demonstrates automatic OpenTelemetry instrumentation for a .NET ASP.NET Core application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and ASP.NET Core instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../../manual-instrumentation/aspnetcore/) for logs support |

## Prerequisites

- .NET 8.0 SDK or later installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring)

## Quick Start

### 1. Build the Application

```bash
dotnet build
```

### 2. Download OpenTelemetry .NET Automatic Instrumentation

Download the latest release (v1.12.0) from GitHub:

```bash
# Linux
curl -L -o otel-dotnet-auto.zip \
  https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/download/v1.12.0/opentelemetry-dotnet-instrumentation-linux-glibc-x64.zip

# Extract
unzip otel-dotnet-auto.zip -d $HOME/.otel-dotnet-auto

# macOS
curl -L -o otel-dotnet-auto.zip \
  https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/download/v1.12.0/opentelemetry-dotnet-instrumentation-macos.zip

unzip otel-dotnet-auto.zip -d $HOME/.otel-dotnet-auto
```

### 3. Configure Environment

Set environment variables for OpenTelemetry automatic instrumentation:

```bash
# Linux
export CORECLR_ENABLE_PROFILING=1
export CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
export CORECLR_PROFILER_PATH=$HOME/.otel-dotnet-auto/linux-x64/OpenTelemetry.AutoInstrumentation.Native.so
export DOTNET_ADDITIONAL_DEPS=$HOME/.otel-dotnet-auto/AdditionalDeps
export DOTNET_SHARED_STORE=$HOME/.otel-dotnet-auto/store
export DOTNET_STARTUP_HOOKS=$HOME/.otel-dotnet-auto/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll
export OTEL_DOTNET_AUTO_HOME=$HOME/.otel-dotnet-auto

# macOS
export CORECLR_ENABLE_PROFILING=1
export CORECLR_PROFILER={918728DD-259F-4A6A-AC2B-B85E1B658318}
export CORECLR_PROFILER_PATH=$HOME/.otel-dotnet-auto/osx-x64/OpenTelemetry.AutoInstrumentation.Native.dylib
export DOTNET_ADDITIONAL_DEPS=$HOME/.otel-dotnet-auto/AdditionalDeps
export DOTNET_SHARED_STORE=$HOME/.otel-dotnet-auto/store
export DOTNET_STARTUP_HOOKS=$HOME/.otel-dotnet-auto/net/OpenTelemetry.AutoInstrumentation.StartupHook.dll
export OTEL_DOTNET_AUTO_HOME=$HOME/.otel-dotnet-auto
```

**Configure OpenTelemetry settings:**

```bash
export OTEL_SERVICE_NAME=dotnet-aspnetcore-baremetal-auto
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Traces use port 4338, metrics use port 4318.

### 4. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 5. Configure Sematext Agent

**Enable OpenTelemetry with traces and metrics:**

```bash
# Enable traces and metrics individually
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type traces
sudo /opt/spm/spm-monitor/bin/st-agent otel enable --type metrics
```

**Configure token group with your Sematext App tokens:**

```bash
# Add traces token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-token-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-token-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --all-services \
  --token-group "my-token-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 6. Run the Application

```bash
dotnet run
```

The application will start on port 8080 with automatic instrumentation enabled.

### 7. Generate Test Traffic

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

### 8. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see distributed traces
2. **Metrics**: Open your Sematext Monitoring App to see HTTP metrics

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/aspnetcore/).

## How Auto-Instrumentation Works

### Automatic Instrumentation

The OpenTelemetry .NET Automatic Instrumentation uses CLR profiling to automatically instrument:

- **HTTP**: ASP.NET Core request/response handling
- **HttpClient**: Outgoing HTTP calls
- **Database**: SQL Server, PostgreSQL, MySQL queries (if used)
- **Messaging**: Various message queue libraries (if used)

No code changes required in your application logic!

### Configuration

All configuration is done via environment variables:

- `CORECLR_*`: Enable CLR profiler and point to instrumentation libraries
- `DOTNET_*`: Configure .NET runtime to load instrumentation
- `OTEL_*`: Configure OpenTelemetry settings (service name, endpoints, protocol)

## Troubleshooting

### Application not starting

1. Verify .NET SDK is installed:
```bash
dotnet --version
```

2. Check if OpenTelemetry instrumentation was extracted correctly:
```bash
ls -la $HOME/.otel-dotnet-auto/
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
env | grep CORECLR
env | grep DOTNET
```

4. Verify tokens are configured correctly:
```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups list
sudo /opt/spm/spm-monitor/bin/st-agent otel services list
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

- Try [manual instrumentation](../../manual-instrumentation/aspnetcore/) for custom spans and logs
- Deploy to Docker with [Docker examples](../../docker/)
- Deploy to Kubernetes with [Kubernetes examples](../../kubernetes/)
