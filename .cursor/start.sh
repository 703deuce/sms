#!/usr/bin/env bash
# Per-boot reconciliation: bring up Docker + the local Supabase stack, write the
# app .env, and ensure the schema + demo seed exist. Idempotent and returns once
# the database is ready. The Next.js dev server itself runs in a terminal.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# shellcheck source=/dev/null
source ".cursor/lib.sh"

start_docker
start_supabase
write_env
apply_schema_and_seed

log "environment ready — app DB is up, schema applied, demo workspace seeded"
log "login: alex@harborhome.co / demo1234"
