#!/usr/bin/env bash
# Create a second Postgres database on the same server as LEGACY DATABASE_URL.
# Does not print connection strings. See docs/NEW-APP-DATABASE-GREENFIELD.md
set -euo pipefail

GREENFIELD_DB_NAME="${GREENFIELD_DB_NAME:-transovo_greenfield}"
COOLIFY_ENV_FILE="${COOLIFY_ENV_FILE:-}"

if [[ -z "${LEGACY_DATABASE_URL:-}" ]]; then
  if [[ -z "$COOLIFY_ENV_FILE" || ! -f "$COOLIFY_ENV_FILE" ]]; then
    echo "[create-db] ERROR: Set LEGACY_DATABASE_URL or COOLIFY_ENV_FILE to Coolify app .env" >&2
    exit 1
  fi
  LEGACY_DATABASE_URL="$(
    python3 - "$COOLIFY_ENV_FILE" <<'PY'
import sys
path = sys.argv[1]
for line in open(path, encoding="utf-8"):
    if line.startswith("DATABASE_URL="):
        val = line.split("=", 1)[1].strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        print(val, end="")
        break
PY
  )"
fi

if [[ -z "${LEGACY_DATABASE_URL:-}" ]]; then
  echo "[create-db] ERROR: LEGACY_DATABASE_URL / DATABASE_URL is empty" >&2
  exit 1
fi

export LEGACY_DATABASE_URL GREENFIELD_DB_NAME GREENFIELD_URL_FILE="${GREENFIELD_URL_FILE:-/tmp/transovo-greenfield-database.url}"

if command -v psql >/dev/null 2>&1; then
  PSQL=(psql)
elif [[ -x /usr/local/bin/psql ]]; then
  PSQL=(/usr/local/bin/psql)
elif command -v docker >/dev/null 2>&1; then
  PSQL=(docker run --rm -i postgres:16-alpine psql)
else
  echo "[create-db] ERROR: need psql or docker" >&2
  exit 1
fi
export PSQL_CMD="${PSQL[*]}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="${SCRIPT_DIR}:${PYTHONPATH:-}"

python3 <<'PY'
import os
import shlex
import subprocess
import sys

from _pg_url_utils import build_postgres_url, parse_postgres_url

def psql_cmd(*args: str) -> list[str]:
    base = shlex.split(os.environ.get("PSQL_CMD", "psql"))
    return base + list(args)

legacy = os.environ["LEGACY_DATABASE_URL"]
db_name = os.environ.get("GREENFIELD_DB_NAME", "transovo_greenfield")
out_file = os.environ.get("GREENFIELD_URL_FILE", "/tmp/transovo-greenfield-database.url")

parts = parse_postgres_url(legacy)
legacy_db = parts["path"].lstrip("/").split("?")[0] or "postgres"
if legacy_db == db_name:
    print(f"[create-db] ERROR: Legacy database name is already {db_name!r}", file=sys.stderr)
    sys.exit(1)

admin_url = build_postgres_url(parts, "postgres")

exists_sql = f"SELECT 1 FROM pg_database WHERE datname = '{db_name.replace(chr(39), chr(39)+chr(39))}'"
try:
    out = subprocess.run(
        psql_cmd(admin_url, "-tAc", exists_sql),
        check=True,
        capture_output=True,
        text=True,
    )
    exists = out.stdout.strip() == "1"
except subprocess.CalledProcessError as e:
    print("[create-db] ERROR: Could not query pg_database:", file=sys.stderr)
    print((e.stderr or e.stdout or str(e))[:2000], file=sys.stderr)
    sys.exit(1)

recreate = os.environ.get("GREENFIELD_RECREATE") == "1"
if recreate and exists:
    drop_sql = f'DROP DATABASE IF EXISTS "{db_name.replace(chr(34), chr(34)+chr(34))}" WITH (FORCE)'
    try:
        subprocess.run(psql_cmd(admin_url, "-v", "ON_ERROR_STOP=1", "-c", drop_sql), check=True, capture_output=True, text=True)
        print(f"[create-db] Dropped database for recreate: {db_name}")
        exists = False
    except subprocess.CalledProcessError as e:
        print("[create-db] ERROR: DROP DATABASE failed:", file=sys.stderr)
        print((e.stderr or e.stdout or str(e))[:2000], file=sys.stderr)
        sys.exit(1)

if not exists:
    create_sql = f'CREATE DATABASE "{db_name.replace(chr(34), chr(34)+chr(34))}"'
    try:
        subprocess.run(
            psql_cmd(admin_url, "-v", "ON_ERROR_STOP=1", "-c", create_sql),
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"[create-db] Created database: {db_name}")
    except subprocess.CalledProcessError as e:
        print("[create-db] ERROR: CREATE DATABASE failed:", file=sys.stderr)
        print((e.stderr or e.stdout or str(e))[:2000], file=sys.stderr)
        sys.exit(1)
else:
    print(f"[create-db] Database already exists: {db_name}")

green_url = build_postgres_url(parts, db_name)
with open(out_file, "w", encoding="utf-8") as f:
    f.write(green_url)
os.chmod(out_file, 0o600)
print(f"[create-db] Wrote greenfield URL to {out_file} (mode 600)")
PY
