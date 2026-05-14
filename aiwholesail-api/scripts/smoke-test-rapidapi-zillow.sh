#!/usr/bin/env bash
# Smoke test for the RapidAPI gateway mount.
#
# Verifies:
#   1. Without the proxy-secret header → 401
#   2. With the wrong secret → 401 (timing-safe path)
#   3. With the right secret → 200 (or whatever the upstream returns)
#
# Requires RAPIDAPI_PROXY_SECRET in env or .env.
# Usage:
#   ./scripts/smoke-test-rapidapi-zillow.sh                    # against local
#   BASE=https://api.aiwholesail.com ./scripts/smoke-test-rapidapi-zillow.sh
set -euo pipefail

BASE="${BASE:-http://localhost:3202}"
SECRET="${RAPIDAPI_PROXY_SECRET:-$(grep '^RAPIDAPI_PROXY_SECRET=' .env 2>/dev/null | cut -d= -f2-)}"

if [ -z "${SECRET:-}" ]; then
  echo "RAPIDAPI_PROXY_SECRET not set." >&2
  exit 1
fi

echo "=== 1. no header → expect 401 ==="
curl -s -o /tmp/r1 -w "HTTP %{http_code}\n" \
  -X POST "$BASE/rapidapi/zillow/proxy" \
  -H "Content-Type: application/json" \
  -d '{"action":"zestimate","searchParams":{"zpid":"32345678"}}'
echo "  body: $(cat /tmp/r1)"

echo ""
echo "=== 2. wrong secret → expect 401 ==="
curl -s -o /tmp/r2 -w "HTTP %{http_code}\n" \
  -X POST "$BASE/rapidapi/zillow/proxy" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Proxy-Secret: wrong-value-deadbeef" \
  -H "x-rapidapi-user: smoke" \
  -d '{"action":"zestimate","searchParams":{"zpid":"32345678"}}'
echo "  body: $(cat /tmp/r2)"

echo ""
echo "=== 3. right secret → expect 200 ==="
curl -s -o /tmp/r3 -w "HTTP %{http_code}\n" \
  -X POST "$BASE/rapidapi/zillow/proxy" \
  -H "Content-Type: application/json" \
  -H "X-RapidAPI-Proxy-Secret: $SECRET" \
  -H "x-rapidapi-user: smoke" \
  -d '{"action":"zestimate","searchParams":{"zpid":"32345678"}}'
echo "  body: $(head -c 400 /tmp/r3)"

echo ""
echo "✓ smoke test complete"
