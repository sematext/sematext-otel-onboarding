# Java Spring Boot - Auto-Instrumentation (Kubernetes)

This example demonstrates automatic OpenTelemetry instrumentation for a Java Spring Boot application deployed to Kubernetes.

## Telemetry Data

| Type | Supported | Notes |
|------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Spring instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ✅ | Automatic log capture from SLF4J/Logback |

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
docker build -t java-spring-k8s-auto:latest .
```

The deployment.yaml is already configured to use `java-spring-k8s-auto:latest` with `imagePullPolicy: IfNotPresent`, which will use your local image.

**For Minikube users:** Load the image into Minikube's Docker daemon:
```bash
minikube image load java-spring-k8s-auto:latest
```

### 3. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 4. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=java-spring-k8s-auto

# Check logs
kubectl logs -l app=java-spring-k8s-auto -f
```

### 5. Test the Application

```bash
# Port-forward to access locally
kubectl port-forward svc/java-spring-k8s-auto 8080:80

# Generate traffic
curl http://localhost:8080/
curl http://localhost:8080/users/123
curl http://localhost:8080/slow
curl http://localhost:8080/error
```

### 6. View in Sematext Cloud

Open your Sematext Tracing, Monitoring, and Logs Apps to see telemetry data.

## How Auto-Instrumentation Works

### OpenTelemetry Java Agent

Auto-instrumentation uses the OpenTelemetry Java agent, which automatically instruments:

- **Spring Boot / Spring MVC**: HTTP endpoints, controllers
- **HTTP Client**: Outgoing HTTP requests
- **JDBC**: Database queries
- **Logging**: Automatic trace context injection

The agent is attached via JVM argument:
```bash
java -javaagent:/app/opentelemetry-javaagent.jar -jar app.jar
```

### Zero Code Changes

No code changes are required. The agent bytecode-instruments your application at runtime:

```java
@RestController
public class DemoController {
    @GetMapping("/users/{id}")
    public Map<String, Object> getUser(@PathVariable String id) {
        // Automatically traced - no manual span creation needed
        return userService.getUser(id);
    }
}
```

## Kubernetes Configuration

### Deployment Manifest

The `deployment.yaml` includes:

**OpenTelemetry Configuration:**
```yaml
env:
- name: OTEL_SERVICE_NAME
  value: "java-spring-k8s-auto"
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: "http/protobuf"
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338/v1/traces"
- name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318/v1/metrics"
- name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328/v1/logs"
- name: OTEL_LOGS_EXPORTER
  value: "otlp"
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

This adds namespace and pod information to all telemetry data.

**Health Checks:**
```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
readinessProbe:
  httpGet:
    path: /actuator/health/readiness
    port: 8080
```

## Application Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint |
| `/users/{id}` | GET | Get user by ID (with simulated processing delay) |
| `/slow` | GET | Slow endpoint (2 second delay) |
| `/error` | GET | Error endpoint (returns 500) |
| `/actuator/health` | GET | Health check endpoint |
| `/actuator/health/liveness` | GET | Liveness probe |
| `/actuator/health/readiness` | GET | Readiness probe |

## Common Tasks

### View Logs

```bash
kubectl logs -l app=java-spring-k8s-auto -f
```

### Scale Deployment

```bash
kubectl scale deployment java-spring-k8s-auto --replicas=3
```

### Update Application

```bash
# Rebuild image
docker build -t java-spring-k8s-auto:latest .

# For Minikube: Load image
minikube image load java-spring-k8s-auto:latest

# Restart deployment
kubectl rollout restart deployment/java-spring-k8s-auto
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -l app=java-spring-k8s-auto

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

### Java Agent Not Loading

Check container logs for agent initialization:
```bash
kubectl logs -l app=java-spring-k8s-auto | grep -i "opentelemetry"
```

You should see:
```
[otel.javaagent] OpenTelemetry Javaagent started
```

## OpenTelemetry Java Agent

### Version

This example uses OpenTelemetry Java agent **v2.21.0**. Update in Dockerfile:
```dockerfile
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.21.0/opentelemetry-javaagent.jar
```

### Automatic Instrumentation

The agent automatically instruments:
- Spring MVC / Spring Boot
- Servlet API
- JDBC drivers
- HTTP clients (Apache, OkHttp, etc.)
- Logging frameworks (SLF4J, Log4j)

See [supported libraries](https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/supported-libraries.md).

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Sematext Agent Helm Chart](https://github.com/sematext/helm-charts)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry Java](https://opentelemetry.io/docs/languages/java/)
- [OpenTelemetry Java Agent](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
