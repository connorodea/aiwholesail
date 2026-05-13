#!/usr/bin/env bash
# .github/scripts/health-probe-or-rollback.sh
#
# Runs ON the VPS (via SSH heredoc) after systemctl restart.
# Polls /health for up to POLL_TOTAL_SECS. If it never returns HTTP 200,
# auto-rolls back to the SHA captured BEFORE the deploy, then alerts via
# Resend (using the API's own onfailure-notify helper) and exits non-zero.
#
# Arguments (positional, all required):
#   $1  APP_DIR        — absolute path to the app directory on disk
#   $2  SERVICE_NAME   — systemd service name
#   $3  HEALTH_URL     — full URL to poll (e.g. http://localhost:3202/health)
#   $4  PREV_SHA       — git SHA to reset to on rollback
#   $5  RESEND_API_KEY — key used by onfailure-notify.js to send the alert
#   $6  OPERATOR_EMAIL — alert recipient (default: cpodea5@gmail.com)
#
# Design notes:
#   - POLL_INTERVAL=2s, POLL_TOTAL_SECS=60 → max 30 attempts
#   - The first ~3s after systemd restart is normal 502 territory; we
#     don't count those early misses specially — the 60s window is
#     conservative enough to absorb normal restart jitter.
#   - On rollback: reset --hard, npm ci --omit=dev, restart, re-probe once.
#   - If the rollback itself fails we still exit non-zero so the job fails loud.
#   - We never bash-source .env (values may contain $2 etc.) — the Node
#     process reads dotenv itself.

set -euo pipefail

APP_DIR="${1:?APP_DIR is required}"
SERVICE_NAME="${2:?SERVICE_NAME is required}"
HEALTH_URL="${3:?HEALTH_URL is required}"
PREV_SHA="${4:?PREV_SHA is required}"
RESEND_API_KEY="${5:?RESEND_API_KEY is required}"
OPERATOR_EMAIL="${6:-cpodea5@gmail.com}"

POLL_INTERVAL=2
POLL_TOTAL_SECS=60
MAX_ATTEMPTS=$(( POLL_TOTAL_SECS / POLL_INTERVAL ))

# ---------------------------------------------------------------------------
# Poll /health
# ---------------------------------------------------------------------------
echo "[health-probe] Polling ${HEALTH_URL} (${MAX_ATTEMPTS} attempts × ${POLL_INTERVAL}s)"

attempt=0
healthy=false
while [[ "${attempt}" -lt "${MAX_ATTEMPTS}" ]]; do
  attempt=$(( attempt + 1 ))
  http_code=$(curl --silent --max-time 3 --output /dev/null --write-out '%{http_code}' "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "${http_code}" == "200" ]]; then
    echo "[health-probe] ${HEALTH_URL} returned 200 on attempt ${attempt}. Service healthy."
    healthy=true
    break
  fi
  echo "[health-probe] Attempt ${attempt}/${MAX_ATTEMPTS}: HTTP ${http_code} — waiting ${POLL_INTERVAL}s"
  sleep "${POLL_INTERVAL}"
done

if [[ "${healthy}" == "true" ]]; then
  echo "[health-probe] Deploy verified healthy."
  exit 0
fi

# ---------------------------------------------------------------------------
# ROLLBACK
# ---------------------------------------------------------------------------
echo ""
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "  AUTO-ROLLBACK TRIGGERED"
echo "  Service ${SERVICE_NAME} did not return HTTP 200 within ${POLL_TOTAL_SECS}s."
echo "  Rolling back to SHA: ${PREV_SHA}"
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo ""

ROLLBACK_OK=false

cd "${APP_DIR}"

# Reset code to the pre-deploy SHA
if git reset --hard "${PREV_SHA}"; then
  echo "[rollback] git reset --hard ${PREV_SHA} succeeded."
else
  echo "[rollback] ERROR: git reset --hard failed. Manual intervention required."
fi

# Reinstall deps for the rolled-back version
if npm ci --omit=dev 2>&1 | tail -3; then
  echo "[rollback] npm ci succeeded."
else
  echo "[rollback] ERROR: npm ci failed. Manual intervention required."
fi

# Restart service on rolled-back code
if sudo systemctl restart "${SERVICE_NAME}"; then
  echo "[rollback] systemctl restart ${SERVICE_NAME} succeeded."
else
  echo "[rollback] ERROR: systemctl restart failed."
fi

# Give it a moment, then confirm the rollback is healthy
sleep 3
rollback_code=$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' "${HEALTH_URL}" 2>/dev/null || echo "000")
if [[ "${rollback_code}" == "200" ]]; then
  echo "[rollback] Rolled-back service is healthy (HTTP 200)."
  ROLLBACK_OK=true
else
  echo "[rollback] ERROR: Rolled-back service is NOT healthy (HTTP ${rollback_code}). Manual intervention required."
fi

# ---------------------------------------------------------------------------
# Send alert email via Resend (reuse the app's onfailure-notify pattern)
# ---------------------------------------------------------------------------
CURRENT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
ROLLBACK_STATUS="${ROLLBACK_OK}"

# Emit a compact JSON payload to Resend's API directly — avoids needing
# node/dotenv loaded. The onfailure-notify.js requires dotenv + the full
# .env present, which is not available in a CI-driven SSH session.
SUBJECT="[AUTO-ROLLBACK] ${SERVICE_NAME} — deploy failed, rolled back to ${PREV_SHA:0:8}"
BODY_TEXT="Deploy of ${SERVICE_NAME} failed health check after ${POLL_TOTAL_SECS}s.\n\nPrev SHA (rolled back to): ${PREV_SHA}\nFailed SHA: see workflow run\nTimestamp: ${TS}\nRollback healthy: ${ROLLBACK_STATUS}\n\nCheck GitHub Actions for the failed workflow run."

# Use curl to call Resend directly — no Node/dotenv dependency
curl --silent --max-time 10 \
  --request POST \
  --url 'https://api.resend.com/emails' \
  --header "Authorization: Bearer ${RESEND_API_KEY}" \
  --header 'Content-Type: application/json' \
  --data "{
    \"from\": \"AIWholesail Monitor <noreply@aiwholesail.com>\",
    \"to\": [\"${OPERATOR_EMAIL}\"],
    \"subject\": \"${SUBJECT}\",
    \"text\": \"${BODY_TEXT}\"
  }" \
  --output /dev/null \
  && echo "[rollback] Alert email dispatched to ${OPERATOR_EMAIL}." \
  || echo "[rollback] WARNING: Alert email failed to send. Check RESEND_API_KEY."

# ---------------------------------------------------------------------------
# Exit non-zero so the workflow job fails visibly
# ---------------------------------------------------------------------------
echo ""
echo "AUTO-ROLLBACK COMPLETE. Workflow will now fail with a clear error."
echo "  Service:      ${SERVICE_NAME}"
echo "  Failed SHA:   (see workflow run)"
echo "  Rollback SHA: ${PREV_SHA}"
echo "  Rollback OK:  ${ROLLBACK_OK}"
echo ""
exit 1
