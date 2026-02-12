# PLAIN App-Store

## Kubernetes Deployment

This application supports deployment on Kubernetes with dynamic configuration via ConfigMaps.

### Configuration

The app store's content is defined in `config.yaml`. In a Kubernetes environment, this can be managed via a ConfigMap.

1. **Apply the ConfigMap**:
   ```bash
   kubectl apply -f k8s/configmap.yaml
   ```

2. **Deploy the Application**:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

### Overriding the Config Path

By default, the app looks for `config.yaml` in the root directory. In the provided Kubernetes manifests, we mount the ConfigMap to `/app/config/config.yaml` and set the `APP_CONFIG_PATH` environment variable:

```yaml
env:
  - name: APP_CONFIG_PATH
    value: "/app/config/config.yaml"
```

### Dynamic Updates

The pages are configured with `force-dynamic`, meaning they will read the `config.yaml` from the mounted volume on every request. Note that Kubernetes ConfigMap updates to mounted volumes can take some time to propagate to the container's file system.
