# Production test data cleanup report

**Date:** 2026-09-29 UTC  
**Preserve workspace:** `ws_1` (Blue Ridge Realty / harbor-home)

---

## PRE-CLEANUP

| Metric | Value |
|--------|--------|
| **Workspaces** | 11 |
| **job_queue** | ~330,260 |
| **Database size (logical dump)** | **167 MiB** (`transovo-20260929T233940Z.dump`, 174,659,239 bytes) |
| **Backup** | **PRE_TEST_DATA_CLEANUP** — verified `pg_restore -l` OK |
| **Backup verified** | **YES** |

---

## WORKSPACE CLASSIFICATION

| Workspace ID | Name | Classification | Action |
|--------------|------|----------------|--------|
| `ws_1` | Blue Ridge Realty | **PRESERVE — REAL** | Kept |
| `cmubqu0bx4v5o2m6s42083b2t` | Voice V3 OpenAI ingest cert | TEST / DISPOSABLE | Deleted |
| `mctb_usage_test_*` (×4) | MCTB usage idempotency test | TEST / DISPOSABLE | Deleted |
| `mctb_ing_b7fb9bce` | MCTB ingress idempotency test | TEST / DISPOSABLE | Deleted |
| `cmuks7622236q6b6v0j4s5c4o` | Appt MCTB Browser Cert | TEST / DISPOSABLE | Deleted |
| `mctb_press1_*` (×2) | MCTB Press-1 DB test | TEST / DISPOSABLE | Deleted |
| `cmun7x8fi55693k6t101e4607` | BullMQ 73247335 | TEST / DISPOSABLE | Deleted |

**Result:** **1** workspace remains (`ws_1`).

---

## JOB_QUEUE ANALYSIS (before)

| Metric | Count |
|--------|------:|
| **Total** | 330,260 |
| **ws_1** | 5,362 (898 pending/deferred/processing) |
| **Test workspaces** | 17 |
| **workspace_id NULL** | ~324,880 |
| **completed** | ~328,170 |
| **failed** | ~1,084 |
| **pending** | ~966 |

### Why ~330k rows existed

1. **~323,800 completed rows with `workspace_id` NULL** — global scheduler/cron job history (`campaign_send_batch`, `automation_batch`, `voice_campaign_batch`, `appointment_*_scan`, `crm_task_due_scan`, `campaign_recurrence_tick`, etc.). These are **operational queue artifacts**, not customer business records, but they accumulated on production because **completed jobs were never pruned**.
2. **~1,000 `mctb-bench` / `mctb_worker_smoke` failures** — scale/benchmark harness on production DB.
3. **~5,362 on `ws_1`** — real workspace jobs (CRM sync/push, automation, MCTB-related); **898 still pending** (mostly CRM Zoho push backlog — **not deleted**).
4. **17 jobs** on disposable test workspaces.

---

## DELETED

| Category | Rows removed | Criteria |
|----------|-------------:|----------|
| Disposable workspace rows | 10 workspaces + dependents | FK cascade via `workspace.delete` |
| Disposable workspace `job_queue` | 17 | `workspace_id` in disposable list |
| Global completed jobs | 323,782 | `workspace_id IS NULL` AND `status = completed` |
| Bench/smoke jobs | 1,000 + terminal smoke | `idempotency_key` `mctb-bench%` / `mctb_worker_smoke` failed+completed |
| Failed null global jobs | 13 | `workspace_id IS NULL` AND `status = failed` |

**ws_1 pending work:** **898 preserved** (no deletions on `ws_1`).

---

## PRESERVED (ws_1)

- 7 phone numbers, 68 missed calls, 7 conversations, 103 messages, 44 consent events, 265 contacts, 2 users  
- **5,362** `job_queue` rows (**898** actionable pending/deferred)

---

## OBJECT STORAGE

No automatic deletes. Disposable test workspaces had **no** meaningful Storage footprint in inventory. **ws_1** audio unchanged. Separate object audit still recommended for `call-recordings` / `voicemail-greetings`.

---

## POST-CLEANUP

| Metric | Value |
|--------|--------|
| **Workspaces** | **1** |
| **job_queue** | **5,455** (5,362 ws_1 + 93 null pending orphans) |
| **Backup** | **POST_TEST_DATA_CLEANUP** — **153 MiB** (`transovo-20260929T235052Z.dump`, 159,409,208 bytes) |
| **Size delta** | **−14 MiB** (~8%) vs pre-cleanup dump — confirms most “growth” was scheduler/test queue history |

**PRE backup retained** at `/data/backups/transovo-postgres/transovo-20260929T233940Z.dump`.

---

## VALIDATION

| Check | Result |
|-------|--------|
| MCTB consolidated matrix | **61/61 PASS** |
| Commercial guards | **PASS** |
| ws_1 counts | Unchanged operational totals (missed calls, conversations, etc.) |

---

## PREVENTION

| Source | Mitigation |
|--------|------------|
| Scale benches on production | `bench-guard.ts` blocks writes unless `MCTB_BENCH_ALLOW_PRODUCTION_DB=1` |
| Integration tests creating workspaces | `scripts/operations/production-db-guard.ts` — use staging `DATABASE_URL` or explicit opt-in + **mandatory cleanup** |
| Global cron job history | `scripts/operations/prune-completed-job-queue.ts` — **90-day** retention for completed/failed (not enabled in cron yet) |
| Matrix on production | Tests like `test-mctb-press1-consent-db.ts` must **always** `cleanupWorkspace` in `finally` |

**93 null pending jobs** remain (orphaned campaign/voice scheduler rows) — review separately; not deleted to avoid dropping ambiguous pending work.

---

## JOB_QUEUE RETENTION (recommended)

| Status | Policy |
|--------|--------|
| pending / processing / deferred | Retain while actionable |
| failed | Retain **90 days** for investigation |
| completed | Retain **90 days** (operational only; not compliance evidence) |

**Implemented:** script only (`prune-completed-job-queue.ts`). **Not** scheduled until operator approves cron on host.

---

## SAFE TO CONTINUE MCTB GOLDEN PATH

**YES** — matrix 61/61; production DB baseline now reflects **one real workspace** and **~5.4k** queue rows instead of **330k** test/scheduler pollution.
