# Fix: transovo-sms-worker can't build or deploy (Coolify app fd7b2fe8172414e3320776281a)

Coolify builds this app from the **master** branch with `/Dockerfile.sms-worker`, base dir `/`.
Its last successful deploy was Oct 20, 2026. The redeploy on Nov 20, 2026 (deployment bq08zdamwp7gcfl2ldjpnyor) failed.

## 1. Build failure (the blocker)
```
Dockerfile.sms-worker:14  COPY package.json package-lock.json* ./
Dockerfile.sms-worker:15  RUN npm ci
npm error code EUSAGE: `npm ci` can only install with an existing package-lock.json ...
```
Cause: root `.dockerignore` line 38 excludes `package-lock.json` (comment: "Root npm lock (web install is new-app/pnpm-lock.yaml only)"). The lockfile exists in the repo (lockfileVersion 3), but it never reaches the build context, and the glob `package-lock.json*` silently copies nothing.

Fix (pick one, and keep the web app's Nixpacks build unaffected):
- Preferred: add `Dockerfile.sms-worker.dockerignore` next to the Dockerfile. BuildKit uses a per-Dockerfile ignore file. Make it identical to `.dockerignore` except that it does NOT exclude `package-lock.json`. Also, the root `.dockerignore` excludes `Dockerfile.sms-worker` itself and `tests/`, so check that nothing the worker needs is dropped.
- Or remove `package-lock.json` from the root `.dockerignore`, only if the web app (Nixpacks, root `nixpacks.toml`) doesn't depend on that exclusion.
- Don't switch to `npm install` without a lockfile.

## 2. Worker has been failing at runtime for weeks (context, verify)
- The running container logs `{"event":"worker_cycle_error","error":"TypeError: fetch failed"}` every cycle, and Docker has marked it unhealthy since Oct 20.
- `scripts/worker-sms.ts` requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. The configured host `azurgysigroeizdrlxgx.supabase.co` **does not resolve in DNS from the server** (NO_DNS). The Supabase project is likely deleted or paused, so every cycle fails.
- Confirm whether this worker is still needed now that the app runs on the self-hosted Postgres. If so, point it at the current data source. If not, say so and we'll stop the app instead of fixing it.
- The old image's healthcheck used `wget`, which isn't in the image (`/bin/sh: wget: not found`). The current Dockerfile uses `curl -fsS` on `${SMS_WORKER_HEALTH_PORT}/health`. Make sure `curl` is installed in `node:22-bookworm-slim` (it isn't by default) and that `SMS_WORKER_HEALTH_PORT` has a default.

## Already done (no code needed)
- `ELEVENLABS_KEY` is updated in this app's Coolify env (production and preview), and the running container was recreated in place with the new key. The next successful deploy keeps it.

## Acceptance
- A Coolify deploy of master for app fd7b2fe8172414e3320776281a succeeds.
- The container becomes healthy with no `worker_cycle_error` in the logs, or there's a written recommendation to retire the worker.
- The transovo.ai web app's Nixpacks build is unchanged and still deploys.
- Don't touch render/QA.
