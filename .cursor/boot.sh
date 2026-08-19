#!/usr/bin/env bash
# Per-boot entrypoint used as the environment `start` command: bring the local
# infrastructure up (Docker + Supabase + schema + seed), then run the Next.js
# dev server attached so the app is reachable at http://localhost:3000.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

bash .cursor/start.sh
exec npm run dev
