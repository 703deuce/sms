# BullMQ Redis migration report — 2026-09-29

Infrastructure-only migration: production BullMQ backend moved from Upstash to self-hosted Redis on Coolify. No application queue/MCTB logic changes.

---

## REDIS SERVICE

- **Coolify service:** Docker Compose stack at `/data/coolify/services/transovo-bullmq-redis` (operator-managed; not the Coolify UI “Services” catalog yet)
- **Container:** `transovo-bullmq-redis`
- **Redis version:** `redis:7.2-alpine`
- **Internal hostname:** `transovo-bullmq-redis` (alias on Docker network `coolify`)
- **Publicly exposed:** NO (no host port bindings)
- **Authentication:** ENABLED (`requirepass` via Coolify-local secret file; not in Git)
- **Persistent volume:** `transovo-bullmq-redis_transovo-bullmq-redis-data` → `/data` in container
- **AOF:** ENABLED (`appendonly yes`, `appendfsync everysec`; `aof_enabled:1` verified)
- **Eviction policy:** `noeviction` with `maxmemory 768mb` (container `mem_limit` 896m)
- **Health:** `healthy` (compose healthcheck: `redis-cli` PING)

**Operator paths (no secrets):**

- Compose: `/data/coolify/services/transovo-bullmq-redis/docker-compose.yml`
- Password file (chmod 600): `/data/coolify/services/transovo-bullmq-redis/.redis-password`
- Upstash rollback backup: `/data/coolify/applications/ds8s3hjin60qs6g7s0iqkixs/.env.redis-upstash-backup`

---

## APPLICATION CONNECTION

- **BullMQ env authority:** `REDIS_URL` (only Redis env var in production app config; no separate `QUEUE_REDIS_URL` / Upstash REST vars for BullMQ)
- **Also uses `REDIS_URL`:** Voice realtime session store (`src/lib/voice/realtime-session/store.ts`) — same backend after migration
- **Queue driver:** `QUEUE_DRIVER=bullmq`
- **BullMQ client:** `ioredis` via `src/lib/jobs/bullmq.ts` (`maxRetriesPerRequest: null`)
- **Previous backend:** Upstash (TCP `rediss://` hostname under `*.upstash.io`)
- **Current backend:** Self-hosted Coolify Redis (`redis://transovo-bullmq-redis:6379` with auth)
- **Producer backend:** Web container → `REDIS_URL` → self-hosted Redis
- **Worker backend:** Embedded `npm run worker:all` in web container → same `REDIS_URL`
- **EMBEDDED_JOB_WORKER:** `1`
- **DISABLE_INPROCESS_WORKER:** `1` (disables Next in-process poller; embedded sibling `worker:all` owns BullMQ — intentional)
- **Survives redeploy:** YES — `REDIS_URL` and `EMBEDDED_JOB_WORKER` updated in Coolify `environment_variables` for application id `1` (`ds8s3hjin60qs6g7s0iqkixs`), plus synced application `.env`

Do not print connection credentials in tickets or chat.

---

## OLD UPSTASH QUEUES

- **Pending jobs found:** Unknown — Upstash returned rate-limit error when querying `mctb` / `automations` / `default` job counts before cutover
- **Delayed jobs found:** Unknown (same rate-limit)
- **Migration/recovery action:** No bulk key copy. Cutover to empty self-hosted Redis; stranded work on Upstash possible but not recoverable while rate-limited. No replay performed (avoids duplicate customer sends).
- **Duplicate-send risk addressed:** YES — no manual replay; idempotent job keys unchanged

---

## BULLMQ PROOF

- **mctb consumer:** ATTACHED (`bullmq_worker_ready` / `bullmq_dispatch_workers_ready` includes `mctb`)
- **automations consumer:** ATTACHED (same dispatch worker bundle)
- **Test queue/job:** `mctb` / `mctb_worker_smoke` via `scripts/mctb-worker-production-smoke.ts`
- **Immediate job:** PASS
- **Delayed job:** PASS (`mctb_worker_smoke` with 6s BullMQ delay → `completed`)
- **Redis restart persistence:** PASS (`SET bullmq:migration:persist` survived `docker restart transovo-bullmq-redis`)
- **Worker reconnect:** PASS (`PING` from web container after Redis restart; no Upstash rate-limit errors in logs)
- **Repeated worker errors:** NO (post-migration)

---

## PRODUCTION

- **Master SHA:** `ad7ca4aa727117f58ec06235029ba25acea9423a` (docs-only commit after notification fixes; app image includes `b48ae371` notification fixes unless a newer web deploy landed)
- **Production SHA:** `ad7ca4aa727117f58ec06235029ba25acea9423a` per production `GET /api/health` <!-- pragma: allowlist secret -->
- **/api/health:** `ok: true`
- **Redis health:** healthy, AOF on, private network
- **BullMQ health:** producers/consumers on self-hosted Redis; `mctb` smoke PASS

---

## READY FOR MANUAL MCTB GOLDEN-PATH TEST

**YES**

---

## Not changed

- Voice/LiveKit scheduler container (`tgjridm6vrmrgljkfrr0rpjn-*`) — untouched
- BullMQ queue names, handlers, MCTB business logic, TeXML, entitlements
- Upstash account/credentials — retained in `.env.redis-upstash-backup` for rollback only (do not delete in this pass)
