# PHP Laravel - Manual Instrumentation (Baremetal)

This example demonstrates manual OpenTelemetry instrumentation for a PHP Laravel application running on a local machine (baremetal).

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with full control |
| **Metrics** | ✅ | Manual metric creation |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- PHP 8.2+ installed
- Composer installed
- OpenTelemetry PHP extension (`ext-opentelemetry`) installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

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
export OTEL_SERVICE_NAME=php-laravel-baremetal-manual
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4328
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Explicit endpoints are required for manual instrumentation to send all three signal types (traces, metrics, logs) correctly.

### 4. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 5. Configure Sematext Agent

**Enable OpenTelemetry with traces, metrics, and logs:**

```bash
# Enable all signals individually
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

# Add logs token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type logs \
  --token "YOUR_LOGS_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "my-otel-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
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

### 6. Run the Application

```bash
php artisan serve --host=0.0.0.0 --port=8080
```

The application will start on port 8080.

### 7. Generate Test Traffic

```bash
# Root endpoint
curl http://localhost:8080/

# User endpoint with nested spans
curl http://localhost:8080/users/123

# Slow endpoint with multiple spans
curl http://localhost:8080/slow

# Error endpoint with error tracking
curl http://localhost:8080/error
```

### 8. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App to see custom spans
2. **Metrics**: Open your Sematext Monitoring App to see custom metrics
3. **Logs**: Open your Sematext Logs App to see application logs

## Creating Custom Spans

Manual instrumentation provides full control over span creation:

### Simple Span

```php
use OpenTelemetry\API\Globals;
use OpenTelemetry\API\Trace\SpanKind;
use OpenTelemetry\API\Trace\StatusCode;

$tracer = Globals::tracerProvider()->getTracer('my-app', '1.0.0');

$span = $tracer->spanBuilder('my-operation')
    ->setSpanKind(SpanKind::KIND_SERVER)
    ->startSpan();
$span->setAttribute('key', 'value');
$span->setStatus(StatusCode::STATUS_OK);
$span->end();
```

### Span with Scope (Recommended)

```php
$span = $tracer->spanBuilder('my-operation')
    ->startSpan();
$scope = $span->activate();

try {
    $span->setAttribute('key', 'value');
    // Your code here
    $span->setStatus(StatusCode::STATUS_OK);
} finally {
    $scope->detach();
    $span->end();
}
```

### Nested Spans

```php
$parentSpan = $tracer->spanBuilder('parent-operation')->startSpan();
$parentScope = $parentSpan->activate();

try {
    $childSpan = $tracer->spanBuilder('child-operation')->startSpan();
    $childScope = $childSpan->activate();

    try {
        $childSpan->setAttribute('child.attr', 'value');
        $childSpan->setStatus(StatusCode::STATUS_OK);
    } finally {
        $childScope->detach();
        $childSpan->end();
    }

    $parentSpan->setStatus(StatusCode::STATUS_OK);
} finally {
    $parentScope->detach();
    $parentSpan->end();
}
```

### Database Query Span

```php
$dbSpan = $tracer->spanBuilder('database.lookup')
    ->setSpanKind(SpanKind::KIND_CLIENT)
    ->startSpan();
$dbScope = $dbSpan->activate();

$dbSpan->setAttribute('db.system', 'postgresql');
$dbSpan->setAttribute('db.operation', 'SELECT');
$dbSpan->setAttribute('db.table', 'users');
$dbSpan->setAttribute('user.id', $userId);

// ... database operation ...

$dbSpan->setStatus(StatusCode::STATUS_OK);
$dbScope->detach();
$dbSpan->end();
```

### Error Handling

```php
try {
    // Your code
    $span->setStatus(StatusCode::STATUS_OK);
} catch (\Throwable $e) {
    $span->recordException($e);
    $span->setStatus(StatusCode::STATUS_ERROR, $e->getMessage());
}
```

## Creating Custom Metrics

### Counter Metric

```php
$meter = Globals::meterProvider()->getMeter('my-app', '1.0.0');

$requestCounter = $meter->createCounter(
    'http.server.requests',
    '1',
    'Total number of HTTP requests'
);

$requestCounter->add(1, ['endpoint' => '/', 'method' => 'GET']);
```

### Histogram Metric

```php
$requestDuration = $meter->createHistogram(
    'http.server.duration',
    'ms',
    'HTTP request duration'
);

$duration = (microtime(true) - $startTime) * 1000;
$requestDuration->record($duration, ['endpoint' => '/', 'method' => 'GET']);
```

### UpDownCounter Metric

```php
$activeRequests = $meter->createUpDownCounter(
    'http.server.active_requests',
    '1',
    'Number of active HTTP requests'
);

$activeRequests->add(1, ['endpoint' => '/']);   // Increment
$activeRequests->add(-1, ['endpoint' => '/']);  // Decrement
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `php-laravel-baremetal-manual` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Yes | `http://localhost:4328` | OTLP endpoint for logs |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |
| `PORT` | No | `8080` | Application port |

## Comparing with Auto-Instrumentation

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

## Troubleshooting

### No Custom Spans Appearing

1. **Verify OpenTelemetry is initialized**:
   Check console for "OpenTelemetry Manual Instrumentation Configured" message

2. **Ensure spans are ended**:
   ```php
   $span->end();  // Always end your spans!
   ```

3. **Ensure scopes are detached**:
   ```php
   $scope->detach();  // Always detach scopes!
   ```

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

3. **Check application logs** for OpenTelemetry configuration output

### Port Already in Use

Change the port:

```bash
php artisan serve --host=0.0.0.0 --port=3000
```

## Next Steps

- **Try Auto**: See [Auto-Instrumentation baremetal example](../../auto-instrumentation/laravel/)
- **Add database**: Instrument PDO/MySQL queries
- **Deploy to Docker**: See [Docker example](../../../docker/manual-instrumentation/laravel/)
- **Deploy to Kubernetes**: See [Kubernetes example](../../../kubernetes/manual-instrumentation/laravel/)

## Resources

- [OpenTelemetry PHP Documentation](https://opentelemetry.io/docs/languages/php/)
- [OpenTelemetry PHP Manual Instrumentation](https://opentelemetry.io/docs/languages/php/instrumentation/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
