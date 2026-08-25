#!/usr/bin/env bash
# Cloud Agent `start` phase — per-boot daemon reconciliation.
#
# Brings up the local Supabase-compatible stack (Postgres, PostgREST, nginx)
# using state prepared by install.sh. Idempotent: safe to run repeatedly and
# after a snapshot restore. Returns once every service is healthy.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

mkdir -p "$TRANSOVO_HOME/sock" "$TRANSOVO_HOME/nginx"/{body,proxy,fastcgi,uwsgi,scgi}

echo "==> Postgres"
if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "    PGDATA missing — run scripts/cloud/install.sh first" >&2
  exit 1
fi
if pg_running; then
  echo "    already running"
else
  pg pg_ctl -D "$PGDATA" -l "$TRANSOVO_HOME/pg.log" start
fi
wait_for_pg

echo "==> PostgREST"
cat > "$TRANSOVO_HOME/postgrest.conf" <<CONF
db-uri = "postgres://authenticator:postgres@127.0.0.1:$PGPORT/postgres"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 10
server-host = "127.0.0.1"
server-port = $PGREST_PORT
jwt-secret = "$JWT_SECRET"
CONF
if pgrep -f "postgrest .*postgrest.conf" >/dev/null 2>&1; then
  echo "    already running — reloading schema cache"
  psql_super -c "NOTIFY pgrst, 'reload schema';" >/dev/null
else
  setsid postgrest "$TRANSOVO_HOME/postgrest.conf" >"$TRANSOVO_HOME/postgrest.log" 2>&1 &
fi

echo "==> nginx (Supabase gateway on :$SUPABASE_PORT)"
cat > "$TRANSOVO_HOME/nginx.conf" <<CONF
worker_processes 1;
pid $TRANSOVO_HOME/nginx/nginx.pid;
error_log $TRANSOVO_HOME/nginx/error.log;
events { worker_connections 256; }
http {
  access_log $TRANSOVO_HOME/nginx/access.log;
  client_body_temp_path $TRANSOVO_HOME/nginx/body;
  proxy_temp_path $TRANSOVO_HOME/nginx/proxy;
  fastcgi_temp_path $TRANSOVO_HOME/nginx/fastcgi;
  uwsgi_temp_path $TRANSOVO_HOME/nginx/uwsgi;
  scgi_temp_path $TRANSOVO_HOME/nginx/scgi;
  server {
    listen 127.0.0.1:$SUPABASE_PORT;
    location /rest/v1/ {
      proxy_pass http://127.0.0.1:$PGREST_PORT/;
      proxy_set_header Accept-Profile \$http_accept_profile;
      proxy_set_header Content-Profile \$http_content_profile;
    }
    location = /rest/v1 { proxy_pass http://127.0.0.1:$PGREST_PORT/; }
    location / { proxy_pass http://127.0.0.1:$PGREST_PORT; }
  }
}
CONF
if [ -f "$TRANSOVO_HOME/nginx/nginx.pid" ] && kill -0 "$(cat "$TRANSOVO_HOME/nginx/nginx.pid")" 2>/dev/null; then
  nginx -c "$TRANSOVO_HOME/nginx.conf" -p "$TRANSOVO_HOME/" -s reload
else
  nginx -c "$TRANSOVO_HOME/nginx.conf" -p "$TRANSOVO_HOME/"
fi

echo "==> Waiting for the Supabase REST endpoint"
tries=30
until curl -fsS -o /dev/null -H "apikey: $ANON_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  "http://127.0.0.1:$SUPABASE_PORT/rest/v1/User?limit=1" 2>/dev/null; do
  tries=$((tries - 1))
  if [ "$tries" -le 0 ]; then echo "REST endpoint not healthy" >&2; exit 1; fi
  sleep 1
done

echo "==> Local Supabase stack is up:"
echo "    Postgres   127.0.0.1:$PGPORT"
echo "    PostgREST  127.0.0.1:$PGREST_PORT"
echo "    Supabase   http://127.0.0.1:$SUPABASE_PORT (REST at /rest/v1)"
echo "    Start the web app with: npm run dev"
