# JustApps

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

### OIDC Configuration (NextAuth / Auth.js)

To enable OIDC integration in the frontend, set the following environment variables:

- `AUTH_OIDC_ID`: OIDC client ID (e.g., `justapps`)
- `AUTH_OIDC_SECRET`: OIDC client secret
- `AUTH_OIDC_ISSUER`: OIDC issuer URL (e.g., `https://<idp-url>/application/o/<slug>/` or `https://<keycloak-url>/realms/<realm-name>`)
- `AUTH_SECRET`: A random secret for NextAuth sessions (e.g., `openssl rand -base64 32`)
- `AUTH_ADMIN_GROUP`: OIDC group name mapped to admin role (e.g., `2Fa` or `admin`)

### Admin Management

Admin users can access the management dashboard at `/management` to manage both Applications and Users.
The "Users" tab allows admins to:
- List all registered users
- Create new users manually
- Edit user details (Role, Username, Email)
- Disable/Enable user accounts
- Delete users

