# PHP Laravel - Auto-Instrumentation (Docker)

This example demonstrates automatic OpenTelemetry instrumentation for a PHP Laravel application running in Docker containers.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Laravel instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../../manual-instrumentation/laravel/) for logs support |

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
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
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

1. **Traces**: Open your Sematext Tracing App
2. **Metrics**: Open your Sematext Monitoring App

**Note**: Logs are not supported in auto-instrumentation. For logs support, see the [manual instrumentation example](../../manual-instrumentation/laravel/).

## Docker Compose Architecture

```
┌─────────────────┐         ┌──────────────────┐
│                 │  OTLP   │                  │
│  php-app        │────────▶│  sematext-agent  │─────▶ Sematext Cloud
│  (port 8080)    │         │  (ports 4317-    │
│                 │         │   4338)          │
└─────────────────┘         └──────────────────┘
```

## Configuration

### Application Service

The `php-app` service is configured in `docker-compose.yaml`:

```yaml
php-app:
  build: .
  ports:
    - "8080:8080"
  environment:
    - OTEL_PHP_AUTOLOAD_ENABLED=true
    - OTEL_SERVICE_NAME=php-laravel-docker-auto
    - OTEL_TRACES_EXPORTER=otlp
    - OTEL_METRICS_EXPORTER=otlp
    - OTEL_LOGS_EXPORTER=none
    - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://sematext-agent:4338
    - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://sematext-agent:4318
  depends_on:
    - sematext-agent
```

**Key points:**
- `OTEL_PHP_AUTOLOAD_ENABLED=true` is required for the PHP SDK to auto-bootstrap
- Uses service name `sematext-agent` (Docker DNS resolution)
- Traces sent to port 4338, metrics to port 4318
- Depends on agent starting first
- Exposes port 8080 to host

### Agent Service

The `sematext-agent` service configuration:

```yaml
sematext-agent:
  image: sematext/agent:latest-4
  environment:
    - OTEL_ENABLED=true
    - OTEL_MY_TOKEN_GROUP_SERVICES=all-services
  ports:
    - "4317:4317"  # Metrics gRPC
    - "4318:4318"  # Metrics HTTP
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
- Installs `ext-opentelemetry` via PECL for auto-instrumentation hooks
- Installs Composer for dependency management
- Uses Laravel's built-in server (`artisan serve`)
- No code changes required for basic instrumentation

## What Gets Instrumented Automatically

The OpenTelemetry auto-instrumentation automatically instruments:

### HTTP Servers
- **Laravel**: Routes, request handlers, middleware
- **HTTP attributes**: Method, URL, status code, headers

### Libraries
- **Guzzle**: Outgoing HTTP calls (if using Guzzle)
- **PDO**: Database operations (if using databases)
- **curl**: HTTP client operations

### Traces
- **Spans**: Automatic span creation for each HTTP request
- **Parent-child relationships**: Nested spans for internal operations
- **Error tracking**: Automatic exception capture

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
| `OTEL_PHP_AUTOLOAD_ENABLED` | `true` | Required to enable PHP SDK auto-bootstrap |
| `OTEL_SERVICE_NAME` | `php-laravel-docker-auto` | Service identifier |
| `OTEL_SERVICE_VERSION` | `1.0.0` | Service version |
| `OTEL_TRACES_EXPORTER` | `otlp` | Exporter type for traces |
| `OTEL_METRICS_EXPORTER` | `otlp` | Exporter type for metrics |
| `OTEL_LOGS_EXPORTER` | `none` | Logs not supported in auto mode |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `http://sematext-agent:4338` | Traces endpoint (Docker DNS) |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | `http://sematext-agent:4318` | Metrics endpoint (Docker DNS) |
| `PORT` | `8080` | Application port |

### Agent Container

| Variable | Value | Description |
|----------|-------|-------------|
| `OTEL_ENABLED` | `true` | Enable OpenTelemetry |
| `OTEL_METRICS_ENABLED` | `true` | Enable metrics (port 4318) |
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

### Cannot Access from Host

1. **Verify port mapping**:
   ```bash
   docker-compose ps
   # Should show: 0.0.0.0:8080->8080/tcp
   ```

2. **Check firewall**:
   ```bash
   curl http://localhost:8080/health
   ```

### Auto-instrumentation Not Working

1. **Check if OpenTelemetry extension is loaded**:
   ```bash
   docker-compose exec php-app php -m | grep opentelemetry
   ```
   Should show: `opentelemetry`

2. **Verify OTLP endpoints**:
   ```bash
   docker-compose exec php-app env | grep OTLP
   ```

## Production Considerations

### Use Secrets for Tokens

Don't hardcode tokens in docker-compose.yaml. Use Docker secrets or environment files:

```bash
# Create .env file (add to .gitignore!)
MONITORING_TOKEN=your-monitoring-token
TRACES_TOKEN=your-traces-token
```

```yaml
# In docker-compose.yaml
environment:
  - OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=${MONITORING_TOKEN}
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

For production, use a proper PHP server instead of `artisan serve`:

**Use PHP-FPM with Nginx** or **RoadRunner**:

```dockerfile
FROM php:8.3-fpm
# ... install extensions and dependencies ...
```

## Comparing with Manual Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Install extension + packages | Configure SDK explicitly |
| **Code Changes** | Minimal | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Metrics** | HTTP metrics only | Custom metrics |
| **Logs** | Not supported | Full OTLP logs support |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs |

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes example](../../kubernetes/auto-instrumentation/laravel/)
- **Add databases**: Extend docker-compose with PostgreSQL, MongoDB, etc.
- **Try manual instrumentation**: See [Manual Docker example](../../manual-instrumentation/laravel/)

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [OpenTelemetry PHP](https://opentelemetry.io/docs/languages/php/)
- [OpenTelemetry PHP Auto-instrumentation](https://opentelemetry.io/docs/zero-code/php/)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
