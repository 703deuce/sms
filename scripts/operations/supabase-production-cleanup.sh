#!/usr/bin/env bash
# Supabase production size reduction — run on Coolify host (has DATABASE_URL).
# Keeps schema; deletes operational bloat. Default: dry-run only.
#
# Usage:
#   ./supabase-production-cleanup.sh              # report + dry-run delete counts
#   ./supabase-production-cleanup.sh --execute    # apply safe tier deletes + VACUUM (non-FULL)
#   ./supabase-production-cleanup.sh --execute --aggressive
#
# Env (optional):
#   TRANSOVO_PG_DUMP_USE_DIRECT=1   # use db.<ref>.supabase.co when pooler fails
#   COOLIFY_APP_ENV_FILE, TRANSOVO_WEB_CONTAINER_PREFIX (default ds8s3hjin60qs6g7s0iqkixs)
#   CLEANUP_KEEP_DAYS=14            # retention for "safe" log/event deletes
set -euo pipefail

EXECUTE=0
AGGRESSIVE=0
KEEP_DAYS="${CLEANUP_KEEP_DAYS:-14}"
COOLIFY_ENV="${COOLIFY_APP_ENV_FILE:-/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env}"
CONTAINER_PREFIX="${TRANSOVO_WEB_CONTAINER_PREFIX:-ds8s3hjin60qs6g7s0iqkixs}"
PG_IMAGE="${TRANSOVO_PG_DUMP_IMAGE:-postgres:17-alpine}"
LOG_PREFIX="[supabase-cleanup]"

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --aggressive) AGGRESSIVE=1 ;;
    --help|-h)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "${LOG_PREFIX} ERROR: unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

resolve_web_container() {
  docker ps --format '{{.Names}}' | grep -E "^${CONTAINER_PREFIX}-" | head -1 || true
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  WEB_CONTAINER="$(resolve_web_container)"
  if [[ -n "$WEB_CONTAINER" ]]; then
    DATABASE_URL="$(docker exec "$WEB_CONTAINER" printenv DATABASE_URL 2>/dev/null || true)"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]] && [[ -f "$COOLIFY_ENV" ]]; then
  DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$COOLIFY_ENV" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "${LOG_PREFIX} ERROR: DATABASE_URL not set (web container or ${COOLIFY_ENV})" >&2
  exit 1
fi

export DATABASE_URL

PG_ENV_FILE="$(mktemp)"
chmod 600 "$PG_ENV_FILE"
python3 <<'PY' >"$PG_ENV_FILE"
import os
from urllib.parse import urlparse, unquote

raw = os.environ.get("DATABASE_URL", "")
u = urlparse(raw.replace("postgresql://", "http://", 1))
user = unquote(u.username or "")
password = unquote(u.password or "")
host = u.hostname or ""
port = u.port or 5432
db = (u.path or "/postgres").lstrip("/") or "postgres"
ref = user.replace("postgres.", "", 1) if user.startswith("postgres.") else ""
use_direct = os.environ.get("TRANSOVO_PG_DUMP_USE_DIRECT", "").strip() == "1"
if use_direct and ref and ("pooler.supabase.com" in host or use_direct):
    host = f"db.{ref}.supabase.co"
    port = 5432
print(f"PGHOST={host}")
print(f"PGPORT={port}")
print(f"PGUSER={user}")
print(f"PGPASSWORD={password}")
print(f"PGDATABASE={db}")
print("PGSSLMODE=require")
if ref:
    print(f"SUPABASE_PROJECT_REF={ref}")
PY

run_psql() {
  docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" \
    psql -v ON_ERROR_STOP=1 -X -q "$@"
}

run_psql_tuples() {
  docker run --rm --env-file "$PG_ENV_FILE" "$PG_IMAGE" \
    psql -v ON_ERROR_STOP=1 -X -t -A "$@"
}

echo "${LOG_PREFIX} mode=$([ "$EXECUTE" = 1 ] && echo EXECUTE || echo DRY_RUN) aggressive=$AGGRESSIVE keep_days=${KEEP_DAYS}"
echo "${LOG_PREFIX} connecting (host redacted; user from pooler ref only)"

if ! run_psql -c "SELECT 1 AS ok;" >/dev/null 2>"${PG_ENV_FILE}.err"; then
  echo "${LOG_PREFIX} ERROR: cannot connect with current DATABASE_URL" >&2
  sed 's/PGPASSWORD=.*/PGPASSWORD=*** redacted ***/' "${PG_ENV_FILE}.err" >&2 || true
  echo "${LOG_PREFIX} Hint: if Supabase project is paused, resume or reduce disk in dashboard first." >&2
  echo "${LOG_PREFIX} Hint: try TRANSOVO_PG_DUMP_USE_DIRECT=1 $0 ..." >&2
  rm -f "$PG_ENV_FILE" "${PG_ENV_FILE}.err"
  exit 2
fi
rm -f "${PG_ENV_FILE}.err"

echo ""
echo "=== Database size ==="
run_psql -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;"

echo ""
echo "=== Top 40 tables by total size (incl. indexes) ==="
run_psql <<'SQL'
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total,
       pg_size_pretty(pg_relation_size(relid)) AS heap
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 40;
SQL

echo ""
echo "=== Row counts (high-churn tables) ==="
run_psql <<'SQL'
SELECT 'job_queue' AS tbl, count(*)::bigint FROM job_queue
UNION ALL SELECT 'job_queue_completed', count(*)::bigint FROM job_queue WHERE status = 'completed'
UNION ALL SELECT 'job_queue_failed', count(*)::bigint FROM job_queue WHERE status = 'failed'
UNION ALL SELECT 'job_queue_pending', count(*)::bigint FROM job_queue WHERE status IN ('pending','processing','deferred')
UNION ALL SELECT 'provider_webhook_events', count(*)::bigint FROM provider_webhook_events
UNION ALL SELECT 'platform_events', count(*)::bigint FROM platform_events
UNION ALL SELECT 'integration_webhook_events', count(*)::bigint FROM integration_webhook_events
UNION ALL SELECT 'voice_call_events', count(*)::bigint FROM voice_call_events
UNION ALL SELECT 'voice_tool_executions', count(*)::bigint FROM voice_tool_executions
UNION ALL SELECT 'telnyx_webhook_dedup', count(*)::bigint FROM telnyx_webhook_dedup
UNION ALL SELECT 'voice_webhook_deliveries', count(*)::bigint FROM voice_webhook_deliveries
UNION ALL SELECT 'missed_call_text_traces', count(*)::bigint FROM missed_call_text_traces
UNION ALL SELECT 'mctb_voice_bridge_call_events', count(*)::bigint FROM mctb_voice_bridge_call_events
UNION ALL SELECT 'cfna_ingress_probes', count(*)::bigint FROM cfna_ingress_probes
UNION ALL SELECT 'crm_sync_events', count(*)::bigint FROM crm_sync_events
UNION ALL SELECT 'integration_action_logs', count(*)::bigint FROM integration_action_logs
ORDER BY 1;
SQL

delete_where() {
  local table="$1"
  local where="$2"
  local label="$3"
  if [[ "$(run_psql_tuples -c "SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}';" 2>/dev/null || echo 0)" != "1" ]]; then
    echo "${LOG_PREFIX} skip ${label} (no table ${table})"
    return
  fi
  local count
  count="$(run_psql_tuples -c "SELECT count(*)::bigint FROM ${table} WHERE ${where};")"
  echo "${LOG_PREFIX} ${label}: would_delete=${count}"
  if [[ "$EXECUTE" = 1 ]] && [[ "$count" != "0" ]]; then
    echo "${LOG_PREFIX} deleting from ${table}..."
    if [[ "$table" == "job_queue" ]] && [[ "$count" -gt 50000 ]]; then
      local batch=25000
      local rounds=0
      while [[ "$rounds" -lt 200 ]]; do
        deleted="$(run_psql_tuples -c "WITH doomed AS (SELECT ctid FROM ${table} WHERE ${where} LIMIT ${batch}) DELETE FROM ${table} t USING doomed d WHERE t.ctid = d.ctid RETURNING 1;" | wc -l | tr -d ' ')"
        rounds=$((rounds + 1))
        echo "${LOG_PREFIX}   batch ${rounds}: deleted ~${deleted}"
        [[ "${deleted:-0}" -lt "$batch" ]] && break
      done
    else
      run_psql -c "DELETE FROM ${table} WHERE ${where};"
    fi
  fi
}

echo ""
echo "=== Cleanup plan (safe tier) ==="

# Largest known bloat: terminal job_queue rows (keep pending/processing/deferred)
delete_where job_queue "status IN ('completed','failed') AND COALESCE(\"completedAt\", \"updatedAt\", \"createdAt\") < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "job_queue terminal older than ${KEEP_DAYS}d"

delete_where provider_webhook_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "provider_webhook_events older than ${KEEP_DAYS}d"

delete_where platform_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "platform_events older than ${KEEP_DAYS}d"

delete_where integration_webhook_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "integration_webhook_events older than ${KEEP_DAYS}d"

delete_where voice_call_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "voice_call_events older than ${KEEP_DAYS}d"

delete_where voice_tool_executions "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "voice_tool_executions older than ${KEEP_DAYS}d"

delete_where telnyx_webhook_dedup "\"processedAt\" < NOW() - INTERVAL '7 days'" \
  "telnyx_webhook_dedup older than 7d"

delete_where voice_webhook_deliveries "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "voice_webhook_deliveries older than ${KEEP_DAYS}d"

delete_where missed_call_text_traces "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "missed_call_text_traces older than ${KEEP_DAYS}d"

delete_where mctb_voice_bridge_call_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "mctb_voice_bridge_call_events older than ${KEEP_DAYS}d"

delete_where cfna_ingress_probes "\"createdAt\" < NOW() - INTERVAL '7 days'" \
  "cfna_ingress_probes older than 7d"

delete_where crm_sync_events "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "crm_sync_events older than ${KEEP_DAYS}d"

delete_where integration_action_logs "\"createdAt\" < NOW() - INTERVAL '${KEEP_DAYS} days'" \
  "integration_action_logs older than ${KEEP_DAYS}d"

if [[ "$AGGRESSIVE" = 1 ]]; then
  echo ""
  echo "=== Aggressive tier (still keeps workspaces, agents, MCTB config) ==="
  delete_where job_queue "status IN ('completed','failed')" "job_queue ALL completed/failed"
  delete_where provider_webhook_events "true" "provider_webhook_events ALL"
  delete_where platform_events "true" "platform_events ALL"
  delete_where integration_webhook_events "true" "integration_webhook_events ALL"
  delete_where telnyx_webhook_dedup "true" "telnyx_webhook_dedup ALL"
  delete_where cfna_ingress_probes "true" "cfna_ingress_probes ALL"
  delete_where missed_call_text_traces "true" "missed_call_text_traces ALL"
  delete_where voice_call_events "true" "voice_call_events ALL"
  delete_where voice_tool_executions "true" "voice_tool_executions ALL"
  delete_where voice_webhook_deliveries "true" "voice_webhook_deliveries ALL"
  delete_where mctb_voice_bridge_call_events "true" "mctb_voice_bridge_call_events ALL"
  delete_where crm_sync_events "true" "crm_sync_events ALL"
  delete_where integration_action_logs "true" "integration_action_logs ALL"
  delete_where link_click_events "\"createdAt\" < NOW() - INTERVAL '30 days'" "link_click_events older than 30d"
  # Shrink large JSON on voice_calls (metadata only — not dropping calls)
  if run_psql -c "SELECT 1 FROM information_schema.columns WHERE table_name='voice_calls' AND column_name='metadata' LIMIT 1;" | grep -q 1; then
    count="$(run_psql_tuples -c "SELECT count(*)::bigint FROM voice_calls WHERE metadata IS NOT NULL AND metadata::text <> 'null' AND metadata::text <> '{}';")"
    echo "${LOG_PREFIX} voice_calls metadata wipe: would_update=${count}"
    if [[ "$EXECUTE" = 1 ]] && [[ "$count" != "0" ]]; then
      run_psql -c "UPDATE voice_calls SET metadata = '{}'::jsonb WHERE metadata IS NOT NULL AND metadata::text NOT IN ('null','{}');"
    fi
  fi
fi

if [[ "$EXECUTE" = 1 ]]; then
  echo ""
  echo "${LOG_PREFIX} running VACUUM (non-FULL) on touched tables..."
  run_psql -c "VACUUM ANALYZE job_queue, provider_webhook_events, platform_events, integration_webhook_events, voice_call_events, voice_tool_executions;" || true
  echo ""
  echo "=== Database size after cleanup ==="
  run_psql -c "SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;"
fi

rm -f "$PG_ENV_FILE"

echo ""
echo "${LOG_PREFIX} done. Supabase billing size includes DB + storage + backups — check dashboard."
if [[ "$EXECUTE" != 1 ]]; then
  echo "${LOG_PREFIX} Re-run with --execute to apply. Use --aggressive for maximum DB shrink (brand-new env)."
fi
