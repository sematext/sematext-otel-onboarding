# PHP Laravel - Manual Instrumentation (Docker)

This example demonstrates manual OpenTelemetry instrumentation for a PHP Laravel application running in Docker containers with full control over traces, metrics, and logs.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with custom attributes |
| **Metrics** | ✅ | Custom metrics (counters, histograms, gauges) |
| **Logs** | ✅ | Full OTLP logs export with trace correlation |

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
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_MY_TOKEN_GROUP_SERVICES=all-services
```

Get your tokens from each App in Sematext Cloud.

**Note**: Metrics are commented out by default. To enable metrics, uncomment:
```yaml
- OTEL_METRICS_ENABLED=true
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
```

### 2. Start the Stack

```bash
docker-compose up -d
```

This starts two containers:
- **sematext-agent**: Receives telemetry and forwards to Sematext Cloud
- **php-app**: Your instrumented application

### 3. Verify Containers are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS
sematext-agent      ...                 Up
php-app             ...                 Up
```

### 4. Generate Test Traffic

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

### 5. View Logs

```bash
# Application logs
docker-compose logs -f php-app

# Agent logs
docker-compose logs -f sematext-agent
```

### 6. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App - see custom spans with nested operations
2. **Metrics**: Open your Sematext Monitoring App - view custom metrics
3. **Logs**: Open your Sematext Logs App - see correlated logs with trace IDs

## Docker Compose Architecture

```
┌─────────────────┐         ┌──────────────────┐
│                 │  OTLP   │                  │
│  php-app        │────────▶│  sematext-agent  │─────▶ Sematext Cloud
│  (port 8080)    │         │  (ports 4317-    │
│                 │         │   4338)          │
└─────────────────┘         └──────────────────┘
```

The application sends telemetry to the agent via OTLP HTTP endpoints:
- Traces: `http://sematext-agent:4338/v1/traces`
- Metrics: `http://sematext-agent:4318/v1/metrics`
- Logs: `http://sematext-agent:4328/v1/logs`

## Configuration

### Application Service

The `php-app` service is configured in `docker-compose.yaml`:

```yaml
php-app:
  build: .
  ports:
    - "8080:8080"
  environment:
    - OTEL_SERVICE_NAME=php-laravel-docker-manual
    - OTEL_SERVICE_VERSION=1.0.0
    - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://sematext-agent:4338
    - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://sematext-agent:4318
    - OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://sematext-agent:4328
    - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
  depends_on:
    - sematext-agent
```

**Key points:**
- Uses service name `sematext-agent` (Docker DNS resolution)
- Separate OTLP endpoints for traces (4338), metrics (4318), and logs (4328)
- All signals sent via HTTP/protobuf protocol
- Manual instrumentation configured in `app/OpenTelemetry/OtelConfig.php`
- Depends on agent starting first
- Exposes port 8080 to host

### Agent Service

The `sematext-agent` service configuration:

```yaml
sematext-agent:
  image: sematext/agent:latest-4
  environment:
    - OTEL_ENABLED=true
    - OTEL_LOGS_ENABLED=true
    - OTEL_TRACES_ENABLED=true
    - OTEL_MY_TOKEN_GROUP_SERVICES=all-services
  ports:
    - "4317:4317"  # Metrics gRPC
    - "4318:4318"  # Metrics HTTP
    - "4327:4327"  # Logs gRPC
    - "4328:4328"  # Logs HTTP
    - "4337:4337"  # Traces gRPC
    - "4338:4338"  # Traces HTTP
```

## Dockerfile

The application uses a PHP CLI image with the OpenTelemetry extension:

```dockerfile
FROM php:8.3-cli

RUN pecl install opentelemetry && docker-php-ext-enable opentelemetry

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /app
COPY composer.json .
RUN composer install --no-dev --optimize-autoloader
COPY . .

EXPOSE 8080
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8080"]
```

**Key points:**
- Uses `php:8.3-cli` base image
- Installs `ext-opentelemetry` via PECL
- Installs OpenTelemetry SDK and OTLP exporters
- Includes both application code and `OtelConfig.php`
- Runs directly with Laravel's built-in server (instrumentation configured in code)

## Manual Instrumentation Features

### Custom Traces
The application creates manual spans with custom attributes:

```php
$tracer = Globals::tracerProvider()->getTracer('php-laravel-manual', '1.0.0');

$span = $tracer->spanBuilder('get-user-operation')
    ->setSpanKind(SpanKind::KIND_SERVER)
    ->startSpan();
$scope = $span->activate();

try {
    $span->setAttribute('user.id', $userId);
    $span->setAttribute('operation', 'get_user');

    // Nested spans for detailed tracing
    $dbSpan = $tracer->spanBuilder('database.lookup')
        ->setSpanKind(SpanKind::KIND_CLIENT)
        ->startSpan();
    $dbScope = $dbSpan->activate();

    $dbSpan->setAttribute('db.system', 'postgresql');
    $dbSpan->setAttribute('db.operation', 'SELECT');
    $dbSpan->setAttribute('db.table', 'users');

    // ... database operation ...

    $dbScope->detach();
    $dbSpan->end();
} finally {
    $scope->detach();
    $span->end();
}
```

### Custom Metrics
The application tracks custom metrics:

```php
$meter = Globals::meterProvider()->getMeter('php-laravel-manual', '1.0.0');

// Counter for total requests
$requestCounter = $meter->createCounter('http.server.requests');
$requestCounter->add(1, ['endpoint' => '/', 'status' => 200]);

// Histogram for request duration
$requestDuration = $meter->createHistogram('http.server.duration');
$requestDuration->record($durationMs, ['endpoint' => '/', 'status' => 200]);

// UpDownCounter for active requests
$activeRequests = $meter->createUpDownCounter('http.server.active_requests');
$activeRequests->add(1, ['endpoint' => '/']);   // Increment
$activeRequests->add(-1, ['endpoint' => '/']);  // Decrement
```

### Structured Logs with Trace Correlation
Logs automatically include trace IDs for correlation:

```php
private function emitLog(string $level, string $message, array $context = []): void
{
    $span = Span::getCurrent();
    if ($span->getContext()->isValid()) {
        $spanContext = $span->getContext();
        $context['trace_id'] = $spanContext->getTraceId();
        $context['span_id'] = $spanContext->getSpanId();
    }

    error_log("[{$level}] {$message} " . json_encode($context));
}
```

## What Gets Instrumented Manually

### Traces
- **Manual Spans**: Created explicitly with `spanBuilder()->startSpan()`
- **Nested Operations**: Database queries, API calls, business logic
- **Custom Attributes**: User IDs, operation types, metadata
- **Error Tracking**: Explicit exception recording with `recordException()`

### Metrics
- **Request Counter**: Total HTTP requests by endpoint and status
- **Request Duration**: HTTP request duration histogram
- **Active Requests**: Gauge for current active requests

### Logs
- **Structured Logging**: JSON-formatted logs with metadata
- **Trace Correlation**: Automatic trace_id and span_id injection
- **Log Levels**: INFO, WARNING, ERROR, DEBUG
- **Custom Fields**: User IDs, operation metadata, errors

## Building Custom Image

To build and run with a custom tag:

```bash
# Build image
docker build -t my-php-app:1.0 .

# Update docker-compose.yaml
# Change: build: .
# To:     image: my-php-app:1.0

# Run
docker-compose up -d
```

## Environment Variables

### Application Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_SERVICE_NAME` | `php-laravel-docker-manual` | Service identifier |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://sematext-agent:4338` | Traces endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://sematext-agent:4318` | Metrics endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | `http://sematext-agent:4328` | Logs endpoint (Docker DNS) |
| `PORT` | `8080` | Application port |

### Agent Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_ENABLED` | `true` | Enable OpenTelemetry |
| `OTEL_METRICS_ENABLED` | `true` | Enable metrics (port 4318) |
| `OTEL_LOGS_ENABLED` | `true` | Enable logs (port 4328) |
| `OTEL_TRACES_ENABLED` | `true` | Enable traces (port 4338) |
| `OTEL_MY_TOKEN_GROUP_*` | Token values | Sematext App tokens |

## Common Tasks

### View Application Logs

```bash
docker-compose logs -f php-app
```

### View Agent Logs

```bash
docker-compose logs -f sematext-agent
```

### Restart Services

```bash
docker-compose restart
```

### Stop and Remove

```bash
docker-compose down
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Inspect a Running Container

```bash
docker-compose exec php-app bash
```

## Troubleshooting

### No Data in Sematext

1. **Check service name matches**:
   ```bash
   docker-compose exec php-app env | grep OTEL_SERVICE_NAME
   ```

2. **Verify agent is running**:
   ```bash
   docker-compose ps sematext-agent
   ```

3. **Check agent logs for errors**:
   ```bash
   docker-compose logs sematext-agent | grep ERROR
   ```

4. **Test connectivity**:
   ```bash
   docker-compose exec php-app curl -v http://sematext-agent:4338
   ```

5. **Verify OTLP endpoints**:
   ```bash
   docker-compose exec php-app env | grep OTLP
   ```

### Application Won't Start

1. **Check application logs**:
   ```bash
   docker-compose logs php-app
   ```

2. **Verify port not in use**:
   ```bash
   lsof -i :8080  # On host
   ```

3. **Check build errors**:
   ```bash
   docker-compose build php-app
   ```

4. **Verify PHP extensions**:
   ```bash
   docker-compose run --rm php-app php -m | grep opentelemetry
   ```

### No Logs in Sematext

1. **Check logs endpoint**:
   ```bash
   docker-compose exec php-app env | grep LOGS_ENDPOINT
   ```
   Should be: `http://sematext-agent:4328`

2. **Verify logs token**:
   Check that `OTEL_MY_TOKEN_GROUP_LOGS_TOKEN` is set in agent config

3. **Check log output**:
   ```bash
   docker-compose logs php-app | grep -i "error\|warning\|info"
   ```

### Custom Metrics Not Appearing

1. **Check metric export interval** (default 60 seconds):
   Wait at least 1 minute after generating traffic

2. **Verify metrics endpoint**:
   ```bash
   docker-compose exec php-app env | grep METRICS_ENDPOINT
   ```

3. **Enable metrics in agent**:
   Uncomment `OTEL_METRICS_ENABLED=true` in docker-compose.yaml

## Production Considerations

### Use Secrets for Tokens

Don't hardcode tokens in docker-compose.yaml. Use Docker secrets or environment files:

```bash
# Create .env file (add to .gitignore!)
MONITORING_TOKEN=your-monitoring-token
LOGS_TOKEN=your-logs-token
TRACES_TOKEN=your-traces-token
```

```yaml
# In docker-compose.yaml
environment:
  - OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=${MONITORING_TOKEN}
  - OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=${LOGS_TOKEN}
  - OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=${TRACES_TOKEN}
```

### Resource Limits

Add resource constraints:

```yaml
php-app:
  # ... other config ...
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 512M
      reservations:
        cpus: '0.25'
        memory: 256M
```

### Health Checks

Add Docker health checks:

```yaml
php-app:
  # ... other config ...
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Use Production Server

For production, use PHP-FPM with Nginx instead of `artisan serve`:

```dockerfile
FROM php:8.3-fpm
# ... install extensions and dependencies ...
```

## Comparing with Auto-Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Install extension + packages | Configure SDK explicitly |
| **Code Changes** | Minimal | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Nested Spans** | Basic | Deep nesting with custom spans |
| **Metrics** | HTTP metrics only | Custom metrics (counters, histograms, gauges) |
| **Logs** | Not supported | Full OTLP logs with trace correlation |
| **Overhead** | Slightly higher | Lower (optimized) |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs, production |

## Advanced Usage

### Add Database Instrumentation

To instrument PDO/MySQL:

```php
// In OtelConfig.php or a service provider
// PDO is auto-instrumented when using open-telemetry/opentelemetry-auto-pdo
```

Add to `composer.json`:
```json
"open-telemetry/opentelemetry-auto-pdo": "^0.0.11"
```

### Add Redis Instrumentation

Add to `composer.json`:
```json
"open-telemetry/opentelemetry-auto-predis": "^0.0.4"
```

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes example](../../kubernetes/manual-instrumentation/laravel/)
- **Add databases**: Extend docker-compose with PostgreSQL, MongoDB, etc.
- **Compare with auto**: See [Auto Docker example](../../auto-instrumentation/laravel/)
- **Customize metrics**: Add business-specific metrics and dashboards

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [OpenTelemetry PHP](https://opentelemetry.io/docs/languages/php/)
- [OpenTelemetry PHP Manual Instrumentation](https://opentelemetry.io/docs/languages/php/instrumentation/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
