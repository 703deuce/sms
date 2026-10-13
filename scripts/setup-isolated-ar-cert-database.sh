#!/usr/bin/env bash
# Local isolated Postgres for advanced scheduling certification (agent VM).
set -euo pipefail
DB_NAME="${AR_CERT_DB_NAME:-transovo_ar_cert}"
DB_USER="${AR_CERT_DB_USER:-ar_cert}"
DB_PASS="${AR_CERT_DB_PASS:-ar_cert_local_only}"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"

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

cd "$(dirname "$0")/.."
npx prisma db push --accept-data-loss --skip-generate
echo "AR_CERT_DATABASE_URL=${DATABASE_URL}"
