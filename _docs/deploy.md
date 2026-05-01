# Deployment Guide

This project is deployed to Cloudflare Workers using a GitHub Actions pipeline. The worker serves both the backend API and the static frontend assets.

## Deployment Pipeline

The deployment is managed by the `.github/workflows/deploy.yml` workflow.

### Triggers
- **Manual Trigger**: Can be started manually from the GitHub Actions tab. You can select the environment (e.g., `default`).
- **Tag Trigger**: Automatically starts when a tag matching the pattern `v*` (e.g., `v1.0.0`) is pushed.

### Build Process
The pipeline does not deploy directly from the root folder. Instead, it creates a temporary `__deploy` directory during execution:
1.  Copies all files from the `worker/` directory into `__deploy/`.
2.  Copies all frontend files from `src/` into `__deploy/public/`.
3.  Generates a `version.json` file in `__deploy/public/` with build details (date, branch, tag, action ID).
4.  Fetches the environment-specific configuration from `_devops/<env>/config.js` and places it at `__deploy/public/config.js`.
5.  Runs `npm install` in `__deploy/`.
6.  Deploys to Cloudflare using `wrangler`.

## Configuration

### Environment-Specific Config
Configuration files for different environments are stored in the `_devops/` directory:
- `_devops/default/config.js`: The default configuration used for automatic and manual deployments.

### GitHub Secrets
The following secrets must be configured in the GitHub repository:
- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API token with Workers deployment permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

## Worker Setup

The Cloudflare Worker is configured to serve static assets using the `[assets]` binding in `wrangler.toml`. The `worker/src/index.js` includes a fallback mechanism to serve these assets if no API route matches:

```javascript
// worker/src/index.js
export default {
  async fetch(request, env) {
    // ... API routes ...

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  },
};
```

The `wrangler.toml` points to the `public` directory for assets:

```toml
[assets]
directory = "./public"
binding = "ASSETS"
```
