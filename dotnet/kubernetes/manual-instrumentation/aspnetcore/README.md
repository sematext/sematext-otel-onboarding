# .NET ASP.NET Core - Manual Instrumentation (Kubernetes)

This example demonstrates manual OpenTelemetry instrumentation for a .NET ASP.NET Core application deployed to Kubernetes.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual traces with custom spans and attributes |
| **Metrics** | ✅ | Custom metrics (counter, histogram) + automatic HTTP metrics |
| **Logs** | ✅ | Structured logging with trace correlation |

## Prerequisites

- Kubernetes cluster (1.19+)
- `kubectl` configured to access your cluster
- Docker installed locally
- Minikube (for local testing)
- Sematext Cloud account with Apps created

## Quick Start with Minikube

### 1. Start Minikube

```bash
minikube start
```

### 2. Deploy Sematext Agent (if not already deployed)

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
  --set otel.logs.enabled=true \
  --set otel.services.dotnet-aspnetcore-k8s-manual=dotnet-group \
  --set otel.token-groups.dotnet-group.monitoring-token=your-monitoring-token \
  --set otel.token-groups.dotnet-group.traces-token=your-traces-token \
  --set otel.token-groups.dotnet-group.logs-token=your-logs-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 3. Build Docker Image

```bash
docker build -t dotnet-aspnetcore-k8s-manual:latest .
```

### 4. Load Image into Minikube

```bash
minikube image load dotnet-aspnetcore-k8s-manual:latest
```

This makes your local Docker image available to Minikube.

### 5. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 6. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=dotnet-aspnetcore-k8s-manual

# Check logs
kubectl logs -l app=dotnet-aspnetcore-k8s-manual -f
```

### 7. Test the Application

```bash
# Port-forward to access locally
kubectl port-forward svc/dotnet-aspnetcore-k8s-manual 8080:80

# Generate traffic
curl http://localhost:8080/
curl http://localhost:8080/api/users/123
curl http://localhost:8080/api/slow
curl http://localhost:8080/api/error
```

### 8. View in Sematext Cloud

Open your Sematext Tracing, Monitoring, and Logs Apps to see telemetry data.

## Kubernetes Configuration

### Deployment Manifest

The `deployment.yaml` includes:

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dotnet-aspnetcore-k8s-manual
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: dotnet-aspnetcore-k8s-manual
        image: dotnet-aspnetcore-k8s-manual:latest
        env:
        - name: OTEL_SERVICE_NAME
          value: "dotnet-aspnetcore-k8s-manual"
        - name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
          value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
        - name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
          value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318"
        - name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
          value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328"
```

**Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: dotnet-aspnetcore-k8s-manual
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
```

### Key Configuration Points

**1. Service Name**
Must match Sematext Agent configuration:
```yaml
env:
- name: OTEL_SERVICE_NAME
  value: "dotnet-aspnetcore-k8s-manual"
```

**2. Agent Endpoints**
Uses Kubernetes DNS for traces, metrics, and logs:
```yaml
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
- name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318"
- name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328"
```

Format: `http://<service-name>.<namespace>.svc.cluster.local:<port>`
- Traces port: 4338 (HTTP)
- Metrics port: 4318 (HTTP)
- Logs port: 4328 (HTTP)

**3. Health Checks**
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
```

**4. Resource Limits**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "200m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

**5. Security Context**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  capabilities:
    drop:
      - ALL
```

## Manual Instrumentation Features

### 1. Custom Spans

Create custom spans with attributes:

```csharp
using var activity = _activitySource.StartActivity("operation-name", ActivityKind.Server);
activity?.SetTag("custom.attribute", "value");
activity?.SetStatus(ActivityStatusCode.Ok);
```

### 2. Nested Spans

Create nested spans for detailed tracing:

```csharp
using (var parentActivity = _activitySource.StartActivity("parent-operation"))
{
    using (var childActivity = _activitySource.StartActivity("child-operation"))
    {
        // Child operation logic
    }
}
```

### 3. Custom Metrics

Define and record custom metrics:

```csharp
var meter = new Meter("DotnetApp.Manual", "1.0.0");
var counter = meter.CreateCounter<long>("http.server.requests");
var histogram = meter.CreateHistogram<double>("http.server.duration");

counter.Add(1, new KeyValuePair<string, object?>("endpoint", "/api/users"));
histogram.Record(duration, new KeyValuePair<string, object?>("status", 200));
```

### 4. Structured Logging with Trace Correlation

Logs are automatically correlated with traces:

```csharp
_logger.LogInformation("Processing user {UserId}", userId);
```

The OpenTelemetry logging integration automatically includes trace context in logs.

### 5. Exception Recording

Record exceptions in spans:

```csharp
try
{
    // Operation that might throw
}
catch (Exception ex)
{
    activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
    activity?.RecordException(ex);
    _logger.LogError(ex, "Error occurred: {ErrorMessage}", ex.Message);
}
```

## OpenTelemetry Configuration

The `Services/OpenTelemetryConfig.cs` file configures:

1. **Resource Attributes**: Service name, version, and namespace
2. **Tracing**: ASP.NET Core and HTTP client instrumentation
3. **Metrics**: Custom and runtime metrics
4. **Logging**: OTLP log export with trace correlation

```csharp
services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddSource("DotnetApp.Manual")
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter();
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddMeter("DotnetApp.Manual")
            .AddAspNetCoreInstrumentation()
            .AddRuntimeInstrumentation()
            .AddOtlpExporter();
    });
```

## Common Tasks

### View Logs

```bash
kubectl logs -l app=dotnet-aspnetcore-k8s-manual -f
```

### Scale Deployment

```bash
kubectl scale deployment dotnet-aspnetcore-k8s-manual --replicas=3
```

### Update Application

```bash
# Build new image
docker build -t dotnet-aspnetcore-k8s-manual:latest .

# Load into Minikube
minikube image load dotnet-aspnetcore-k8s-manual:latest

# Restart deployment to use new image
kubectl rollout restart deployment/dotnet-aspnetcore-k8s-manual
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

1. **Check pod status**:
   ```bash
   kubectl describe pod -l app=dotnet-aspnetcore-k8s-manual
   ```

2. **Check events**:
   ```bash
   kubectl get events --sort-by='.lastTimestamp'
   ```

3. **Check image availability in Minikube**:
   ```bash
   minikube image ls | grep dotnet-aspnetcore-k8s-manual
   ```

### No Data in Sematext

1. **Verify agent is running**:
   ```bash
   kubectl get pods -n sematext
   ```

2. **Check service name matches**:
   ```bash
   kubectl exec -it <pod-name> -- env | grep OTEL_SERVICE_NAME
   ```

3. **Test connectivity to agent**:
   ```bash
   kubectl exec -it <pod-name> -- curl -v http://st-agent-sematext-agent.sematext.svc.cluster.local:4338
   ```

4. **Check agent configuration**:
   ```bash
   kubectl get configmap -n sematext sematext-agent -o yaml | grep -A20 "otel:"
   ```

### DNS Resolution Issues

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup st-agent-sematext-agent.sematext.svc.cluster.local
```

Expected output should show the agent service IP.

### Image Not Found

If the pod shows `ImagePullBackOff`:

```bash
# Verify image was loaded
minikube image ls | grep dotnet-aspnetcore-k8s-manual

# Reload if necessary
minikube image load dotnet-aspnetcore-k8s-manual:latest
```

### Network Policies Blocking Traffic

If using NetworkPolicies, ensure traffic to sematext namespace is allowed:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-sematext-agent
spec:
  podSelector:
    matchLabels:
      app: dotnet-aspnetcore-k8s-manual
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: sematext
    ports:
    - protocol: TCP
      port: 4338
    - protocol: TCP
      port: 4318
    - protocol: TCP
      port: 4328
```

## Production Best Practices

### 1. Use ConfigMaps for Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-config
data:
  OTEL_EXPORTER_OTLP_ENDPOINT: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
---
# In Deployment
envFrom:
- configMapRef:
    name: otel-config
```

### 2. Set Resource Quotas

```yaml
resources:
  requests:
    memory: "256Mi"  # Guaranteed
    cpu: "200m"
  limits:
    memory: "512Mi"  # Maximum
    cpu: "500m"
```

### 3. Implement Probes

Always include both liveness and readiness probes.

### 4. Use HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: dotnet-aspnetcore-k8s-manual
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: dotnet-aspnetcore-k8s-manual
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 5. Use PodDisruptionBudget

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: dotnet-aspnetcore-k8s-manual
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: dotnet-aspnetcore-k8s-manual
```

## Multi-Environment Setup

Use namespaces for different environments:

```bash
# Production
kubectl apply -f deployment.yaml -n production

# Staging
kubectl apply -f deployment.yaml -n staging
```

Update agent configuration with environment-specific token groups.

## Next Steps

- **Add Ingress**: Expose application externally
- **Set up HPA**: Auto-scale based on metrics
- **Add monitoring**: Create Sematext dashboards
- **Implement CI/CD**: Automate deployments

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Sematext Agent Helm Chart](https://github.com/sematext/helm-charts)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/net/)
- [OpenTelemetry .NET SDK](https://github.com/open-telemetry/opentelemetry-dotnet)
