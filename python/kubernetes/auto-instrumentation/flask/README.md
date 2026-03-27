# Python Flask - Auto-Instrumentation (Kubernetes)

This example demonstrates automatic OpenTelemetry instrumentation for a Python Flask application deployed to Kubernetes.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Automatic HTTP and Flask instrumentation |
| **Metrics** | ✅ | Automatic HTTP metrics |
| **Logs** | ❌ | Not supported in auto-instrumentation. Use [manual instrumentation](../../manual-instrumentation/flask/) for logs support |

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
  --set otel.services.all-services=my-otel-group \
  --set otel.token-groups.my-otel-group.monitoring-token=your-monitoring-token \
  --set otel.token-groups.my-otel-group.traces-token=your-traces-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 3. Build Docker Image

```bash
docker build -t python-flask-k8s-auto:latest .
```

### 4. Load Image into Minikube

```bash
minikube image load python-flask-k8s-auto:latest
```

This makes your local Docker image available to Minikube.

### 5. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 6. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=python-flask-k8s-auto

# Check logs
kubectl logs -l app=python-flask-k8s-auto -f
```

### 7. Test the Application

```bash
# Port-forward to access locally
kubectl port-forward svc/python-flask-k8s-auto 8080:80

# Generate traffic
curl http://localhost:8080/
curl http://localhost:8080/users/123
curl http://localhost:8080/slow
curl http://localhost:8080/error
```

### 8. View in Sematext Cloud

Open your Sematext Tracing and Monitoring Apps to see telemetry data.

## Kubernetes Configuration

### Deployment Manifest

The `deployment.yaml` includes:

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-flask-k8s-auto
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: python-flask-k8s-auto
        image: python-flask-k8s-auto:latest
        env:
        - name: OTEL_SERVICE_NAME
          value: "python-flask-k8s-auto"
        - name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
          value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
        - name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
          value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318"
```

**Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: python-flask-k8s-auto
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
  value: "python-flask-k8s-auto"
```

**2. Agent Endpoints**
Uses Kubernetes DNS for traces and metrics:
```yaml
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
- name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318"
```

Format: `http://<service-name>.<namespace>.svc.cluster.local:<port>`
- Traces port: 4338 (HTTP)
- Metrics port: 4318 (HTTP)

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
    memory: "128Mi"
    cpu: "100m"
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

## Kubernetes Metadata

Inject Kubernetes metadata as OpenTelemetry resource attributes:

```yaml
env:
# Capture Kubernetes metadata
- name: K8S_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: K8S_POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name

# Add to OpenTelemetry resource attributes
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "service.namespace=$(K8S_NAMESPACE),k8s.pod.name=$(K8S_POD_NAME)"
```

This adds namespace and pod information to all telemetry data. The `service.namespace` attribute groups services logically, while `k8s.pod.name` provides the Kubernetes pod identity.

## Common Tasks

### View Logs

```bash
kubectl logs -l app=python-flask-k8s-auto -f
```

### Scale Deployment

```bash
kubectl scale deployment python-flask-k8s-auto --replicas=3
```

### Update Application

```bash
# Build new image
docker build -t python-flask-k8s-auto:latest .

# Load into Minikube
minikube image load python-flask-k8s-auto:latest

# Restart deployment to use new image
kubectl rollout restart deployment/python-flask-k8s-auto
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

1. **Check pod status**:
   ```bash
   kubectl describe pod -l app=python-flask-k8s-auto
   ```

2. **Check events**:
   ```bash
   kubectl get events --sort-by='.lastTimestamp'
   ```

3. **Check image availability in Minikube**:
   ```bash
   minikube image ls | grep python-flask-k8s-auto
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
   kubectl exec -it <pod-name> -- python -c "import urllib.request; print(urllib.request.urlopen('http://st-agent-sematext-agent.sematext.svc.cluster.local:4338').status)"
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
minikube image ls | grep python-flask-k8s-auto

# Reload if necessary
minikube image load python-flask-k8s-auto:latest
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
      app: python-flask-k8s-auto
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: sematext
    ports:
    - protocol: TCP
      port: 4338
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
    memory: "128Mi"  # Guaranteed
    cpu: "100m"
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
  name: python-flask-k8s-auto
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: python-flask-k8s-auto
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
  name: python-flask-k8s-auto
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: python-flask-k8s-auto
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
- [OpenTelemetry Python](https://opentelemetry.io/docs/languages/python/)
