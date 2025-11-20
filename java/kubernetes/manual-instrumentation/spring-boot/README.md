# Java Spring Boot - Manual Instrumentation (Kubernetes)

This example demonstrates manual OpenTelemetry instrumentation for a Java Spring Boot application deployed to Kubernetes. With manual instrumentation, you have full control over spans, metrics, and logs.

## Telemetry Data

| Type | Supported | Notes |
|------|-----------|-------|
| **Traces** | ✅ | Manual span creation with custom attributes |
| **Metrics** | ✅ | Custom metrics (Counter, Histogram, UpDownCounter) |
| **Logs** | ✅ | Structured logs with trace correlation |

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` configured to access your cluster
- Sematext Agent deployed to Kubernetes (via Helm)
- Sematext Cloud account with Apps created
- Docker for building the image
- Maven 3.6+ (optional, for local builds)

## Quick Start

### 1. Deploy Sematext Agent (if not already deployed)

```bash
helm repo add sematext https://helm.sematext.com
helm repo update

helm install sematext-agent sematext/sematext-agent \
  --namespace sematext \
  --create-namespace \
  --set infraToken=your-infra-token \
  --set region=US \
  --set otel.enabled=true \
  --set otel.traces.enabled=true \
  --set otel.metrics.enabled=true \
  --set otel.logs.enabled=true \
  --set otel.services.all-services=my-token-group \
  --set otel.token-groups.my-token-group.traces-token=your-traces-token \
  --set otel.token-groups.my-token-group.logs-token=your-logs-token \
  --set otel.token-groups.my-token-group.monitoring-token=your-monitoring-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 2. Build Docker Image Locally

```bash
docker build -t java-spring-k8s-manual:latest .
```

The deployment.yaml is already configured to use `java-spring-k8s-manual:latest` with `imagePullPolicy: IfNotPresent`, which will use your local image.

**For Minikube users:** Load the image into Minikube's Docker daemon:
```bash
minikube image load java-spring-k8s-manual:latest
```

### 3. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=java-spring-k8s-manual

# Check logs
kubectl logs -l app=java-spring-k8s-manual -f
```

### 5. Test the Application

```bash
# Port-forward to access locally
kubectl port-forward svc/java-spring-k8s-manual 8080:80

# Generate traffic
curl http://localhost:8080/
curl http://localhost:8080/users/123
curl http://localhost:8080/slow
curl http://localhost:8080/error
```

### 6. View in Sematext Cloud

Open your Sematext Tracing, Monitoring, and Logs Apps to see telemetry data.

## How Manual Instrumentation Works

### Manual Spans

Create spans explicitly using the Tracer API:

```java
@RestController
public class DemoController {
    private final Tracer tracer;

    @GetMapping("/users/{id}")
    public Map<String, Object> getUser(@PathVariable String id) {
        // Create manual span
        Span span = tracer.spanBuilder("handle-get-user")
            .setSpanKind(SpanKind.SERVER)
            .setAttribute("endpoint", "/users/{id}")
            .setAttribute("method", "GET")
            .setAttribute("user.id", id)
            .startSpan();

        try (Scope scope = span.makeCurrent()) {
            // Create child span
            Span childSpan = tracer.spanBuilder("process-user-data")
                .setSpanKind(SpanKind.INTERNAL)
                .setAttribute("user.id", id)
                .startSpan();

            try (Scope childScope = childSpan.makeCurrent()) {
                // Processing logic
            } finally {
                childSpan.end();
            }

            return response;
        } finally {
            span.end();
        }
    }
}
```

### Custom Metrics

Create custom metrics using the Meter API:

```java
public class DemoController {
    private final Meter meter;
    private final LongCounter requestCounter;
    private final DoubleHistogram requestDuration;
    private final LongUpDownCounter activeRequests;

    public DemoController(Tracer tracer, Meter meter) {
        this.meter = meter;

        // Counter - monotonically increasing
        this.requestCounter = meter.counterBuilder("http.server.requests")
            .setDescription("Total number of HTTP requests")
            .setUnit("1")
            .build();

        // Histogram - statistical distribution
        this.requestDuration = meter.histogramBuilder("http.server.duration")
            .setDescription("HTTP request duration")
            .setUnit("ms")
            .build();

        // UpDownCounter - can increase or decrease
        this.activeRequests = meter.upDownCounterBuilder("http.server.active_requests")
            .setDescription("Number of active HTTP requests")
            .setUnit("1")
            .build();
    }

    @GetMapping("/")
    public Map<String, String> root() {
        long startTime = System.currentTimeMillis();
        activeRequests.add(1, Attributes.of(...));

        try {
            // Business logic
            long duration = System.currentTimeMillis() - startTime;
            requestCounter.add(1, Attributes.of(...));
            requestDuration.record(duration, Attributes.of(...));
        } finally {
            activeRequests.add(-1, Attributes.of(...));
        }
    }
}
```

### Structured Logs with Trace Correlation

Emit structured logs with automatic trace correlation:

```java
private void emitLog(Severity severity, String message, Attributes attributes) {
    Span currentSpan = Span.current();
    Attributes.Builder logAttributesBuilder = Attributes.builder();

    // Copy provided attributes
    attributes.forEach((key, value) ->
        logAttributesBuilder.put((AttributeKey<Object>) key, value));

    // Add trace correlation
    if (currentSpan != null && currentSpan.getSpanContext().isValid()) {
        logAttributesBuilder.put("trace_id", currentSpan.getSpanContext().getTraceId());
        logAttributesBuilder.put("span_id", currentSpan.getSpanContext().getSpanId());
        logAttributesBuilder.put("trace_flags",
            String.format("%02x", currentSpan.getSpanContext().getTraceFlags().asByte()));
    }

    otelLogger.logRecordBuilder()
        .setSeverity(severity)
        .setBody(message)
        .setAllAttributes(logAttributesBuilder.build())
        .emit();
}
```

## OpenTelemetry Configuration

The manual instrumentation is configured in `OpenTelemetryConfig.java`:

### Resource Configuration

```java
Resource resource = Resource.getDefault().merge(
    Resource.create(Attributes.builder()
        .put(ResourceAttributes.SERVICE_NAME, serviceName)
        .put(ResourceAttributes.SERVICE_VERSION, serviceVersion)
        .build())
);
```

### Trace Exporter

```java
OtlpHttpSpanExporter spanExporter = OtlpHttpSpanExporter.builder()
    .setEndpoint(tracesEndpoint)
    .build();

sdkTracerProvider = SdkTracerProvider.builder()
    .addSpanProcessor(BatchSpanProcessor.builder(spanExporter).build())
    .setResource(resource)
    .build();
```

### Metrics Exporter

```java
OtlpHttpMetricExporter metricExporter = OtlpHttpMetricExporter.builder()
    .setEndpoint(metricsEndpoint)
    .build();

sdkMeterProvider = SdkMeterProvider.builder()
    .registerMetricReader(
        PeriodicMetricReader.builder(metricExporter)
            .setInterval(Duration.ofSeconds(60))
            .build()
    )
    .setResource(resource)
    .build();
```

### Logs Exporter

```java
OtlpHttpLogRecordExporter logExporter = OtlpHttpLogRecordExporter.builder()
    .setEndpoint(logsEndpoint)
    .build();

sdkLoggerProvider = SdkLoggerProvider.builder()
    .addLogRecordProcessor(BatchLogRecordProcessor.builder(logExporter).build())
    .setResource(resource)
    .build();

GlobalLoggerProvider.set(sdkLoggerProvider);
```

### OpenTelemetry SDK

```java
OpenTelemetry openTelemetry = OpenTelemetrySdk.builder()
    .setTracerProvider(sdkTracerProvider)
    .setMeterProvider(sdkMeterProvider)
    .setLoggerProvider(sdkLoggerProvider)
    .build();
```

## Kubernetes Configuration

The `deployment.yaml` includes:

**OTLP Exporter Endpoints:**
```yaml
env:
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: "http/protobuf"
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338/v1/traces"
- name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318/v1/metrics"
- name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328/v1/logs"
```

**Kubernetes Metadata:**
```yaml
- name: K8S_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: K8S_POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "service.namespace=$(K8S_NAMESPACE),k8s.pod.name=$(K8S_POD_NAME)"
```

**Health Checks:**
```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  initialDelaySeconds: 60
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
  initialDelaySeconds: 50
```

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint with manual span and metrics |
| `/users/{id}` | GET | Get user by ID (with child span and processing delay) |
| `/slow` | GET | Slow endpoint (2 second delay) |
| `/error` | GET | Error endpoint (returns 500 with error span) |
| `/actuator/health` | GET | Health check endpoint |
| `/actuator/health/liveness` | GET | Liveness probe |
| `/actuator/health/readiness` | GET | Readiness probe |

## Common Tasks

### View Logs

```bash
kubectl logs -l app=java-spring-k8s-manual -f
```

### Scale Deployment

```bash
kubectl scale deployment java-spring-k8s-manual --replicas=3
```

### Update Application

```bash
# Rebuild image
docker build -t java-spring-k8s-manual:latest .

# For Minikube: Load image
minikube image load java-spring-k8s-manual:latest

# Restart deployment
kubectl rollout restart deployment/java-spring-k8s-manual
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -l app=java-spring-k8s-manual

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### No Data in Sematext

1. **Verify agent is running:**
   ```bash
   kubectl get pods -n sematext
   ```

2. **Check service name matches:**
   ```bash
   kubectl exec -it <pod-name> -- env | grep OTEL_SERVICE_NAME
   ```

3. **Test connectivity to agent:**
   ```bash
   kubectl exec -it <pod-name> -- curl -v http://st-agent-sematext-agent.sematext.svc.cluster.local:4318
   ```

### Application Not Starting

Check container logs for initialization errors:
```bash
kubectl logs -l app=java-spring-k8s-manual | grep -i "error\|exception"
```

## OpenTelemetry SDK Dependencies

This example uses OpenTelemetry Java SDK **v1.43.0**. Update in `pom.xml`:

```xml
<properties>
    <opentelemetry.version>1.43.0</opentelemetry.version>
</properties>

<dependencies>
    <!-- OpenTelemetry SDK -->
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-sdk</artifactId>
        <version>${opentelemetry.version}</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-sdk-logs</artifactId>
        <version>${opentelemetry.version}</version>
    </dependency>
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-sdk-metrics</artifactId>
        <version>${opentelemetry.version}</version>
    </dependency>

    <!-- OTLP Exporters -->
    <dependency>
        <groupId>io.opentelemetry</groupId>
        <artifactId>opentelemetry-exporter-otlp</artifactId>
        <version>${opentelemetry.version}</version>
    </dependency>
</dependencies>
```

## Auto vs Manual Instrumentation

| Feature | Auto | Manual |
|---------|------|--------|
| **Code Changes** | None | Required |
| **Control** | Limited | Full control |
| **Custom Spans** | ❌ | ✅ |
| **Custom Metrics** | ❌ | ✅ |
| **Custom Attributes** | Limited | ✅ Unlimited |
| **Trace Correlation** | Automatic | Manual |
| **Performance Overhead** | Higher | Lower (optimized) |
| **Maintenance** | Agent updates | Code updates |

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Sematext Agent Helm Chart](https://github.com/sematext/helm-charts)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry Java](https://opentelemetry.io/docs/languages/java/)
- [OpenTelemetry Java Manual Instrumentation](https://opentelemetry.io/docs/languages/java/instrumentation/)
