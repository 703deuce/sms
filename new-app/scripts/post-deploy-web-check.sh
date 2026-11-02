#!/usr/bin/env bash
# After Coolify web deploy: smoke /app and confirm health SHA (not part of vitest).
set -euo pipefail
BASE="${PRODUCTION_BASE_URL:-https://transovo.ai}"
EXPECTED_SHA="${1:-}"

echo "== post-deploy: GET $BASE/app/clips =="
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/app/clips" || echo 000)"
if [[ "$CODE" == "500" ]] || [[ "$CODE" == "000" ]]; then
  echo "FAIL: /app/clips HTTP $CODE (must not be 500)" >&2
  exit 1
fi
echo "HTTP $CODE"

echo "== post-deploy: GET $BASE/api/health =="
HEALTH="$(curl -sS "$BASE/api/health")"
echo "$HEALTH"
if echo "$HEALTH" | rg -q '"ok"\s*:\s*false'; then
  echo "FAIL: /api/health ok:false" >&2
  exit 1
fi
if [[ -n "$EXPECTED_SHA" ]]; then
  ACTUAL="$(echo "$HEALTH" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).commitSha||'')}catch{}})")"
  if [[ "$ACTUAL" != "$EXPECTED_SHA" ]]; then
    echo "FAIL: commitSha $ACTUAL != expected $EXPECTED_SHA" >&2
    exit 1
  fi
  echo "commitSha matches $EXPECTED_SHA"
fi

echo "== post-deploy: grep web container logs (first minute ReferenceError/TypeError) =="
echo "Run on Coolify host if needed:"
echo "  ssh coolify-server 'docker logs --since 1m \$(docker ps -q --filter label=coolify.applicationId=1 | head -1) 2>&1 | rg \"ReferenceError|TypeError\" || true'"
echo "post-deploy-web-check ok"
