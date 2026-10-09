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

Both apps build from **`703deuce/sms` @ `master`**. A push to `master` **auto-deploys the primary web app only** (this is what Coolify bills / triggers on git webhook). **Nothing else auto-redeploys** from that push.

| Service | Auto-deploy on `master` push? | Operator action |
|---------|--------------------------------|-----------------|
| **Web** (`ds8s3hjin60qs6g7s0iqkixs`) | **Yes** | Verify `/api/health` `commitSha` after build |
| **SMS / BullMQ worker** (`transovo-sms-worker`, `worker:sms`) | **Yes (GitHub `master`)** via `.github/workflows/deploy-sms-worker.yml` when `COOLIFY_SSH_KEY` is set; otherwise **manual** Coolify redeploy (app id **3**) | Verify worker `commitSha` on `/health` (port **8082**) matches web `/api/health` — see `scripts/verify-mctb-production-topology.ts` and optional web env `MCTB_SMS_WORKER_HEALTH_URL` |
| **Voice / LiveKit worker** (`transovo-voice`, scheduler slot) | **No** | **Manual redeploy** when voice-runtime or voice worker scripts change |
| **Redis** (managed or Coolify service) | **No** | Config / capacity only — not tied to git push |
| **Scheduler** (`trransovo-smscheduler`, id `2`) | **No** (auto-deploy off) | **Manual redeploy** when `worker:sms` / shared deps change |

Do **not** assume a merged `master` commit updated workers or Redis. Say **redeploy** the relevant Coolify application(s), not “queue a deploy” for workers. Repo code on `master` is shared; **runtime** on SMS/voice workers catches up only after you redeploy those apps.

Scheduler builds set **`COOLIFY_SKIP_NEXT_BUILD=1`** (build-time) so Nixpacks runs `prisma generate` only, not `next build`. Configure via `scripts/coolify-configure-scheduler-build.sh` on the Coolify host.

See also: `docs/COOLIFY-TRANSOVO-VOICE-WORKER.md` (apps 1–3 split).

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

**Disk:** Before stacking multiple `master` builds, run `df -h /` and `docker system df`. Failed builds still consume containerd snapshot space until garbage-collected.

### Safe disk cleanup (read-only discovery first)

On `coolify-server`, **do not** remove running containers or DB volumes.

```bash
# Unused app image tag (0 containers) — example only; verify with docker ps / docker images first
docker rmi ds8s3hjin60qs6g7s0iqkixs:<old-sha-tag>

docker image prune -a -f          # unused images only
docker volume prune -f            # dangling volumes only (not coolify-db / app data)
docker builder prune -af
docker buildx prune -af
```

Typical reclaim: one old ~5GB web image + ~3–4GB dangling volumes. `docker system df` may still show ~50GB+ “build cache” in containerd overlay snapshots; `builder prune` often reports `0B` until Docker/containerd GC runs. **66GB+ free on `/` is usually enough for one web build**; avoid five back-to-back deploys.

### Deploy fails in under ~60s: `cURL error 28` to `https://api.github.com/zen`

Coolify’s deployment job checks GitHub reachability before clone. **Transient egress/DNS blips** to `api.github.com` fail the whole deploy (log never reaches Nixpacks/`next build`). This is **not** an application compile error.

**Symptoms:** `application_deployment_queues.status = failed`, log length ≈ few KB, message contains `api.github.com/zen` and `Operation timed out after 30001 milliseconds`.

**Verify (on `coolify-server`):**

```bash
curl -sS -m 15 -o /dev/null -w '%{http_code}\n' https://api.github.com/zen
docker run --rm coollabsio/coolify-helper:1.0.17 curl -sS -m 15 -o /dev/null -w '%{http_code}\n' https://api.github.com/zen
```

Both should return `200`. If yes, **re-queue one deploy** with the **full 40-character** commit SHA (never a guessed/partial SHA):

```bash
COMMIT=$(git rev-parse HEAD) bash scripts/coolify-queue-web-deploy.sh --wait
```

**One push → one deploy.** `master` push already queues the web app via Coolify webhook. **Do not** run `coolify-queue-web-deploy.sh` after a normal `git push` unless webhook deploy failed or you are redeploying without a new commit. Stacking webhook + manual queue (or multiple manual queues) runs parallel `--no-cache` builds and can take hours on a 8GB host. Wait for `finished` or `failed` before any new queue.

**2026-10-03:** Deployments `3317`–`3320` failed on zen timeout; `3321` succeeded after re-queue (~12 min build). Production `commitSha` matched `adb5b3db…`.

### Coolify UI 500: “The payload is invalid”

This is usually **Laravel `DecryptException` on corrupted `environment_variables` rows**, not application code. Deployments fail the same way when Coolify reads env for Nixpacks.

Find broken rows (keys only, inside `coolify` container):

```bash
docker exec coolify php -r '...' # scan EnvironmentVariable::find($id)->value; list failing ids
```

On 2026-09-30 production, application `1` had corrupt ciphertext for `REDIS_URL` (id 65) and `EMBEDDED_JOB_WORKER` (id 485). Fix: copy plaintext from the **running** web container env, then `DB::update` with `encrypt($plain)` (Coolify uses `encrypt()`, not raw `Crypt::encryptString`). Re-scan until all rows decrypt. Coolify deployment UI and new builds work again.

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
