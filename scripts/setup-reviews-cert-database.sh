#!/usr/bin/env bash
# Isolated local Postgres for Reviews backend runtime certification (Cloud Agent VM).
set -euo pipefail
DB_NAME="${REVIEWS_CERT_DB_NAME:-transovo_reviews_cert}"
DB_USER="${REVIEWS_CERT_DB_USER:-reviews_cert}"
DB_PASS="${REVIEWS_CERT_DB_PASS:-reviews_cert_local_only}"
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
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
SQL

cd "$(dirname "$0")/.."
npx prisma db push --accept-data-loss --skip-generate
for f in prisma/migrations/20261014180000_reputation_platform prisma/migrations/20261014180100_platform_product_consumer prisma/migrations/20261014180200_reputation_extended_tables prisma/migrations/20261014180300_conversation_product_review_requests prisma/migrations/20261014180400_reputation_schema_alignment prisma/migrations/20261014180500_review_qr_campaign_columns; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$f/migration.sql" >/dev/null 2>&1 || true
done
echo "REVIEWS_CERT_DATABASE_URL=${DATABASE_URL}"
