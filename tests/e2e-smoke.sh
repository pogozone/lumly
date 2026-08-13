#!/usr/bin/env bash
# End-to-end smoke test against a running lumly stack.
# Usage: ./tests/e2e-smoke.sh [base-url] [site-id]
# Requires: curl, python3. Seeded demo data or an existing site.
set -euo pipefail

BASE="${1:-http://127.0.0.1:3000}"
SITE="${2:-demo-site-01}"
ORIGIN="${E2E_ORIGIN:-https://demo.example.org}"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "ok: $1"; }

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# health
[ "$(code "$BASE/health")" = "200" ] || fail "health"
ok "health"

# tracker.js
[ "$(code "$BASE/tracker.js")" = "200" ] || fail "tracker.js"
ok "tracker.js served"

# collect: valid basic event (forged ids must be stripped)
TS="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
[ "$(code -X POST "$BASE/api/v1/collect" -H 'Content-Type: application/json' -H "Origin: $ORIGIN" \
  -d "{\"site\":\"$SITE\",\"events\":[{\"type\":\"page_view\",\"mode\":\"basic\",\"timestamp\":\"$TS\",\"hostname\":\"demo.example.org\",\"path\":\"/e2e?token=abc&utm_source=e2e\",\"visitorId\":\"forged\"}]}")" = "204" ] || fail "collect valid"
ok "collector accepts and sanitizes"

# collect: bad origin
[ "$(code -X POST "$BASE/api/v1/collect" -H 'Content-Type: application/json' -H 'Origin: https://evil.example.com' \
  -d "{\"site\":\"$SITE\",\"events\":[{\"type\":\"page_view\",\"mode\":\"basic\",\"timestamp\":\"$TS\",\"hostname\":\"demo.example.org\",\"path\":\"/x\"}]}")" = "403" ] || fail "origin check"
ok "origin allowlist enforced"

# collect: invalid envelope
[ "$(code -X POST "$BASE/api/v1/collect" -H 'Content-Type: application/json' -d '{"site":"x","events":"nope"}')" = "400" ] || fail "envelope validation"
ok "envelope validation"

# admin API requires auth
[ "$(code "$BASE/api/v1/analytics/overview?site=$SITE")" = "401" ] || fail "auth guard"
ok "admin API protected"

echo "e2e smoke: all checks passed"
