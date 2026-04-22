# AIwholesail — Deployment Setup Checklist

This document covers everything needed to get CI/CD running from a clean state.
Complete the VPS bootstrap once, then GitHub Actions handles all subsequent deploys.

---

## Architecture Overview

```
GitHub push to main
  └── CI job: npm ci → tsc typecheck → vite build → upload dist/ artifact
        └── Deploy job: rsync dist/ → VPS → deploy.sh (chown + nginx reload)
```

- Build happens on the GitHub Actions runner — never on the production server.
- Artifacts are transferred via rsync over SSH.
- The VPS only serves static files through nginx; no Node.js process runs here.
- The backend API (aiwholesail-api/) is deployed separately.

---

## 1. VPS Bootstrap (one-time)

SSH into the server: `ssh hetznerCO`

### 1a. Create the deploy user (if not already present)

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/aiwholesail/dist
sudo chown -R deploy:deploy /var/www/aiwholesail
```

### 1b. Grant the deploy user passwordless sudo for nginx reload and chown

```bash
sudo visudo -f /etc/sudoers.d/deploy-aiwholesail
```

Add this content:

```
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
deploy ALL=(ALL) NOPASSWD: /usr/bin/chown -R www-data:www-data /var/www/aiwholesail/dist
```

### 1c. Add the GitHub Actions deploy SSH public key

Generate a dedicated keypair on your local machine (do not use a passphrase):

```bash
ssh-keygen -t ed25519 -C "github-actions-aiwholesail" -f ~/.ssh/aiwholesail_deploy
```

Copy the public key to the VPS:

```bash
ssh-copy-id -i ~/.ssh/aiwholesail_deploy.pub deploy@<VPS_IP>
```

Or manually append the public key to `/home/deploy/.ssh/authorized_keys` on the VPS.

The **private** key (`~/.ssh/aiwholesail_deploy`) becomes the `HETZNER_CO_SSH_KEY` secret (see below).

### 1d. Configure nginx to serve the dist directory

Example nginx server block (`/etc/nginx/sites-available/aiwholesail`):

```nginx
server {
    listen 80;
    server_name aiwholesail.com www.aiwholesail.com;

    root /var/www/aiwholesail/dist;
    index index.html;

    # React Router — send all non-asset requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-lived cache for Vite-hashed assets
    location ~* \.(js|css|woff2?|svg|png|jpg|ico|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site and test:

```bash
sudo ln -s /etc/nginx/sites-available/aiwholesail /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 1e. (Optional) Set up TLS with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d aiwholesail.com -d www.aiwholesail.com
```

---

## 2. GitHub Repository Secrets

Navigate to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret name         | Value                                                  |
|---------------------|--------------------------------------------------------|
| `HETZNER_CO_HOST`   | VPS IP address or hostname                             |
| `HETZNER_CO_USER`   | `deploy`                                               |
| `HETZNER_CO_SSH_KEY`| Full contents of the private key file (ed25519)        |
| `HETZNER_CO_PORT`   | SSH port — omit or set to `22` if using the default    |

To copy the private key to your clipboard on macOS:

```bash
pbcopy < ~/.ssh/aiwholesail_deploy
```

---

## 3. Verify the Pipeline

1. Push any commit to `main`.
2. Open the **Actions** tab in GitHub.
3. The `CI / Deploy` workflow should appear and run both jobs.
4. Confirm the site is live by loading the domain in a browser.

---

## 4. Manual Deploy (emergency)

If GitHub Actions is unavailable, deploy manually from your local machine:

```bash
npm ci
npm run build
rsync -az --delete dist/ deploy@<VPS_IP>:/var/www/aiwholesail/dist/
ssh deploy@<VPS_IP> 'bash /var/www/aiwholesail/deploy.sh'
```

---

## 5. Rollback

The simplest rollback is to revert the commit on `main` and let CI redeploy:

```bash
git revert HEAD --no-edit
git push origin main
```

For an immediate rollback without waiting for CI, keep the previous `dist/` build
tarred somewhere accessible and rsync it directly.

---

## 6. Troubleshooting

| Symptom | Check |
|---------|-------|
| CI fails on typecheck | Run `npx tsc --noEmit -p tsconfig.app.json` locally |
| CI fails on build | Run `npm run build` locally; check for missing env vars |
| Deploy fails: "directory not found" | Run the VPS bootstrap steps in section 1 |
| Deploy fails: SSH auth error | Verify `HETZNER_CO_SSH_KEY` secret matches the public key in `authorized_keys` |
| nginx reload fails | SSH in, run `sudo nginx -t` to check config syntax |
| Site shows stale content | Hard-reload the browser; Vite hashes asset filenames so cache busting is automatic |
| Concurrent deploys cancelled | Expected — concurrency group ensures only the latest push deploys |
