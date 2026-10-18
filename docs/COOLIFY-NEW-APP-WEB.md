# Coolify — deploy `new-app` as the Transovo web container

The legacy SMS monolith at the **repository root** must **not** build for the primary Transovo site anymore. Production web should build only **`new-app/`** (UI blueprint), in its **own** Coolify application or by changing the existing web app’s base directory.

## Goal

| Before | After |
|--------|--------|
| Nixpacks at repo root → `npm ci` + Prisma + 15m `next build` | Nixpacks/Docker **only in `new-app/`** → `pnpm install` + small Next build |
| `GET /api/health` on monolith | `GET /api/health` on **new-app** (`app: transovo-new-app`) |
| Full platform in one container | Standalone Next server **only** (no embedded SMS worker) |

Legacy code stays in the repo for reference; it is not compiled in this image.

## Coolify configuration (primary web app)

In Coolify → **sms:master** (application `ds8s3hjin60qs6g7s0iqkixs`) or a **new** application for cutover:

1. **Repository:** `703deuce/sms` · branch `master`
2. **Base Directory / Root Directory:** `new-app` (required)
3. **Build pack:** Nixpacks (uses `new-app/nixpacks.toml`) **or** Dockerfile with path `Dockerfile` (relative to base directory)
4. **Start command:** `node scripts/start-production.mjs` (default from nixpacks `[start]`)
5. **Port:** `3000`
6. **Do not** run `scripts/deploy-db-migrations.sh` on this app until auth/data layer is wired (no Prisma in new-app yet)

### Environment (minimum)

| Variable | Purpose |
|----------|---------|
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | `3000` |
| `SOURCE_COMMIT` | Set by Coolify — exposed in `/api/health` |

Remove or avoid legacy-only vars on this service (`DATABASE_URL` for monolith migrations, `EMBEDDED_JOB_WORKER`, etc.) unless you intentionally add them later.

### Domains

Point **transovo.com** / **transovo.ai** Traefik routes to **this** application after smoke test. Scheduler, SMS worker, and voice worker remain **separate** Coolify apps (unchanged).

## Verify after deploy

```bash
curl -sS https://<your-fqdn>/api/health
# {"ok":true,"app":"transovo-new-app","commitSha":"..."}

curl -sS -o /dev/null -w "%{http_code}\n" https://<your-fqdn>/app/home
# 200
```

Build logs should show `[new-app/coolify-build]` and **not** `[coolify-install] npm ci` at repo root.

## Local parity

```bash
cd new-app
pnpm install
bash scripts/coolify-build.sh
node scripts/start-production.mjs
```

## Landing page

`new-app` currently redirects `/` → `/app/home`. Marketing/landing from the legacy app can be copied into `new-app` later without bringing back the monolith build.

## Rollback

Set Base Directory back to `/` (empty) to restore the legacy Nixpacks build — only if you must revert production.
