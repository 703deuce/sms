# MCTB scale + resilience + durability — copy-paste report

**Date:** 2026-09-29

---

## CURRENT ARCHITECTURE

- **Web:** 1 Coolify app container (`ds8s3hjin60qs6g7s0iqkixs`), Next.js, `EMBEDDED_JOB_WORKER=1`, `DISABLE_INPROCESS_WORKER=1`, `QUEUE_DRIVER=bullmq`.
- **Postgres (customer truth):** Supabase session pooler (`aws-0-us-east-2.pooler.supabase.com`) — not on Coolify host.
- **Redis (BullMQ):** `transovo-bullmq-redis` on Coolify Docker network, 768mb maxmemory, noeviction, AOF+RDB, persistent volume.
- **Jobs:** Postgres `jobQueue` (durable outbox) → BullMQ → embedded `worker:all` → handlers.
- **Inbound SMS:** Webhook → `acceptMctbInboundSmsIngress` (DB transaction) → BullMQ `mctb` → worker.
- **Queues:** `mctb`, `automations`, `sms-send`, `email-send`, `review-campaign`, `voice-calls`.

**Findings:** Stray container `compassionate_lalande` on **old** image — stop if not intentional.

---

## SINGLE POINTS OF FAILURE

1. Single web + embedded worker (scale web without disabling embedded worker = duplicate consumers).
2. Single Redis instance (acceptable; AOF + outbox recovery).
3. Supabase availability (all customer config/history).
4. Host disk ~70% full.
5. No proven off-host Postgres backup from our automation (Supabase console is authority).

---

## MEASURED CAPACITY

**Not fabricated.** Remote agent benchmarks against production Redis + Supabase were **not** used as capacity proof (wrong environment).

**Harness added (run on Coolify host or staging):**

- `scripts/mctb-scale/bench-outbox-enqueue.ts`
- `scripts/mctb-scale/bench-inbound-sms-burst.ts`
- `scripts/mctb-scale/bench-redis-memory-probe.ts`
- `bash scripts/mctb-scale/run-scale-smoke-suite.sh`

**Prior measured (Redis hardening):** restart survival, delayed jobs, idempotent double-wake — PASS (`docs/TRANSOVO-BULLMQ-REDIS-HARDENING-ACCEPTANCE.md`).

**Not run this pass:** concurrent dashboard 50–5000 users, 1000 call webhooks/sec, full Postgres restore drill.

---

## BOTTLENECKS FOUND

- Embedded worker co-located with web (scaling trigger documented).
- Supabase pooler connection contention under burst (needs measurement).
- Redis memory ceiling 768mb with noeviction (correct failure mode: visible enqueue errors + Postgres outbox).
- Disk headroom on Coolify host.
- Backup gaps (below).

---

## FIXES MADE

- Scale benchmark scripts + runbook (`scripts/mctb-scale/`).
- This documentation pass only — **no architecture redesign**.

---

## DATA DURABILITY

| Layer | Role | Backup |
|-------|------|--------|
| **Postgres (Supabase)** | Permanent customer truth | **Operator must verify** Supabase backups + PITR |
| **Object/audio storage** | Voicemail, consent audio | Verify bucket backup separately |
| **Redis** | Queue transport | On-host tarball `/data/backups/transovo-redis/`; **off-host GAP** |
| **Containers** | Disposable | Redeploy from image |

Redis must **not** be the only copy of customer configuration — **true today** (config in Postgres).

---

## BACKUP STATUS

| System | Status |
|--------|--------|
| **Postgres** | Managed by Supabase — **not verified in this pass** → **BLOCKER for large rollout until confirmed** |
| **Redis** | Local snapshot exists; off-host **required** |
| **Object storage** | **Operator verify** |

---

## RESTORE DRILL

**Not executed** (would use Supabase backup → staging DB, never overwrite production).

---

## FAILURE-INJECTION RESULTS

| Test | Result |
|------|--------|
| Redis restart | PASS (prior hardening) |
| Outbox when enqueue fails | Designed + tested in functional matrix |
| Redis total FLUSH | **Staging only** — not run on production |
| Worker/web/DB outage | **Staging only** — not run |

---

## CURRENT SAFE CAPACITY ENVELOPE

- **Thousands of mostly-idle workspaces:** architecturally reasonable in Postgres.
- **Concurrent dashboard users:** **not measured** — plan horizontal web + worker split when metrics demand.
- **Burst SMS/calls:** **not measured** at edge — transactional per event.
- **Redis queue size:** run `bench-redis-memory-probe.ts` on host for bytes/job projection.

---

## SCALE PATH

A → single web + embedded worker (now)  
B → dedicated worker container, web `EMBEDDED_JOB_WORKER=0`  
C → multiple workers  
D → multiple web replicas (workers off on web)  
E → bigger Redis / Supabase tier if metrics prove need  

**Do not equate 10,000 customers with 10,000 concurrent users.**

---

## ALERTING / MONITORING

- `/api/health`, Redis Docker health, `bullmq_dispatch_workers_ready` logs, queue depth snippet (runbook), disk %, `bullmq_enqueue_failed` rate.
- Full observability platform **not** required for pilot; operator alerts **recommended**.

---

## REMAINING OPERATOR ACTIONS

1. Confirm Supabase backup + enable PITR if needed; document restore.
2. Provide off-host backup destination (S3/SFTP/restic) for Redis tarballs.
3. Remove orphan `compassionate_lalande` container if unused.
4. Run scale harness on host/staging; save JSON results.
5. Single deploy of latest `master` when ready.

---

## VERDICTS

| | |
|--|--|
| **PRODUCTION-DATA-DURABILITY READY** | **NO** (Supabase backup/PITR unverified; off-host Redis gap) |
| **PRODUCTION-SCALE READY** | **Partial** — scalable design, **envelope not fully measured** |
| **READY FOR MCTB GOLDEN PATH (functional)** | **YES** (61/61 matrix) |
| **READY FOR LARGE PAYING ROLLOUT** | **After backup verification + host benchmarks** |

---

## FUNCTIONAL BASELINE (unchanged)

`npm run test:mctb-consolidated-nonhuman-matrix` → **61/61 PASS**

Full detail: `docs/MCTB-PRODUCTION-SCALE-RESILIENCE-DURABILITY-REPORT.md`
