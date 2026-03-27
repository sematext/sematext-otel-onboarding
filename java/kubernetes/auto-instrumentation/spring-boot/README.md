# Java Spring Boot - Auto-Instrumentation (Kubernetes)

This example demonstrates automatic OpenTelemetry instrumentation for a Java Spring Boot application deployed to Kubernetes. The OTel Java agent is injected at runtime via a Kubernetes **init container**, keeping the application image clean and decoupled from instrumentation.

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
  --set otel.services.all-services=my-otel-group \
  --set otel.token-groups.my-otel-group.traces-token=your-traces-token \
  --set otel.token-groups.my-otel-group.logs-token=your-logs-token \
  --set otel.token-groups.my-otel-group.monitoring-token=your-monitoring-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 2. Build Docker Image Locally

```bash
docker build -t java-spring-k8s-auto:latest .
```

The Dockerfile builds a clean application image **without** the OTel agent. The agent is downloaded and injected by the init container at pod startup.

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
# Check pod status (init container should complete before app starts)
kubectl get pods -l app=java-spring-k8s-auto

# Watch init container progress
kubectl describe pod -l app=java-spring-k8s-auto

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

## How It Works: Init Container Agent Injection

Instead of baking the OTel Java agent into the Docker image, this example uses a Kubernetes init container to download the agent at pod startup and share it with the application container via a volume.

### Architecture

```
Pod Startup Sequence:
┌─────────────────────────────────────────────────────────┐
│ 1. Init Container (alpine:3)                            │
│    Downloads opentelemetry-javaagent.jar → /otel/       │
│    (shared emptyDir volume)                             │
└──────────────────────┬──────────────────────────────────┘
                       │ volume: otel-agent
                       ▼
┌─────────────────────────────────────────────────────────┐
│ 2. App Container (java-spring-k8s-auto)                 │
│    JAVA_TOOL_OPTIONS="-javaagent:/otel/otel-agent.jar"  │
│    Mounts /otel/ from shared volume                     │
│    Agent auto-instruments the app at JVM startup        │
└─────────────────────────────────────────────────────────┘
```

### Key Manifest Components

**Init container** downloads the agent into a shared volume:
```yaml
initContainers:
  - name: otel-agent
    image: alpine:3
    command: ['wget', '-O', '/otel/opentelemetry-javaagent.jar',
      'https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar']
    volumeMounts:
      - name: otel-agent
        mountPath: /otel
```

**Application container** mounts the volume and activates the agent via `JAVA_TOOL_OPTIONS`:
```yaml
containers:
  - name: java-spring-k8s-auto
    volumeMounts:
      - name: otel-agent
        mountPath: /otel
    env:
      - name: JAVA_TOOL_OPTIONS
        value: "-javaagent:/otel/opentelemetry-javaagent.jar"
```

**Shared volume** connects the init container to the app container:
```yaml
volumes:
  - name: otel-agent
    emptyDir: {}
```

### Benefits Over Baking the Agent in the Dockerfile

| Aspect | Init Container | Baked in Dockerfile |
|--------|---------------|---------------------|
| **Image size** | Smaller (no agent JAR) | Larger (~20MB agent) |
| **Agent updates** | Restart pod to get latest | Rebuild image |
| **Image reuse** | Same image with/without instrumentation | Separate images needed |
| **Separation of concerns** | App team owns image, platform team owns instrumentation | Coupled |
| **Version pinning** | Change URL in manifest | Change version in Dockerfile |

### Pinning the Agent Version

The default configuration downloads the latest agent version. To pin a specific version, update the init container command in `deployment.yaml`:

```yaml
command: ['wget', '-O', '/otel/opentelemetry-javaagent.jar',
  'https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v2.21.0/opentelemetry-javaagent.jar']
```

## OpenTelemetry Configuration

The deployment manifest configures OTel via environment variables:

```yaml
env:
- name: JAVA_TOOL_OPTIONS
  value: "-javaagent:/otel/opentelemetry-javaagent.jar"
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

### Init Container Failing

```bash
# Check init container status and logs
kubectl describe pod -l app=java-spring-k8s-auto
kubectl logs -l app=java-spring-k8s-auto -c otel-agent
```

Common causes:
- **Network issues**: The init container needs internet access to download the agent from GitHub
- **DNS resolution**: Ensure cluster DNS is working (`alpine:3` uses `wget`)

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
Picked up JAVA_TOOL_OPTIONS: -javaagent:/otel/opentelemetry-javaagent.jar
[otel.javaagent] OpenTelemetry Javaagent started
```

### Verify Agent JAR Was Downloaded

```bash
kubectl exec -it <pod-name> -- ls -la /otel/
```

## What Gets Instrumented Automatically

The OpenTelemetry Java agent automatically instruments:
- **Spring MVC / Spring Boot**: REST controllers, request mappings
- **Servlet API**: HTTP requests and responses
- **JDBC drivers**: Database queries
- **HTTP clients**: Apache, OkHttp, RestTemplate
- **Logging frameworks**: SLF4J, Log4j, JUL

See [supported libraries](https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/supported-libraries.md).

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Kubernetes Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
- [Sematext Agent Helm Chart](https://github.com/sematext/helm-charts)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry Java](https://opentelemetry.io/docs/languages/java/)
- [OpenTelemetry Java Agent](https://github.com/open-telemetry/opentelemetry-java-instrumentation)
