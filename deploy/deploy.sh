#!/usr/bin/env bash
# deploy/deploy.sh
#
# Remote deployment script for aiwholesail (static Vite build).
# Runs ON the VPS after rsync delivers files.
#
# Usage:
#   bash deploy.sh              # defaults to production
#   bash deploy.sh staging      # deploys staging environment
#
# Why the reset-failed + /health smoke-test:
#   Incident 2026-05-13 — PR #315 introduced a ReferenceError that crashed
#   the API on boot. systemd's restart loop hit the start-limit-burst cap
#   and stopped attempting. The hot-fix (PR #321) deployed correct code,
#   but `systemctl restart` no-op'd because the unit was in the `failed`
#   state. Production stayed dead for ~17 min until someone manually
#   `reset-failed`'d the unit on the VPS.
#
#   This script now:
#     1. Resets the failure counter BEFORE restart, so a previously-failed
#        unit gets a fresh chance to come up.
#     2. Curls /health after restart with retry, failing the deploy if
#        the service doesn't actually serve traffic. Bridges the gap
#        between "code deployed" and "code running".

set -euo pipefail

ENV="${1:-production}"

if [[ "$ENV" == "staging" ]]; then
  FRONTEND_DIR="/var/www/staging.aiwholesail.com"
  API_SERVICE="aiwholesail-api-staging"
  HEALTH_URL="http://127.0.0.1:3203/health"  # staging API listens on 3203
else
  FRONTEND_DIR="/var/www/aiwholesail.com"
  API_SERVICE="aiwholesail-api"
  HEALTH_URL="http://127.0.0.1:3202/health"
fi

# Smoke-test budget: 6 attempts × 2s gap = 12s wall-clock max.
# Node API normally answers /health within 1-2s of restart.
HEALTH_RETRIES=6
HEALTH_GAP_SEC=2

echo "Deploying ${ENV} environment..."

# Fix frontend permissions
if [[ -d "${FRONTEND_DIR}" ]]; then
  echo "Setting permissions on ${FRONTEND_DIR}..."
  find "${FRONTEND_DIR}" -type d -exec chmod 755 {} \;
  find "${FRONTEND_DIR}" -type f -exec chmod 644 {} \;
fi

# Restart API service
if systemctl list-units --full -all | grep -q "${API_SERVICE}.service"; then
  # Clear any prior failure state so the restart isn't no-op'd by the
  # start-limit-burst cap. Harmless on a healthy unit (idempotent).
  echo "Clearing prior failure state on ${API_SERVICE} (if any)..."
  sudo systemctl reset-failed "${API_SERVICE}" || true

  echo "Restarting ${API_SERVICE}..."
  sudo systemctl restart "${API_SERVICE}"
  sleep 2
  if ! systemctl is-active --quiet "${API_SERVICE}"; then
    echo "ERROR: ${API_SERVICE} is not active after restart."
    journalctl -u "${API_SERVICE}" --no-pager -n 20
    exit 1
  fi
  echo "${API_SERVICE} is running."

  # /health smoke-test — fail the deploy if the service doesn't actually
  # serve traffic. Catches crash-on-boot bugs that `is-active` misses
  # during the narrow window before systemd notices the exit.
  echo "Smoke-testing ${HEALTH_URL}..."
  attempt=1
  while (( attempt <= HEALTH_RETRIES )); do
    status_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
    if [[ "${status_code}" == "200" ]]; then
      echo "Health check passed on attempt ${attempt} (HTTP 200)."
      break
    fi
    if (( attempt == HEALTH_RETRIES )); then
      echo "ERROR: Health check failed after ${HEALTH_RETRIES} attempts (last status: ${status_code})."
      journalctl -u "${API_SERVICE}" --no-pager -n 20
      exit 1
    fi
    echo "  attempt ${attempt}/${HEALTH_RETRIES} → HTTP ${status_code}, retrying in ${HEALTH_GAP_SEC}s..."
    sleep "${HEALTH_GAP_SEC}"
    (( attempt++ ))
  done
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
