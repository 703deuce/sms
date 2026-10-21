#!/usr/bin/env bash
# Local isolated Postgres for Phone automated verification (agent VM or laptop).
set -euo pipefail
DB_NAME="${PHONE_CERT_DB_NAME:-transovo_phone_cert}"
DB_USER="${PHONE_CERT_DB_USER:-phone_cert}"
DB_PASS="${PHONE_CERT_DB_PASS:-phone_cert_local_only}"
export PHONE_CERT_DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

if ! command -v psql >/dev/null 2>&1; then
  echo "BLOCKED: install PostgreSQL client/server (postgresql package)." >&2
  exit 2
fi

if id postgres &>/dev/null; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres createdb "${DB_NAME}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
SQL
else
  echo "BLOCKED: postgres OS user missing — run as root or install postgresql." >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
export DATABASE_URL="${PHONE_CERT_DATABASE_URL}"
npx prisma db push --accept-data-loss --skip-generate
echo "PHONE_CERT_DATABASE_URL=${PHONE_CERT_DATABASE_URL}"
