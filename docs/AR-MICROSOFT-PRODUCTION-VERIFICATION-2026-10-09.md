# Appointment Reminders — Microsoft 365 production verification snapshot

**Date:** 2026-10-09 (UTC)  
**Scope:** Verification only — no scheduler, delta sync, or Telnyx architecture rewrites this pass.  
**Production commit (health):** `783ab2adc`  
**Hardening merge:** PR #628 → `master` (`dd84e6e6`)

---

## What was already in production (from earlier hardening)

- **Merged:** PR #628 → `master` (`dd84e6e6`, then doc commit `783ab2adc`).
- **Implementation** (unchanged this session): migration `20261009120000_ar_microsoft_production_hardening`, Microsoft reconcile scheduler, `ar_reminder_dispatches`, Telnyx reconcile hook, dry-run lease fix, etc. — see `docs/AR-MICROSOFT-PRODUCTION-HARDENING-RESULTS.md`.

---

## What this verification pass checked

### 1. Production database migration — VERIFIED

- Web container: `npx prisma migrate status` → **“Database schema is up to date!”** (31 migrations).
- `_prisma_migrations` row: **`20261009120000_ar_microsoft_production_hardening`**, `finished_at` **2026-10-09T19:46:52Z**, `applied_steps_count: 1`.
- **`ar_reminder_dispatches`** table exists and is queryable.
- Schedule columns on `voice_calendar_connections`: **`nextSyncDueAt`**, **`syncBackoffUntil`**, **`subscriptionRenewDueAt`**.

### 2. Workers and queues — PARTIALLY VERIFIED

- **Web container** runs **`scripts/worker-all.ts`** alongside Next (`EMBEDDED_JOB_WORKER=1`, `QUEUE_DRIVER=bullmq`, Redis configured).
- **`worker_heartbeats`:** `sms-dispatch` / `mctb-interactive` active; BullMQ queue list includes **`appointment_reminders`**.
- **`scripts/diag-production-job-queue.ts`** on production: large maintenance backlog (mostly non-AR); MCTB job paths healthy.
- **Probe** `scripts/ar-microsoft-production-verification-probe.ts` (against production DB via hydrated env) showed recent activity (24h window, approximate):
  - `calendar_connections_reconcile`: **333 completed**, small backlog
  - `calendar_subscription_renew`: **11 completed**
  - `appointments_platform_reminder_scan`: **280 completed**, backlog ~59
  - `ar_dispatch_reminder`: activity present (small backlog)
  - `microsoft_calendar_webhook_process`: **0 completed** in that window (quiet period or webhook-light traffic)
- **Gaps / follow-ups:**
  - Dedicated **SMS worker** container image **`430d3a46…`** vs web **`783ab2adc`** — commit parity not aligned with web.
  - **Scheduler** container **`tgjrid…`** on **`fc8a5a96…`** (voice/LiveKit slot); does not auto-deploy with web on `master` push.
  - **`GET /api/appointment-reminders/ops/metrics`** — **not** called with an authenticated session (blocked without cookie).

### 3. Microsoft 365 E2E — PASS (one full run)

**Script:** `scripts/ar-calendar-microsoft-production-lifecycle-e2e.ts`  
**Tenant:** `WORKSPACE_ID=ws_1`, connection `cmu1uq7f15s1o5s4f6c5b6a57` (test Microsoft connection only).

| Step | Result |
|------|--------|
| Create in Outlook → appears in Transovo | **PASS** (webhook wait + **sync backstop** if webhook slow) |
| Update title | **PASS** |
| Reschedule (same appointment row) | **PASS** |
| Delete → cancel / suppress reminders | **PASS** |
| Backstop import (sync without relying on webhook wait) | **PASS**; `lastSyncAt` / `nextSyncDueAt` updated on connection |

**Evidence log (agent VM):** `/opt/cursor/artifacts/ar-m365-lifecycle-e2e-v3.log` → **`[lifecycle] SUMMARY PASS`**

### 4. Live SMS reminder — NOT COMPLETED

- **Script added:** `scripts/ar-production-dispatch-reminder-smoke.ts` (discovery + real dispatch + provider message ID poll).
- **Not run to completion** in this pass — no confirmed Telnyx submission, webhook reconciliation on dispatch row, or handset delivery.

### 5. 600-reminder throughput — HARNESS IMPROVED; 600 RUN NOT COMPLETED

**Changes (local, see git status below):** `scripts/test-ar-reminder-throughput.ts`

- **`createMany`** in batches of 100 (replaces slow sequential inserts).
- Full cleanup of isolated scale workspace `AR_SCALE_TEST_DO_NOT_USE`.
- Separate timings: `dataCreateMs`, discovery, mock dispatch.
- Run-scoped appointment IDs + `startsWith` filters (avoids PostgREST failures on huge `IN` lists).

**Results:**

| Run | Outcome |
|-----|---------|
| `--count=20` | **PASS** (~322 ms create, ~7.8 s discovery, ~9 s mock dispatch) |
| `--count=600` | **NOT COMPLETED** — discovery logged `enqueued: 2000` on first tick (per-tick cap / multiple reminder steps per row), then stalled or **Supabase `fetch failed`** from cloud agent VM; never reached `PASS` |

**Recommendation:** Run `--count=600` inside the **production web container** (or any host with stable DB access), not only from the cloud agent VM.

---

## New / modified files (verification tooling)

| File | Purpose |
|------|---------|
| `scripts/ar-microsoft-production-verification-probe.ts` | Read-only: migration row, schema sample, AR job activity, heartbeats |
| `scripts/ar-calendar-microsoft-production-lifecycle-e2e.ts` | M365 create / update / delete / sync backstop on test connection |
| `scripts/ar-production-dispatch-reminder-smoke.ts` | Single real SMS via dispatch pipeline (not executed end-to-end yet) |
| `scripts/test-ar-reminder-throughput.ts` | Batched test data + metrics (modified) |

**Git state at time of writing:** changes on `master`, **not necessarily committed/pushed** — run `git status` before relying on remote.

---

## Pilot readiness summary

| Area | Status |
|------|--------|
| Migration on production | **Verified** |
| Workers consuming AR / maintenance jobs | **Likely yes** (web `worker-all` + heartbeats); dedicated SMS worker **behind** web commit |
| M365 create / update / delete + sync backstop | **PASS** (test tenant) |
| One real SMS + delivery webhook on dispatch row | **Not verified** |
| 600-reminder mock simulation | **Harness improved; full run incomplete** |
| Ops metrics endpoint | **Not verified** (needs auth session) |

**Bottom line:** Hardening from PR #628 is deployed; production migration is confirmed. **Outlook lifecycle on the authorized test connection passed.** Remaining before a small Microsoft-only pilot feels “proven”: **one live SMS**, **600 throughput to completion** (or agreed smaller number on prod), optional **ops metrics** with session, optional **SMS worker redeploy** to match web `783ab2adc`.

---

## Known limitations (unchanged from hardening review)

- **Telnyx timeout / no persisted message ID:** reconcile by provider ID cannot match; dispatch may stay `unknown` — no blind retry (by design). Monitor `unknownSubmissions` via ops metrics when authenticated.
- **Large-scale throughput:** not proven at 600+ concurrent due reminders from cloud agent alone.

---

## Useful commands

```bash
# Production health
curl -sS "<production-host>/api/health"

# Hydrate prod DB env (cloud agent)
npx tsx scripts/cloud-agent/hydrate-prod-test-env.ts

# Read-only prod probe
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-microsoft-production-verification-probe.ts

# M365 lifecycle (test connection only)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-calendar-microsoft-production-lifecycle-e2e.ts

# Throughput (mock Telnyx)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-reminder-throughput.ts --count=600

# Job queue diag (run in prod web container)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/diag-production-job-queue.ts
```
