#!/usr/bin/env bash
# Long-running Next.js dev server (transovo-web) for the Cloud Agent terminal.
# Waits for the local Supabase stack to be ready (start.sh brings it up), then
# launches `npm run dev`.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "[run-dev] waiting for local Supabase REST API on :54321 ..."
for _ in $(seq 1 120); do
  if curl -fsS --noproxy '*' -o /dev/null "http://127.0.0.1:54321/rest/v1/" \
      -H "apikey: dummy" 2>/dev/null || [ -f .env ]; then
    break
  fi
  sleep 2
done

echo "[run-dev] starting Next.js dev server on http://localhost:3000"
exec npm run dev
