# PHP Laravel - Manual Instrumentation (Kubernetes)

This example demonstrates manual OpenTelemetry instrumentation for a PHP Laravel application deployed to Kubernetes with full control over traces, metrics, and logs.

## Telemetry Data

| Type | Supported | Notes |
|--------|-----------|-------|
| **Traces** | ✅ | Manual span creation with custom attributes |
| **Metrics** | ✅ | Custom metrics (counters, histograms, gauges) |
| **Logs** | ✅ | Full OTLP logs export with trace correlation |

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
  --set otel.services.all-services=my-otel-group \
  --set otel.token-groups.my-otel-group.monitoring-token=your-monitoring-token \
  --set otel.token-groups.my-otel-group.traces-token=your-traces-token \
  --set otel.token-groups.my-otel-group.logs-token=your-logs-token
```

**Note**: Use `region=US` for Sematext Cloud US or `region=EU` for Sematext Cloud EU.

### 3. Build Docker Image

```bash
docker build -t php-laravel-k8s-manual:latest .
```

### 4. Load Image into Minikube

```bash
minikube image load php-laravel-k8s-manual:latest
```

### 5. Deploy Application

```bash
kubectl apply -f deployment.yaml
```

### 6. Verify Deployment

```bash
# Check pod status
kubectl get pods -l app=php-laravel-k8s-manual

# Check logs
kubectl logs -l app=php-laravel-k8s-manual -f
```

### 7. Test the Application

```bash
# Port-forward to access locally
kubectl port-forward svc/php-laravel-k8s-manual 8080:80

# Generate traffic
curl http://localhost:8080/
curl http://localhost:8080/users/123
curl http://localhost:8080/slow
curl http://localhost:8080/error
```

### 8. View in Sematext Cloud

1. **Traces**: Open your Sematext Tracing App - see custom spans with nested operations
2. **Metrics**: Open your Sematext Monitoring App - view custom metrics
3. **Logs**: Open your Sematext Logs App - see correlated logs with trace IDs

## Kubernetes Configuration

### Deployment Manifest

The `deployment.yaml` includes all three OTLP endpoints:

```yaml
env:
- name: OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4338"
- name: OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4318"
- name: OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  value: "http://st-agent-sematext-agent.sematext.svc.cluster.local:4328"
```

### Key Differences from Auto-Instrumentation

- Includes logs endpoint (port 4328)
- Includes `OTEL_SERVICE_NAMESPACE` from Kubernetes metadata
- `OtelConfig.php` configures TracerProvider, MeterProvider, and LoggerProvider

## Common Tasks

### View Logs

```bash
kubectl logs -l app=php-laravel-k8s-manual -f
```

### Scale Deployment

```bash
kubectl scale deployment php-laravel-k8s-manual --replicas=3
```

### Update Application

```bash
# Build new image
docker build -t php-laravel-k8s-manual:latest .

# Load into Minikube
minikube image load php-laravel-k8s-manual:latest

# Restart deployment to use new image
kubectl rollout restart deployment/php-laravel-k8s-manual
```

### Delete Deployment

```bash
kubectl delete -f deployment.yaml
```

## Troubleshooting

### Pods Not Starting

1. **Check pod status**:
   ```bash
   kubectl describe pod -l app=php-laravel-k8s-manual
   ```

2. **Check events**:
   ```bash
   kubectl get events --sort-by='.lastTimestamp'
   ```

3. **Check image availability in Minikube**:
   ```bash
   minikube image ls | grep php-laravel-k8s-manual
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
   kubectl exec -it <pod-name> -- curl -s http://st-agent-sematext-agent.sematext.svc.cluster.local:4338
   ```

### DNS Resolution Issues

```bash
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup st-agent-sematext-agent.sematext.svc.cluster.local
```

## Next Steps

- **Add Ingress**: Expose application externally
- **Set up HPA**: Auto-scale based on metrics
- **Compare with auto**: See [Auto-Instrumentation K8s example](../../auto-instrumentation/laravel/)

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Minikube Documentation](https://minikube.sigs.k8s.io/docs/)
- [Sematext Agent Helm Chart](https://github.com/sematext/helm-charts)
- [Sematext Agent Documentation](https://sematext.com/docs/agents/sematext-agent/opentelemetry/)
- [OpenTelemetry PHP](https://opentelemetry.io/docs/languages/php/)
