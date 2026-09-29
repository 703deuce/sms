# MCTB production scale + resilience + data durability pass

**Date:** 2026-09-29  
**Scope:** Measure existing architecture first — no Kubernetes/Kafka/microservice redesign. Voice V3 and frozen TeXML unchanged. No real high-volume Telnyx/SMS/Brevo traffic.

**Functional baseline:** `npm run test:mctb-consolidated-nonhuman-matrix` — **61/61 PASS** (separate layer).

**Benchmark harness (safe, stubbed):** `scripts/mctb-scale/` + `bash scripts/mctb-scale/run-scale-smoke-suite.sh`

---

## CURRENT ARCHITECTURE

### Request paths

| Path | Flow |
|------|------|
| **Dashboard** | Browser → Next.js web container (`ds8s3hjin60qs6g7s0iqkixs`) → API routes → Supabase Postgres (session pooler) |
| **Telnyx voice / status** | Telnyx → MCTB API webhooks → Postgres state → optional durable `jobQueue` → BullMQ → embedded worker |
| **Inbound SMS** | Telnyx → webhook → `acceptMctbInboundSmsIngress` (transaction: message + `jobQueue`) → BullMQ `mctb` queue → `processMctbInboundSmsJob` → conversation / notifications |
| **Outbound recovery** | Missed-call pipeline → Postgres `jobQueue` + idempotency → BullMQ → worker → eligibility → provider boundary (stub in tests) → persisted outcome |

### Production topology (Coolify host, 2026-09-29 inspection)

| Component | Count / detail |
|-----------|----------------|
| **Web (MCTB app)** | **1** intended production container: `ds8s3hjin60qs6g7s0iqkixs-125104185699` @ image SHA `ad7ca4aa` |
| **Stray web container** | `compassionate_lalande` @ **older** image `638e0ae` — **operator action: stop/remove** if not intentional (duplicate app risk) |
| **Scheduler sibling** | `tgjridm6vrmrgljkfrr0rpjn-*` (separate Coolify app; may lag web SHA) |
| **BullMQ Redis** | `transovo-bullmq-redis` — Redis 7.2, `maxmemory` 768mb, `noeviction`, AOF+RDB, volume `transovo-bullmq-redis-data`, Docker network `coolify` only |
| **Coolify metadata Postgres** | `coolify-db` (Postgres 15) — **not** application data |
| **Application Postgres** | **Supabase** — `DATABASE_URL` host `aws-0-us-east-2.pooler.supabase.com:5432` (session pooler) |
| **Coolify Redis** | `coolify-redis` — platform only, not MCTB BullMQ |

### Worker model (locked for this pass)

| Env | Production value | Meaning |
|-----|------------------|---------|
| `QUEUE_DRIVER` | `bullmq` | BullMQ is authoritative consumer path |
| `EMBEDDED_JOB_WORKER` | `1` | `worker:all` runs **inside** web container |
| `DISABLE_INPROCESS_WORKER` | `1` | No legacy in-process poller fallback |

**Queues (BullMQ):** `mctb`, `automations`, `sms-send`, `email-send`, `review-campaign`, `voice-calls` (see runbook).

**Durable outbox:** Postgres `jobQueue` written **before** or **with** business commits; `syncDbOutboxToBullmq` / `wakeDurableJobQueueRowToBullmq` recover enqueue failures (`src/lib/jobs/bullmq.ts`).

**Idempotency:** `idempotencyKey` on `jobQueue`; inbound SMS keyed by provider message id; consent duplicate detection; recovery usage idempotency tests in functional matrix.

### Host resources (snapshot)

| Resource | Value |
|----------|--------|
| CPU | 4 vCPU |
| RAM | 7.6 GiB total, ~5.3 GiB available |
| Disk `/` | **70%** used (150G total, ~44G free) — monitor Docker + AOF growth |
| Redis container limit | 896m |

---

## SINGLE POINTS OF FAILURE

| SPOF | Impact | Mitigation today | Gap |
|------|--------|------------------|-----|
| **Single web + embedded worker** | All HTTP + all queue consumers | `unless-stopped` restart | Scaling web replicas **multiplies workers** unless `EMBEDDED_JOB_WORKER=0` on extra replicas |
| **Single BullMQ Redis** | Queue transport pause | AOF volume + restart policy | No Sentinel/cluster (accepted); **off-host Redis backup** partial |
| **Supabase Postgres** | Total customer truth loss if unrecoverable | Managed service backups (plan-dependent) | **Operator must verify** backup/PITR in Supabase dashboard — not proven from repo |
| **Coolify host disk** | Redis AOF + Docker + local backups | 70% warning | No automated off-host Postgres copy from this host |
| **Stray old web container** | Unknown traffic/worker duplication | — | **Remove `compassionate_lalande`** if orphan |
| **Provider APIs** | Send/email/TTS failures | Retries, idempotency, suppression | Rate limits → queue growth (by design) |

---

## DATA DURABILITY (customer truth hierarchy)

**Principle:** Postgres (and object storage for blobs) = permanent truth. Redis = recoverable coordination. Containers = disposable.

| Data class | Source of truth | Backup method | Restore method | RPO (target) | RTO (target) |
|------------|-----------------|---------------|----------------|--------------|--------------|
| Workspace / MCTB setup (`customFieldsConfig`, missed_call_text_configs, onboarding) | **Supabase Postgres** | Supabase automated backups (+ PITR if enabled on plan) | Supabase restore / PITR | **Operator-defined** (see below) | **Operator-defined** |
| Missed calls, messages, conversations | Postgres | Same | Same | Same | Same |
| Consent records (`smartRoutingSmsConsentEvent`, consent log) | Postgres | Same | Same | Same | Same |
| `jobQueue` / job status | Postgres | Same | Same | N/A (replay to Redis) | Outbox sync after Redis return |
| BullMQ queue state (waiting/delayed) | **Redis** | On-host `backup-redis-volume.sh` → `/data/backups/transovo-redis/` | Restore to **new** volume only | Seconds–minutes (AOF) | Minutes |
| Voicemail / consent audio | Object storage (per implementation) | **Verify bucket lifecycle + backup** | Re-link from storage | — | — |
| Redis customer configuration | **Must not exist** | — | — | — | — |

### Postgres backup status

| Check | Result |
|-------|--------|
| Where Postgres runs | **Supabase** (not on Coolify host) |
| Coolify DB backup UI | **Empty** — applies to `coolify-db`, not app data |
| Off-host app DB backup from repo/SSH | **Not configured** on Coolify host |
| Restore drill (non-destructive) | **NOT EXECUTED** — requires Supabase backup export or staging project restore (**operator**) |

**Classification:** **PRODUCTION DATA DURABILITY BLOCKER** until operator confirms Supabase backup schedule, retention, and (recommended) **PITR** on the production project.

**Suggested eventual targets (not claimed achieved):** RPO ≤ 15 minutes, RTO ≤ 60 minutes — typically Supabase PITR + documented restore runbook.

### Redis backup status

| Check | Result |
|-------|--------|
| On-host tarball | `redis-aof-snapshot-20260929T131522Z.tar.gz` under `/data/backups/transovo-redis/` |
| Off-host copy | **GAP** — `OFF_HOST_BACKUP_DESTINATION_REQUIRED` (S3/SFTP/restic) |

### Object / audio storage

Inventory required per bucket/provider in Supabase storage or S3 — **operator verification**. DB backup alone insufficient if rows reference deleted objects.

---

## MEASURED CAPACITY

**Important:** Remote Cloud Agent → Supabase pooler + SSH tunnel to **production** Redis is **not** a valid latency envelope for dashboard HTTP load. Use benchmarks on Coolify host or dedicated staging with isolated Redis.

### Harness results (this pass)

| Workload | Status | Notes |
|----------|--------|-------|
| Outbox + BullMQ enqueue sweep | **Harness added** | `scripts/mctb-scale/bench-outbox-enqueue.ts` — run on host with `MCTB_BENCH_ENQUEUE_COUNTS` |
| Inbound SMS accept burst | **Harness added** | `bench-inbound-sms-burst.ts` — bounded concurrency; no Telnyx |
| Redis memory / job projection | **Harness added** | `bench-redis-memory-probe.ts` — delayed smoke jobs; **do not FLUSH production Redis** |
| Redis restart / delayed / idempotent wake | **PASS** (prior) | `scripts/bullmq-redis-hardening-smoke.ts`, hardening acceptance doc |
| Dashboard concurrent users 50–5000 | **NOT RUN** | Requires `autocannon`/k6 against staging URL + auth — not production |
| Simulated 1000 call-event webhooks/sec | **NOT RUN** | Add stub webhook replay script on staging (future) |

**Do not fabricate p50/p95 numbers in this document.** Record them in `docs/MCTB-SCALE-BENCHMARK-RESULTS.json` after host-side runs.

---

## BOTTLENECKS FOUND (architecture / ops, not code defects)

1. **Embedded worker in web** — horizontal web scaling without `EMBEDDED_JOB_WORKER=0` on N-1 replicas → duplicate consumers (mitigated by idempotency, still wastes work).
2. **Supabase pooler** — all web/worker DB traffic through pooler; burst webhook + analytics can contend on connections (measure `pg_stat_activity` on Supabase).
3. **Redis 768mb noeviction** — at capacity, **enqueue fails visibly** (correct); outbox must drain when Redis recovers.
4. **Disk 70%** on Coolify host — risk for AOF growth, images, local Redis backups.
5. **Off-host backups** — Redis tarball local only; **Postgres depends on Supabase** — must be verified.
6. **Orphan container** — `compassionate_lalande` old image.

---

## FIXES MADE (this pass)

| Change | Type |
|--------|------|
| `scripts/mctb-scale/*` benchmark harness + `run-scale-smoke-suite.sh` | Tooling |
| This report + copy-paste companion | Documentation |
| No production architecture change | By design |

---

## FAILURE-INJECTION RESULTS (existing evidence)

| Scenario | Environment | Result |
|----------|-------------|--------|
| Redis restart | Production-controlled | **PASS** — AOF persistence, workers reconnect (hardening acceptance) |
| Redis enqueue failure | Code path | DB row remains; `syncDbOutboxToBullmq` |
| Duplicate BullMQ wake | `bullmq-redis-hardening-smoke.ts` | **PASS** — single completion |
| Redis **total loss** (FLUSH) | **NOT RUN on production** | Prove on **staging** disposable Redis: outbox republish |
| Worker SIGTERM | Code | `closeBullmqWorkers()` on shutdown |
| Web crash | `unless-stopped` | Restart; state in Postgres + Redis volume |
| Postgres outage | **NOT RUN** | Staging only — expect controlled 5xx, Telnyx retries + idempotency |
| Worker mid-job | **PARTIAL** | Idempotency at job + provider layers; full kill test on staging |

---

## CURRENT SAFE CAPACITY ENVELOPE (honest)

| Dimension | Envelope |
|-----------|----------|
| **Paying customers (configured workspaces)** | Architecture supports **thousands** of mostly-idle tenants in Postgres; not load-tested to 10k in this pass |
| **Concurrent dashboard users** | **Not measured** — single web container + Next.js; expect **low hundreds** concurrent before horizontal web scaling **with worker split** |
| **Simultaneous call-event bursts** | **Not measured** — MCTB is short HTTP; bottleneck likely DB writes + pooler |
| **Inbound SMS webhooks/sec** | **Not measured** at production edge; ingress path is transactional per message |
| **Queued recovery jobs** | Limited by **Redis 768mb** + worker throughput; use memory probe script for projection |
| **Worker jobs/sec** | **1× embedded worker:all** — scale by **dedicated worker containers** before multi-web |

---

## SCALE PATH (triggers, not premature implementation)

| Stage | Configuration | Trigger (examples) |
|-------|---------------|---------------------|
| **A (now)** | 1 web, `EMBEDDED_JOB_WORKER=1` | Default |
| **B** | 1 web (`EMBEDDED_JOB_WORKER=0`) + 1 dedicated `worker:all` container | Sustained queue depth / oldest job age ↑, web CPU high from worker |
| **C** | 1 web + **N workers** (same Redis) | MCTB queue lag after B |
| **D** | **M web replicas** (workers off on web) + N workers | HTTP p95 ↑, CPU bound on web, not queue |
| **E** | Redis memory >70% sustained or DB limits | Vertical Redis / Supabase compute / read replicas (measure first) |

**10,000 customers ≠ 10,000 concurrent users.** Most tenants are idle; plan for **burst** missed calls + SMS + setup saves.

---

## RATE LIMITING / BACKPRESSURE

- **Telnyx webhooks:** Must not be throttled like browser abuse — verify middleware does not apply generic IP rate limits to provider webhook routes.
- **Outbound SMS/email:** Provider 429 → retry/backoff; jobs remain in Postgres.
- **Public forms:** Existing public booking rate-limit patterns — apply MCTB public form if implemented.

**Action:** Audit `middleware` / route matchers for `/api/telnyx/**` — document in follow-up if gaps found.

---

## OBSERVABILITY + ALERTS (minimum)

| Question | Today |
|----------|--------|
| Web healthy? | `/api/health` (`commitSha`, `ok`) |
| Redis healthy? | Docker healthcheck + runbook |
| Workers attached? | Log `bullmq_dispatch_workers_ready` |
| Queue depth? | Runbook `node` snippet on web container |
| Failed jobs? | `bullmq_job_failed` logs + BullMQ `failed` count |

**Recommended alerts (operator):** web down, Redis unhealthy, disk >80%, queue oldest age > X min, spike in `bullmq_enqueue_failed`, Supabase connection errors.

---

## TENANT FAIRNESS

No evidence yet that one workspace can starve others at queue level — **test on staging** with flood from workspace A while B processes. Implement per-workspace rate limits only if measured.

---

## DATA RETENTION / GROWTH (qualitative)

| At 10k workspaces (mostly small) | Dominant growth |
|----------------------------------|-----------------|
| `missedCallEvent`, `conversationMessage` | Postgres size |
| `jobQueue` completed rows | Retention policy needed long-term |
| Voicemail audio | Object storage |
| Analytics | Query cost vs row count |

Use pagination on all operational lists (required by specs).

---

## SECURITY UNDER SCALE

Functional matrix includes **tenant isolation** tests. Re-run under concurrent load on staging when HTTP load harness exists.

---

## REMAINING OPERATOR ACTIONS

1. **Supabase:** Confirm daily backups + enable **PITR** if not on; document restore steps; optional restore drill to **staging** project.
2. **Off-host backup:** Provide S3/SFTP/restic destination for Redis tarballs (and any future Postgres exports if desired).
3. **Stop/remove** container `compassionate_lalande` if orphan.
4. **Deploy** latest `master` (functional + scale harness) when ready — single deploy.
5. **Run benchmarks on Coolify host** (or staging): `bash scripts/mctb-scale/run-scale-smoke-suite.sh` — paste JSON into `docs/MCTB-SCALE-BENCHMARK-RESULTS.json`.
6. **Disk:** Keep root <80%; prune **disposable** Docker build cache only.

---

## FINAL VERDICTS

| Question | Answer |
|----------|--------|
| **PRODUCTION-DATA-DURABILITY READY** | **NO** — Supabase backup/PITR not verified from automation; off-host Redis copy missing |
| **PRODUCTION-SCALE READY** | **Partial** — architecture scales horizontally **without rewrite**; **measured envelope not yet established** on host |
| **READY TO PROCEED WITH MCTB GOLDEN PATH** | **YES** for functional layer (61/61); **YES for pilot customers** at low concurrency; **verify backups before large paying rollout** |

---

## PART 32 — Revalidation after fixes

When production hardening lands:

```bash
npm run test:mctb-consolidated-nonhuman-matrix
bash scripts/run-mctb-commercial-launch-guards.sh
bash scripts/mctb-scale/run-scale-smoke-suite.sh   # staging/host only
```

Do **not** run commercial certification wrapper in this pass.
