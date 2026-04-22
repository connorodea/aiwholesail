#!/usr/bin/env bash
# deploy/deploy.sh
#
# Remote deployment script for aiwholesail (static Vite build).
# This script runs ON the VPS after rsync has delivered dist/ to
# /var/www/aiwholesail/dist/.
#
# Responsibilities:
#   1. Fix ownership/permissions on the delivered files.
#   2. Reload nginx to pick up any config changes (non-restart — zero downtime).
#   3. Emit a clear success or failure message.
#
# Requirements (one-time VPS bootstrap):
#   - nginx installed and serving /var/www/aiwholesail/dist
#   - deploy user has passwordless sudo for: nginx, chown on /var/www/aiwholesail
#     Example sudoers line:
#       deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx, \
#                                  /usr/bin/chown -R www-data:www-data /var/www/aiwholesail/dist

set -euo pipefail

APP_DIR="/var/www/aiwholesail"
DIST_DIR="${APP_DIR}/dist"

# --------------------------------------------------------------------------
# Guard: ensure the dist directory was actually delivered.
# --------------------------------------------------------------------------
if [[ ! -d "${DIST_DIR}" ]]; then
  echo "ERROR: dist directory not found at ${DIST_DIR}. Rsync may have failed."
  exit 1
fi

echo "Starting deployment for aiwholesail..."

# --------------------------------------------------------------------------
# Step 1: Fix ownership so nginx (www-data) can read the files.
# --------------------------------------------------------------------------
echo "Setting file ownership on ${DIST_DIR}..."
sudo chown -R www-data:www-data "${DIST_DIR}"
# Directories need execute permission; files need read permission only.
find "${DIST_DIR}" -type d -exec chmod 755 {} \;
find "${DIST_DIR}" -type f -exec chmod 644 {} \;
echo "Ownership and permissions set."

# --------------------------------------------------------------------------
# Step 2: Reload nginx.
#   - 'reload' sends SIGHUP — nginx re-reads config and swaps workers
#     without dropping existing connections (zero downtime).
#   - Use 'restart' only if config changes require a full process restart.
# --------------------------------------------------------------------------
echo "Reloading nginx..."
sudo systemctl reload nginx
echo "nginx reloaded."

# --------------------------------------------------------------------------
# Step 3: Confirm nginx is healthy.
# --------------------------------------------------------------------------
if systemctl is-active --quiet nginx; then
  echo "nginx is running."
else
  echo "ERROR: nginx is not active after reload. Check 'journalctl -u nginx'."
  exit 1
fi

# --------------------------------------------------------------------------
# Done.
# --------------------------------------------------------------------------
DEPLOY_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "Deployment complete at ${DEPLOY_TIME}."
