# PHP Laravel - Auto-Instrumentation (Baremetal)

This example demonstrates automatic OpenTelemetry instrumentation for a PHP Laravel application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Laravel instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../manual-instrumentation/laravel/) for logs support |

## Prerequisites

- PHP 8.2+ installed
- Composer installed
- OpenTelemetry PHP extension (`ext-opentelemetry`) installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring)

## Quick Start

### 1. Install the OpenTelemetry PHP Extension

```bash
pecl install opentelemetry
```

Add to your `php.ini`:
```ini
extension=opentelemetry.so
```

Verify installation:
```bash
php -m | grep opentelemetry
```

### 2. Install Dependencies

```bash
composer install
```

### 3. Configure Environment

Set environment variables for OpenTelemetry:

```bash
export OTEL_PHP_AUTOLOAD_ENABLED=true
export OTEL_SERVICE_NAME=php-laravel-baremetal-auto
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_TRACES_EXPORTER=otlp
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=none
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: `OTEL_PHP_AUTOLOAD_ENABLED=true` is required for the PHP SDK to auto-bootstrap. Traces use port 4338, metrics use port 4318.

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
php artisan serve --host=0.0.0.0 --port=8080
```

The application will start on port 8080. The OpenTelemetry extension and auto-instrumentation packages automatically configure instrumentation based on environment variables.

### 7. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8080/

# User endpoint
curl http://localhost:8080/users/123

# Slow endpoint
curl http://localhost:8080/slow

# Error endpoint
curl http://localhost:8080/error
```

### 8. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see distributed traces
2. **Metrics**: Open your Sematext Monitoring App to see HTTP metrics

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/laravel/).

## How Auto-Instrumentation Works

### Automatic Instrumentation

The `open-telemetry/opentelemetry-auto-laravel` package automatically instruments:

- **HTTP**: Laravel request/response handling
- **Laravel**: Route handlers and middleware
- **PDO**: Database operations (if used)

No code changes required in your application logic!

### Configuration

The auto-instrumentation uses environment variables to configure OpenTelemetry:

- `OTEL_PHP_AUTOLOAD_ENABLED`: Must be `true` to enable SDK auto-bootstrap
- `OTEL_SERVICE_NAME`: Service name
- `OTEL_TRACES_EXPORTER`: Exporter type for traces (`otlp`)
- `OTEL_METRICS_EXPORTER`: Exporter type for metrics (`otlp`)
- `OTEL_LOGS_EXPORTER`: Exporter type for logs (`none` for auto)
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`: Traces endpoint
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT`: Metrics endpoint
- `OTEL_EXPORTER_OTLP_PROTOCOL`: Protocol (http/protobuf)

### Adding Custom Attributes

While auto-instrumentation handles most tracing, you can add custom attributes:

```php
use OpenTelemetry\API\Trace\Span;

$span = Span::getCurrent();
$span->setAttribute('user.id', $userId);
$span->setAttribute('operation', 'get_user');
```

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint - returns welcome message |
| `/users/<id>` | GET | Get user by ID (with custom span attributes) |
| `/slow` | GET | Slow endpoint - simulates 2s latency |
| `/error` | GET | Error endpoint - throws intentional error |
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_PHP_AUTOLOAD_ENABLED` | Yes | - | Must be `true` to enable SDK auto-bootstrap |
| `OTEL_SERVICE_NAME` | Yes | `php-laravel-baremetal-auto` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_TRACES_EXPORTER` | Yes | `otlp` | Exporter type for traces |
| `OTEL_METRICS_EXPORTER` | Yes | `otlp` | Exporter type for metrics |
| `OTEL_LOGS_EXPORTER` | No | `none` | Exporter type for logs (none for auto) |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |
| `PORT` | No | `8080` | Application port |

## Troubleshooting

### No Data in Sematext

1. **Check agent is running**:
   ```bash
   sudo systemctl status sematext-agent
   ```

2. **Verify service name matches**:
   ```bash
   echo $OTEL_SERVICE_NAME
   cat /opt/spm/properties/otel.yml
   ```

3. **Check application logs** for OpenTelemetry initialization messages

### Port Already in Use

Change the port:

```bash
php artisan serve --host=0.0.0.0 --port=3000
```

### Logs Not Appearing

Auto-instrumentation does not support OTLP log export. For logs with OTLP export, use [manual instrumentation](../../manual-instrumentation/laravel/).

### Extension Not Found

Ensure `ext-opentelemetry` is installed:

```bash
pecl install opentelemetry
php -m | grep opentelemetry
```

## Comparing with Manual Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Install extension + packages | Configure SDK manually |
| **Code Changes** | None required | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Metrics** | HTTP metrics | Custom metrics |
| **Logs** | Not supported | Full OTLP support |
| **Overhead** | Slightly higher | Lower |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs |

## Next Steps

- **Try Manual**: See [Manual Instrumentation baremetal example](../../manual-instrumentation/laravel/)
- **Add database**: Install PDO/MySQL instrumentation
- **Deploy to Docker**: See [Docker example](../../../docker/auto-instrumentation/laravel/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/auto-instrumentation/laravel/)

## Resources

- [OpenTelemetry PHP Documentation](https://opentelemetry.io/docs/languages/php/)
- [OpenTelemetry PHP Auto-instrumentation](https://opentelemetry.io/docs/zero-code/php/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
