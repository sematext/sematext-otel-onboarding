# Java Spring Boot - Auto-Instrumentation (Docker)

This example demonstrates automatic OpenTelemetry instrumentation for a Java Spring Boot application running in Docker containers using the OpenTelemetry Java Agent.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP, JDBC, and library instrumentation |
| **Metrics** | ✅ | Automatic JVM and HTTP metrics |
| **Logs** | ✅ | Full OTLP logs export support |

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
- REGION=EU  # US for Sematext Cloud US, EU for Sematext Cloud EU
```

**App Tokens** - Replace with your actual Sematext App tokens:
```yaml
- OTEL_MY_TOKEN_GROUP_MONITORING_TOKEN=your-monitoring-token
- OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
- OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
- OTEL_MY_TOKEN_GROUP_SERVICES="all-services"
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
- **java-app**: Your instrumented application

### 3. Verify Containers are Running

```bash
docker-compose ps
```

Expected output:
```
NAME                COMMAND             STATUS
sematext-agent      ...                 Up
java-app            ...                 Up
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
docker-compose logs -f java-app

# Agent logs
docker-compose logs -f sematext-agent
```

### 6. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App
2. **Metrics**: Open your Sematext Monitoring App
3. **Logs**: Open your Sematext Logs App

## Docker Compose Architecture

The `docker-compose.yaml` sets up:

1. **Sematext Agent** (`sematext/agent:latest-4`) - Receives OTLP telemetry and forwards to Sematext Cloud
   - Runs in privileged mode with host volumes mounted for infrastructure monitoring
   - Exposes OTLP receivers on ports 4317-4318 (metrics), 4327-4328 (logs), 4337-4338 (traces)
2. **Java Application** - Spring Boot app with OpenTelemetry Java agent for automatic instrumentation

```
┌─────────────────┐         ┌──────────────────┐
│                 │  OTLP   │                  │
│  java-app       │────────▶│  sematext-agent  │─────▶ Sematext Cloud
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

The `java-app` service is configured in `docker-compose.yaml`:

```yaml
java-app:
  build: .
  ports:
    - "8080:8080"
  environment:
    - OTEL_SERVICE_NAME=java-spring-docker-auto
    - OTEL_SERVICE_VERSION=1.0.0
    - OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://sematext-agent:4338/v1/traces
    - OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://sematext-agent:4318/v1/metrics
    - OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://sematext-agent:4328/v1/logs
    - OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
  depends_on:
    - sematext-agent
```

**Key points:**
- Uses service name `sematext-agent` (Docker DNS resolution)
- Separate OTLP endpoints for traces (4338), metrics (4318), and logs (4328)
- All signals sent via HTTP/protobuf protocol
- Java agent automatically instruments the application
- Depends on agent starting first
- Exposes port 8080 to host

### Agent Service

The `sematext-agent` service configuration:

```yaml
sematext-agent:
  image: sematext/agent:latest-4
  privileged: true
  environment:
    - INFRA_TOKEN=your-infra-token
    - REGION=EU
    - OTEL_ENABLED=true
    - OTEL_LOGS_ENABLED=true
    - OTEL_TRACES_ENABLED=true
    - OTEL_MY_TOKEN_GROUP_LOGS_TOKEN=your-logs-token
    - OTEL_MY_TOKEN_GROUP_TRACES_TOKEN=your-traces-token
    - OTEL_MY_TOKEN_GROUP_SERVICES="all-services"
  cap_add:
    - SYS_ADMIN
  volumes:
    - /:/hostfs:ro,rslave
    - /etc/passwd:/etc/passwd:ro
    - /etc/group:/etc/group:ro
    - /var/run/:/var/run
    - /sys/kernel/debug:/sys/kernel/debug
    - /sys:/host/sys:ro
    - /dev:/hostfs/dev:ro
    - /var/run/docker.sock:/var/run/docker.sock:ro
  ports:
    - "4317:4317"  # Metrics gRPC
    - "4318:4318"  # Metrics HTTP
    - "4327:4327"  # Logs gRPC
    - "4328:4328"  # Logs HTTP
    - "4337:4337"  # Traces gRPC
    - "4338:4338"  # Traces HTTP
```

## Dockerfile

The Dockerfile uses a multi-stage build:

**Build Stage:**
```dockerfile
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests
```

**Runtime Stage:**
```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Download OpenTelemetry Java agent
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.21.0/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

# Copy built application
COPY --from=build /app/target/app.jar /app/app.jar

# Run with OpenTelemetry agent
ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "/app/app.jar"]
```

**Key points:**
- Downloads latest OpenTelemetry Java agent (v2.21.0)
- Uses `-javaagent` flag to attach the agent at runtime
- No code changes required for instrumentation
- Multi-stage build for smaller image size

## What Gets Instrumented Automatically

The OpenTelemetry Java agent automatically instruments:

### HTTP Servers
- **Spring MVC**: REST controllers, request mappings
- **Servlet API**: HTTP requests and responses
- **HTTP attributes**: Method, URL, status code, headers

### Libraries
- **JDBC**: Database queries (if using databases)
- **HTTP Clients**: RestTemplate, OkHttp, Apache HttpClient
- **Spring Boot**: Actuator endpoints, Spring Data

### JVM Metrics
- **Memory**: Heap, non-heap, garbage collection
- **Threads**: Active threads, daemon threads
- **CPU**: Usage and load
- **Classes**: Loaded and unloaded classes

### Logs
- **Application logs**: Automatic capture via Log4j2, Logback, JUL
- **Trace correlation**: Automatic injection of trace/span IDs

## Common Tasks

```bash
# View application logs with trace correlation
docker-compose logs -f java-app

# Restart after code changes
docker-compose up -d --build

# Stop and remove
docker-compose down

# View agent configuration
docker-compose exec sematext-agent env | grep OTEL

# Check Java agent is loaded
docker-compose logs java-app | grep -i "opentelemetry"
```

## Troubleshooting

### No Telemetry Data

1. **Check agent is running**:
   ```bash
   docker-compose ps sematext-agent
   ```

2. **Verify Java agent loaded**:
   ```bash
   docker-compose logs java-app | grep "opentelemetry-javaagent"
   ```
   Should see: `OpenTelemetry Javaagent installed`

3. **Check OTLP endpoint**:
   ```bash
   docker-compose exec java-app env | grep OTLP
   ```
   Should be: `http://sematext-agent:4318`

4. **Test connectivity**:
   ```bash
   docker-compose exec java-app wget -O- http://sematext-agent:4318
   ```

### Traces Not Appearing

1. **Check service name matches token group**:
   - Service name in docker-compose: `java-spring-boot-auto`
   - Token group in agent config: `OTEL_MY_TOKEN_GROUP_*`

2. **Verify token configuration**:
   Ensure all three tokens are set correctly in docker-compose.yaml

3. **Check agent logs**:
   ```bash
   docker-compose logs sematext-agent | grep -i error
   ```

### Application Not Starting

1. **Check build logs**:
   ```bash
   docker-compose build
   ```

2. **Verify Maven dependencies**:
   ```bash
   docker-compose run --rm java-app mvn dependency:tree
   ```

3. **Check Java version**:
   Application requires Java 17+

## Production Considerations

### Security
- **Use Docker secrets** instead of environment variables for tokens
- **Run as non-root user**:
  ```dockerfile
  RUN addgroup -S appgroup && adduser -S appuser -G appgroup
  USER appuser
  ```

### Resource Limits
Add resource limits in docker-compose.yaml:
```yaml
java-app:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### Health Checks
Add health check to docker-compose.yaml:
```yaml
java-app:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:8080/actuator/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 60s
```

### Logging
Configure logging to file for persistence:
```yaml
java-app:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

## Comparing with Manual Instrumentation

| Feature | Auto-Instrumentation | Manual Instrumentation |
|---------|---------------------|----------------------|
| **Setup** | Add Java agent | Add SDK dependencies |
| **Code Changes** | None required | Explicit instrumentation |
| **Control** | Limited | Full control |
| **Span Attributes** | Automatic | Custom attributes |
| **Metrics** | JVM + HTTP | Custom metrics |
| **Overhead** | Slightly higher | Lower |
| **Best For** | Quick setup, standard apps | Custom logic, specific needs |

## Next Steps

- **Deploy to Kubernetes**: See [Kubernetes auto example](../../kubernetes/auto-instrumentation/spring-boot/)
- **Try Manual**: See [Manual Instrumentation Docker example](../manual-instrumentation/spring-boot/)
- **Customize Instrumentation**: Configure Java agent properties

## Resources

- [OpenTelemetry Java Agent](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
- [Java Agent Configuration](https://opentelemetry.io/docs/languages/java/automatic/configuration/)
- [Supported Libraries](https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/supported-libraries.md)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
