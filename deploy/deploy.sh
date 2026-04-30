#!/usr/bin/env bash
# deploy/deploy.sh
#
# Remote deployment script for aiwholesail (static Vite build).
# Runs ON the VPS after rsync delivers files.
#
# Usage:
#   bash deploy.sh              # defaults to production
#   bash deploy.sh staging      # deploys staging environment

set -euo pipefail

ENV="${1:-production}"

if [[ "$ENV" == "staging" ]]; then
  FRONTEND_DIR="/var/www/staging.aiwholesail.com"
  API_SERVICE="aiwholesail-api-staging"
else
  FRONTEND_DIR="/var/www/aiwholesail.com"
  API_SERVICE="aiwholesail-api"
fi

echo "Deploying ${ENV} environment..."

# Fix frontend permissions
if [[ -d "${FRONTEND_DIR}" ]]; then
  echo "Setting permissions on ${FRONTEND_DIR}..."
  find "${FRONTEND_DIR}" -type d -exec chmod 755 {} \;
  find "${FRONTEND_DIR}" -type f -exec chmod 644 {} \;
fi

# Restart API service
if systemctl list-units --full -all | grep -q "${API_SERVICE}.service"; then
  echo "Restarting ${API_SERVICE}..."
  sudo systemctl restart "${API_SERVICE}"
  sleep 2
  if systemctl is-active --quiet "${API_SERVICE}"; then
    echo "${API_SERVICE} is running."
  else
    echo "ERROR: ${API_SERVICE} failed to start."
    journalctl -u "${API_SERVICE}" --no-pager -n 10
    exit 1
  fi
fi

# Reload nginx
echo "Reloading nginx..."
sudo systemctl reload nginx
if systemctl is-active --quiet nginx; then
  echo "nginx is running."
else
  echo "ERROR: nginx is not active after reload."
  exit 1
fi

DEPLOY_TIME=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "${ENV} deployment complete at ${DEPLOY_TIME}."
