# Java Spring Boot - Auto-Instrumentation (Baremetal)

This example demonstrates automatic OpenTelemetry instrumentation for a Java Spring Boot application running on a local machine (baremetal) using the OpenTelemetry Java Agent.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP, JDBC, and library instrumentation |
| **Metrics** | ✅ | Automatic JVM and HTTP metrics |
| **Logs** | ✅ | Full OTLP logs export support |

## Prerequisites

- Java 21+ installed
- Maven 3.6+ installed
- Sematext Agent running on localhost
- Sematext Apps created (Tracing, Monitoring, Logs)

## Quick Start

### 1. Install Dependencies

```bash
mvn clean package
```

This will compile your application and create an executable JAR file in the `target/` directory.

### 2. Download OpenTelemetry Java Agent

Download the latest OpenTelemetry Java Agent JAR:

```bash
curl -L -o opentelemetry-javaagent.jar \
  https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.21.0/opentelemetry-javaagent.jar
```

### 3. Install Sematext Agent (if not already installed)

Follow the [Sematext Agent Installation Guide](https://sematext.com/docs/agents/sematext-agent/installation/) for your operating system.

**Verify agent is running:**

```bash
sudo systemctl status sematext-agent
```

### 4. Configure Sematext Agent

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
  --token-group "java-token-group" \
  --type traces \
  --token "YOUR_TRACES_TOKEN"

# Add logs token
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "java-token-group" \
  --type logs \
  --token "YOUR_LOGS_TOKEN"

# Add metrics token (optional)
sudo /opt/spm/spm-monitor/bin/st-agent otel token-groups add \
  --token-group "java-token-group" \
  --type metrics \
  --token "YOUR_MONITORING_TOKEN"
```

Get your tokens from each App in Sematext Cloud.

**Map your service name to the token group:**

```bash
sudo /opt/spm/spm-monitor/bin/st-agent otel services add \
  --service-names "java-spring-baremetal-auto" \
  --token-group "java-token-group"
```

**Restart the agent:**

```bash
sudo systemctl restart sematext-agent
```

### 5. Configure Environment Variables

Set environment variables for OpenTelemetry:

```bash
export OTEL_SERVICE_NAME=java-spring-baremetal-auto
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4338/v1/traces
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4328/v1/logs
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Note**: Traces use port 4338, metrics use port 4318, and logs use port 4328.

### 6. Run the Application

Run the application with the OpenTelemetry Java Agent:

```bash
java -javaagent:./opentelemetry-javaagent.jar \
  -jar target/app.jar
```

The application will start on port 8080. You should see a log message indicating that the OpenTelemetry Java Agent has been attached.

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
2. **Metrics**: Open your Sematext Monitoring App to see JVM and HTTP metrics
3. **Logs**: Open your Sematext Logs App to see application logs

## How Auto-Instrumentation Works

### Automatic Instrumentation

The OpenTelemetry Java Agent automatically instruments:

- **HTTP Servers**: Spring MVC, REST controllers, request mappings
- **Servlet API**: HTTP requests and responses
- **HTTP attributes**: Method, URL, status code, headers
- **JDBC**: Database queries (if using databases)
- **HTTP Clients**: RestTemplate, OkHttp, Apache HttpClient
- **Spring Boot**: Actuator endpoints, Spring Data

No code changes required in your application logic!

### Java Agent Attachment

The `-javaagent` flag attaches the OpenTelemetry agent at JVM startup:

```bash
java -javaagent:./opentelemetry-javaagent.jar -jar target/app.jar
```

The agent uses bytecode instrumentation to automatically add OpenTelemetry hooks to your application code and libraries.

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint - returns welcome message |
| `/users/:id` | GET | Get user by ID (simulates 100ms processing) |
| `/slow` | GET | Slow endpoint - simulates 2s latency |
| `/error` | GET | Error endpoint - returns 500 error |
| `/actuator/health` | GET | Health check endpoint |
| `/actuator/info` | GET | Application info endpoint |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | Yes | `java-spring-baremetal-auto` | Service name (must match agent config) |
| `OTEL_SERVICE_VERSION` | No | `1.0.0` | Service version |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Yes | `http://localhost:4338/v1/traces` | OTLP endpoint for traces |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Yes | `http://localhost:4318/v1/metrics` | OTLP endpoint for metrics |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Yes | `http://localhost:4328/v1/logs` | OTLP endpoint for logs |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | No | `http/protobuf` | OTLP protocol |

## What Gets Instrumented Automatically

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
- **Application logs**: Automatic capture via Logback, Log4j2, JUL
- **Trace correlation**: Automatic injection of trace/span IDs

## Troubleshooting

### No Data in Sematext

1. **Check agent is running**:
   ```bash
   sudo systemctl status sematext-agent
   ```

2. **Verify Java agent loaded**:
   Look for this in application logs:
   ```
   [otel.javaagent] OpenTelemetry Javaagent installed
   ```

3. **Verify service name matches**:
   ```bash
   echo $OTEL_SERVICE_NAME
   cat /opt/spm/properties/otel.yml
   ```

4. **Check OTLP endpoints are accessible**:
   ```bash
   curl http://localhost:4338
   curl http://localhost:4318
   curl http://localhost:4328
   ```

### Java Agent Not Loading

1. **Verify agent JAR exists**:
   ```bash
   ls -lh opentelemetry-javaagent.jar
   ```

2. **Check Java version**:
   ```bash
   java -version  # Should be 17+
   ```

3. **Verify -javaagent path is correct**:
   The path must be correct relative to where you run the command

### Port Already in Use

Change the port:

```bash
export SERVER_PORT=8081
java -javaagent:./opentelemetry-javaagent.jar -jar target/app.jar
```

## Disabling Specific Instrumentations

You can disable specific instrumentations using environment variables:

```bash
# Disable JDBC instrumentation
export OTEL_INSTRUMENTATION_JDBC_ENABLED=false

# Disable Spring Web instrumentation
export OTEL_INSTRUMENTATION_SPRING_WEB_ENABLED=false

# Run the application
java -javaagent:./opentelemetry-javaagent.jar -jar target/app.jar
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

- **Try Manual**: See [Manual Instrumentation baremetal example](../../manual-instrumentation/spring-boot/)
- **Deploy to Docker**: See [Docker auto example](../../../docker/auto-instrumentation/spring-boot/)
- **Deploy to Kubernetes**: See [Kubernetes auto example](../../../kubernetes/auto-instrumentation/spring-boot/)
- **Customize Instrumentation**: Configure Java agent properties

## Resources

- [OpenTelemetry Java Agent](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
- [Java Agent Configuration](https://opentelemetry.io/docs/languages/java/automatic/configuration/)
- [Supported Libraries](https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/supported-libraries.md)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
