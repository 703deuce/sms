# Coolify — deploy `new-app` as the Transovo web container

The legacy SMS monolith at the **repository root** must **not** build for the primary Transovo site anymore. Production web should build only **`new-app/`** (UI blueprint), in its **own** Coolify application or by changing the existing web app’s base directory.

## Goal

| Before | After |
|--------|--------|
| Nixpacks at repo root → legacy monolith (`nixpacks.legacy-monolith.toml`) | Nixpacks at **repo root** → `cd new-app` + shared **`prisma/`** + small Next build |
| `GET /api/health` on monolith | `GET /api/health` on **new-app** (`app: transovo-new-app`) |
| Full platform in one container | Standalone Next server **only** (no embedded SMS worker) |

Legacy code stays in the repo for reference; it is not compiled in this image.

## Coolify configuration (primary web app)

In Coolify → **sms:master** (application `ds8s3hjin60qs6g7s0iqkixs`) or a **new** application for cutover:

1. **Repository:** `703deuce/sms` · branch `master`
2. **Base Directory / Root Directory:** `/` (empty — **full repo checkout** so `prisma/` is in the Docker build context)
3. **Build pack:** Nixpacks (uses **root** `nixpacks.toml`) **or** Dockerfile `Dockerfile.transovo-new-app` at repo root
4. **Start command:** `bash -lc 'cd new-app && node scripts/start-production.mjs'` (must run from `new-app/`; matches root nixpacks `[start]`)
5. **Port:** `3000`
6. **Database:** point `DATABASE_URL` at greenfield (`transovo_greenfield`). **Telnyx:** `TELNYX_API_KEY` required for search/purchase. Optional: `DEV_WORKSPACE_ID`, `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`.

### Environment (minimum)

| Variable | Purpose |
|----------|---------|
| `HOSTNAME` | `0.0.0.0` |
| `PORT` | `3000` |
| `SOURCE_COMMIT` | Set by Coolify — exposed in `/api/health` |

Remove or avoid legacy-only vars on this service (`DATABASE_URL` for monolith migrations, `EMBEDDED_JOB_WORKER`, etc.) until you intentionally cut over to `GREENFIELD_DATABASE_URL` as `DATABASE_URL`.

### Domains

Point **transovo.ai** (primary production domain) Traefik routes to **this** application after smoke test. Scheduler, SMS worker, and voice worker remain **separate** Coolify apps (can be stopped when not needed; do not delete).

## Verify after deploy

```bash
curl -sS https://<your-fqdn>/api/health
# {"ok":true,"app":"transovo-new-app","commitSha":"..."}

curl -sS -o /dev/null -w "%{http_code}\n" https://<your-fqdn>/app/home
# 200
```

Build logs should show `[new-app/coolify-build]` and **not** `[coolify-install] npm ci` at repo root.

## Prisma (single source of truth)

`new-app` uses the **repository-root** `prisma/schema.prisma`. `scripts/coolify-build.sh` copies `../prisma` into `new-app/prisma` at build time for `prisma generate` and the standalone bundle. Do **not** commit a second schema under `new-app/prisma/`.

## Local parity (matches Coolify)

```bash
cd new-app
npx --yes pnpm@12.3.4 install --frozen-lockfile
bash scripts/coolify-build.sh
node scripts/start-production.mjs
```

From repo root (same as Coolify install/build phases):

```bash
cd new-app && npx --yes pnpm@12.3.4 install --frozen-lockfile
bash scripts/deploy-db-migrations.sh   # when DATABASE_URL is set (Coolify production)
cd new-app && bash scripts/coolify-build.sh
```

## One-time Coolify fix (after Option 2 merge)

On the host, application `ds8s3hjin60qs6g7s0iqkixs`:

- **Base Directory:** clear `/new-app` → use repository root (`/` or empty)
- **Start command:** `bash -lc 'cd new-app && node scripts/start-production.mjs'`

Or run: `bash scripts/coolify-configure-new-app-root-context.sh` (read-only check + SQL when `COOLIFY_APPLY=1`).

## Local parity (legacy narrow context — not for production)

Base Directory `new-app` alone **fails** once Phone/Prisma is required unless you run from a full monorepo checkout with `../prisma` visible (not true inside Coolify’s `new-app`-only image context).

## Landing page

`new-app` currently redirects `/` → `/app/home`. Marketing/landing from the legacy app can be copied into `new-app` later without bringing back the monolith build.

## Rollback

Set Base Directory to `/` and swap root `nixpacks.toml` for `nixpacks.legacy-monolith.toml` to restore the legacy monolith build — only if you must revert production.
