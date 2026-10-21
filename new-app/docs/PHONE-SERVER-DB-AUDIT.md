# Phone audit — server DB block (10 checks)

The full audit (`npm run test:phone:audit`) marks **10 items BLOCKED** without production `DATABASE_URL`:

- Cross-feature **S-07–S-15**
- **simulate-receptionist-publish-pipeline** dry-run (P2-SCRIPT-030)

Production **web containers are Next.js standalone** (no `tsx` / `scripts/`). Run these checks from a checkout that has the repo, using `DATABASE_URL` from the live web container.

## One command (Cloud Agent or laptop with Coolify SSH)

```bash
cd new-app && npm run test:phone:audit:server-db
```

Requires **`COOLIFY_SSH_KEY`** (Cursor secret) or **`COOLIFY_SSH_KEY_PATH`**, or set **`DATABASE_URL`** directly.

The runner SSHs to the Coolify host, runs `docker exec … printenv DATABASE_URL` on the web app container (`ds8s3hjin60qs6g7s0iqkixs`), then executes:

`scripts/phone-functional-audit/run-server-db-blocked-audit.ts`

Report default: `/opt/cursor/artifacts/phone-server-db-blocked-audit.json` (override with `PHONE_SERVER_DB_AUDIT_REPORT`).

## Optional env

| Variable | Purpose |
|----------|---------|
| `PHONE_AUDIT_WORKSPACE_ID` | Workspace for publish-pipeline dry-run |
| `PHONE_AUDIT_LOOKBACK_DAYS` | Evidence window for S-07–S-12 (default 90) |
| `MCTB_PROD_WEB_CONTAINER_FILTER` | Docker name filter for web container |

## Manual (on Coolify host)

```bash
cid=$(docker ps --filter name=ds8s3hjin60qs6g7s0iqkixs --format '{{.ID}}' | head -1)
export DATABASE_URL="$(docker exec "$cid" printenv DATABASE_URL)"
# On a machine with this git checkout:
cd new-app
NODE_OPTIONS='--import ../scripts/preload-server-only.mjs' npx tsx scripts/phone-functional-audit/run-server-db-blocked-audit.ts
```
