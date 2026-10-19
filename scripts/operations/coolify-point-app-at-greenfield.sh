#!/usr/bin/env bash
# Point Coolify web app DATABASE_URL at greenfield; preserve prior URL as LEGACY_DATABASE_URL.
set -euo pipefail

COOLIFY_ENV="${COOLIFY_ENV:-/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env}"
GREENFIELD_URL_FILE="${GREENFIELD_URL_FILE:-/tmp/transovo-greenfield-database.url}"

export COOLIFY_ENV GREENFIELD_URL_FILE

if [[ ! -f "$GREENFIELD_URL_FILE" ]]; then
  echo "[coolify-env] ERROR: missing ${GREENFIELD_URL_FILE}" >&2
  exit 1
fi
if [[ ! -f "$COOLIFY_ENV" ]]; then
  echo "[coolify-env] ERROR: missing ${COOLIFY_ENV}" >&2
  exit 1
fi

python3 <<'PY'
import os
from pathlib import Path

env_path = Path(os.environ["COOLIFY_ENV"])
green_url = Path(os.environ["GREENFIELD_URL_FILE"]).read_text(encoding="utf-8").strip()
lines = env_path.read_text(encoding="utf-8").splitlines()

def parse_val(line: str) -> str:
    val = line.split("=", 1)[1].strip()
    if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
        val = val[1:-1]
    return val

current_db = None
legacy_db = None
has_legacy = False
other: list[str] = []

for line in lines:
    if line.startswith("LEGACY_DATABASE_URL="):
        legacy_db = parse_val(line)
        has_legacy = True
        other.append(line)
        continue
    if line.startswith("DATABASE_URL="):
        current_db = parse_val(line)
        continue
    other.append(line)

if current_db == green_url:
    print("[coolify-env] DATABASE_URL already points at greenfield")
    raise SystemExit(0)

if not has_legacy and current_db:
    other.append(f'LEGACY_DATABASE_URL="{current_db}"')
    print("[coolify-env] Recorded LEGACY_DATABASE_URL")

other.append(f'DATABASE_URL="{green_url}"')
env_path.write_text("\n".join(other) + "\n", encoding="utf-8")
print("[coolify-env] Updated DATABASE_URL to greenfield database")
print("[coolify-env] Redeploy the Coolify web app to load new env")
PY
