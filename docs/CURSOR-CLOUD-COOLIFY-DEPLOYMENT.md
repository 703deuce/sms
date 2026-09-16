# Cursor Cloud Agent — Coolify production deployment workflow

**Read this before any production code change.** Pushing to GitHub `master` starts deployment; it does **not** complete the task.

## SSH access (Cloud Agent VM)

- Runtime secret: `COOLIFY_SSH_KEY` (private key; never print, cat, or log).
- Host alias: `coolify-server` → `root@128.140.102.51`
- Setup: write key to `~/.ssh/cursor_coolify` (mode `600`), config in `~/.ssh/config` (mode `600`).
- If OpenSSH reports `error in libcrypto`, the secret may be a **single-line** PEM; reflow into standard PEM line breaks before testing again (do not expose key material in logs).

## Production map (discovered — refresh on first task if stale)

| Item | Value |
|------|--------|
| GitHub repository | `703deuce/sms` |
| Deploy branch | `master` |
| **Primary web app** (Coolify name) | `sms:master-ds8s3hjin60qs6g7s0iqkixs` |
| Primary application ID / UUID | `1` / `ds8s3hjin60qs6g7s0iqkixs` |
| Primary production URL | `https://` + `transovo.ai` (public site) | <!-- pragma: allowlist secret -->
| Primary production container (example) | `ds8s3hjin60qs6g7s0iqkixs-<deployment_suffix>` |
| Primary image tag pattern | `ds8s3hjin60qs6g7s0iqkixs:<full_commit_sha>` |
| Health / version check | `GET /api/health` on primary domain → `commitSha`, `ok` |
| **Scheduler app** (same repo, separate service) | `trransovo-smscheduler` |
| Scheduler ID / UUID | `2` / `tgjridm6vrmrgljkfrr0rpjn` |
| Scheduler URL | `http://tgjridm6vrmrgljkfrr0rpjn.128.140.102.51.sslip.io` |

Both apps build from **`703deuce/sms` @ `master`**. A single push typically triggers **two** Coolify deployments (web + scheduler). Verify **both** when the change affects shared build/runtime or background jobs.

Coolify project: `my-first-project` · Platform: Coolify `4.3.19` on host `sms` (`128.140.102.51`).

### Correlating commit → deployment → container

1. Local: `git rev-parse HEAD` after push.
2. On server (no log blobs):  
   `docker exec coolify-db psql -U coolify -d coolify -c "SELECT id, application_id, deployment_uuid, commit, status, created_at, finished_at FROM application_deployment_queues ORDER BY id DESC LIMIT 10;"`
3. Running containers:  
   `ssh coolify-server 'docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}"'`
4. Container env: `SOURCE_COMMIT`, `COOLIFY_BRANCH`, `COOLIFY_RESOURCE_UUID` via `docker inspect` (do not dump full env if secrets present).
5. Production JSON: `curl -sS "$PRODUCTION_BASE_URL/api/health"` → `commitSha` must match pushed SHA (`PRODUCTION_BASE_URL` from Coolify FQDN / labels).

Deployment UUID appears in compose paths, e.g. `/artifacts/<deployment_uuid>/` and matches `application_deployment_queues.deployment_uuid`.

### Where build/deploy logs live

- **Authoritative:** `application_deployment_queues.logs` in Postgres (`coolify-db`). Select `length(logs)` or tail via Coolify UI; avoid dumping multi‑MB rows into chat — extract the **first root error**.
- **Runtime:** `docker logs --tail 500 <production_container>`
- **Platform:** `docker logs --tail 200 coolify` (orchestration only)
- **Compose artifacts:** `/data/coolify/applications/<resource_uuid>/` (`.env`, `docker-compose.yaml` — do not print secrets)

## Deployment model

```
GitHub master push
  → Coolify webhook / queue
  → Nixpacks/Docker build (per application)
  → New image tagged with commit SHA
  → New container started; Traefik routes traffic
  → Verify /api/health and smoke tests
```

A successful `git push` is **step 1**, not done.

## First task in a session: discover production state

Before changing code, SSH read-only:

```bash
ssh coolify-server 'df -h /; docker system df'
ssh coolify-server 'docker ps -a --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.CreatedAt}}"'
```

Inspect labels on app containers (`coolify.resourceName`, `coolify.applicationId`, Traefik `Host(...)` rules). Confirm no unexpected exited/restart-loop containers. Update the production map table in this doc if IDs/names changed.

**Do not modify production during discovery.**

## Normal development workflow

1. Inspect existing implementation.
2. Make required changes.
3. Run appropriate local/static/unit/type/build tests.
4. Fix local failures.
5. Commit.
6. Push to `master`.
7. **Monitor Coolify until production is verified** (below).

## After every push to `master`

1. `git rev-parse HEAD` — record SHA.
2. Watch `application_deployment_queues` for new rows for `application_id` `1` and `2` with that `commit`.
3. Wait for `status = finished` (not `failed`, not stuck `in_progress`).
4. Confirm **new** container names/images include the SHA (do not trust an older running container).
5. `curl -sS "$PRODUCTION_BASE_URL/api/health"` — `commitSha` matches.
6. `docker logs --tail 500` on new web (and scheduler if relevant) — no fatal startup errors.
7. Smoke-test the changed feature when practical (browser or API).

## If the Coolify build fails

Do not stop at “build failed.”

1. Read deployment logs (DB or Coolify UI) for the **first** root error (deps, TypeScript, Nixpacks, migrations, disk, permissions, missing module, etc.).
2. Fix in repo when safe.
3. Re-test locally.
4. Commit and push fix to `master`.
5. Monitor the **new** deployment.

Avoid speculative fix loops without reading logs.

## If build succeeds but production fails

Check the **new** container: restarts, exit, migration/DB errors, missing env, uncaught exceptions. Fix, redeploy, re-verify.

## Deployment completion criteria

Task is complete only when:

- [ ] Code change done and local checks passed  
- [ ] Commit pushed to `master`  
- [ ] Coolify built the correct commit (web + scheduler if applicable)  
- [ ] Deployment `finished`  
- [ ] New production container(s) healthy/running  
- [ ] `/api/health` (and smoke tests) pass  
- [ ] No new fatal errors in runtime logs  

## End-of-deployment report

Include: commit SHA, summary of change, push OK, Coolify status per app, build result, production container name/ID, verification performed, warnings.

On failure: failed SHA, deployment UUID, root cause with log excerpt, fix commit, replacement deployment result.

## Server safety (production)

**Do not:**

- `docker volume prune`  
- Delete DB volumes or `/data/coolify`  
- Restart Docker or the whole host unless explicitly required  
- Destroy/recreate production databases  
- Expose `COOLIFY_SSH_KEY` or app secrets  
- Unrelated infrastructure changes  

**Disk:** BuildKit cache is capped (~15 GB target). Before large repeated builds: `df -h /` and `docker system df`. Investigate growth before pushing again.

## Quick reference commands

```bash
# Deployments (no logs column)
ssh coolify-server "docker exec coolify-db psql -U coolify -d coolify -c \"SELECT id, application_id, commit, status, created_at, finished_at FROM application_deployment_queues ORDER BY id DESC LIMIT 5;\""

# Production version
curl -sS "$PRODUCTION_BASE_URL/api/health"

# Web container logs
ssh coolify-server 'docker logs --tail 200 ds8s3hjin60qs6g7s0iqkixs-$(docker ps --format "{{.Names}}" | grep ds8s3hjin60qs6g7s0iqkixs | head -1 | cut -d- -f2-)'
```

(Prefer explicit container name from `docker ps` when scripting.)
