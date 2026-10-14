# Platform SMS outbound dispatch audit

**Date:** 2026-10-14  
**Scope:** Missed Call Text Back, Appointment Reminders, Mass Texting (Campaigns), Review Requests  
**Question:** Do all four share one **coordinated** outbound queue (due time, priority, fair scheduling, shared rate limits), or only the same platform sender with **parallel** workers?

---

## Executive summary

| Claim | Status |
|-------|--------|
| All four can send via the configured **Transovo platform sender** (`resolveSharedPlatformOutboundSender` / MCTB platform route) | **Verified in code** (per-product resolution paths) |
| All four converge on **`sendQuickSms`** for provider dispatch | **Verified in code** |
| Single shared **FIFO** outbound queue across products | **Not present** |
| Single Postgres **`job_queue`** with global `priority` + `runAfter` ordering | **Present** (authoritative ledger) |
| Production **BullMQ** consumes **separate Redis queues in parallel** | **Verified in code** — not one unified scheduler |
| Cross-product **rate limiting at send time** | **Partial** — campaigns at batch enqueue; reviews at send (`acquireProviderSlot`); MCTB/AR **not** on shared limiter at `sendQuickSms` |
| Time-sensitive traffic not blocked by bulk campaigns | **Partial** — priority helps **DB claim** and **outbox→BullMQ sync**; **not** enforced between concurrent BullMQ queue workers |
| Reviews `send_campaign_sms` on BullMQ/`handleJob` path | **Fixed** — routes to reputation sender when no Prisma `CampaignMessage` |

**Bottom line:** The platform number and dispatch **function** are shared; **coordination** is a **hybrid**: one durable outbox with priorities, but production sending is **sharded by BullMQ queue** with **independent concurrency**. There is **no** single global outbound dispatcher that serializes all four products through one throughput gate.

---

## Shared final dispatch

| Layer | Location | Role |
|-------|----------|------|
| Provider dispatch | `src/lib/sms/send-quick.ts` → `sendQuickSms` | Credits, idempotency (`message` row), registration or `senderRoute`, Telnyx/recording |
| Platform sender | `src/lib/messaging/platform-outbound-sender.ts` | `resolveSharedPlatformOutboundSender()` |
| Recording / mock | `src/lib/voice/testing/headless/recording-sms.ts` | `HEADLESS_PROVIDER_MODE=recording` |

---

## Per-product trace

### 1. Missed Call Text Back (MCTB)

| Step | Detail |
|------|--------|
| **Trigger** | Inbound SMS / recovery pipeline → `enqueueMctbCustomerOutboundSmsJob` (`src/lib/mctb/messaging/enqueue-customer-outbound-sms.ts`) |
| **Job type** | `mctb_send_customer_sms` |
| **Queue name (DB)** | `mctb` (`MCTB_QUEUE_NAME`) |
| **BullMQ queue** | `mctb` (`MCTB_DISPATCH_BULLMQ_QUEUES`) |
| **Priority** | `JOB_PRIORITY_MCTB_OUTBOUND_SMS` = **5** |
| **Worker** | BullMQ worker on `mctb` → `handleJob` → `executeMctbSendCustomerSmsJob` |
| **Sender resolve** | `resolveMctbOutboundSmsRoute` + platform gate (`src/lib/mctb/messaging/outbound-sms-route.ts`, `platform-outbound-gate.ts`) |
| **Dispatch** | `sendQuickSms` with `omitConsumerTrackingLink`, MCTB suppression gates |
| **Persistence** | `message`, `conversationMessage`, MCTB processing trace |

### 2. Appointment Reminders (AR)

| Step | Detail |
|------|--------|
| **Trigger** | Reminder discovery → `ar_dispatch_reminder`; conversational replies → `enqueueArCustomerOutboundSmsJob` |
| **Job types** | `ar_dispatch_reminder`, `ar_send_customer_sms` |
| **Queue name (DB)** | `appointment_reminders` |
| **BullMQ queue** | `appointment_reminders` (`AR_DISPATCH_BULLMQ_QUEUES`, concurrency up to **6**) |
| **Priority** | Reminder dispatch **8**; customer SMS **25** (`JOB_PRIORITY_TRANSACTIONAL`) |
| **Worker** | BullMQ on `appointment_reminders` → `handleJob` → reminder executor / `executeArSendCustomerSmsJob` |
| **Sender resolve** | `sendAppointmentSmsViaPlatformSender` / `resolveAppointmentOutboundSmsRoute` (`src/lib/appointments/sms-sender.ts`) |
| **Dispatch** | `sendQuickSms` with `skipRecipientSuppressionGate` where applicable |
| **Persistence** | AR dispatch rows, `message`, conversation append |

### 3. Campaigns / Mass Texting

| Step | Detail |
|------|--------|
| **Trigger** | `campaign_send_batch` tick → `processCampaignSendBatch` → per-message enqueue |
| **Job types** | `campaign_send_batch`, `send_campaign_sms` / `send_campaign_email` |
| **Queue names** | `review-campaign` (batch), `sms-send` / `email-send` (per message) |
| **BullMQ queues** | `review-campaign`, `sms-send`, `email-send` (`SMS_DISPATCH_BULLMQ_QUEUES`) |
| **Priority** | Default **50** on per-message jobs; batch unprioritized |
| **Worker** | SMS dispatch worker + BullMQ consumers (`scripts/worker-sms.ts`, `processSmsWorkerDueJobs`) |
| **Rate limit** | `canDispatchNow` in `campaign-processor.ts` **only when enqueueing** sends (in-memory token buckets per process) |
| **Fair selection** | `selectDueCampaignMessagesFairly` (`src/lib/messaging/dispatch/fair-queue.ts`) for which messages become due |
| **Sender resolve** | Workspace registration or platform mode in `campaign-message-send.ts` |
| **Dispatch** | `sendQuickSms` or `sendViaRegistration` |
| **Persistence** | `campaignMessage`, `job_queue`, credits via billing helpers |

### 4. Review Requests

| Step | Detail |
|------|--------|
| **Trigger** | Reputation campaign processor → `dispatchFeatureJob({ jobType: "send_campaign_sms", ... })` |
| **Job type** | `send_campaign_sms` (same name as mass texting) |
| **Queue name** | `sms-send` via `jobTypeToQueue` |
| **Worker** | BullMQ `sms-send` → **`handleJob`** (main job handlers) |
| **Sender resolve** | `dispatchReviewRequestSms` → platform sender mode in `review-sms-dispatch.ts` |
| **Provider throttle** | `acquireProviderSlot("twilio" \| "transovo_sms", ...)` in `reputation/campaign-message-send.ts` |
| **Dispatch** | `sendQuickSms` |
| **Persistence** | `review_request_messages` (Supabase), sequence runner |

**Routing fix (2026-10-14):** `src/lib/jobs/job-handlers.ts` now calls `sendCampaignOrReviewMessageById`, which uses Prisma `CampaignMessage` when present, otherwise `reputation/campaign-message-send.ts`. Previously BullMQ only invoked mass-texting `campaign-message-send.ts`, so review message IDs could fail with “not found” in Prisma.

---

## Coordination mechanisms (what exists vs what does not)

### Postgres `job_queue` (durable outbox)

- Enqueue: `enqueueJob` (`src/lib/messaging/enqueue-advance.ts`) — dual-writes to BullMQ when `QUEUE_DRIVER=bullmq`.
- Claim order: **`priority ASC`, `runAfter ASC`** (`claimDueJobs`).
- Idempotency: `idempotencyKey` unique constraint + job handlers / `sendQuickSms` message idempotency.

**Verified (script):** Synthetic rows claim MCTB (5) before AR (25) before campaign (50); future `runAfter` not claimed early.

### BullMQ (production consumer)

- **Separate queues:** `mctb`, `appointment_reminders`, `sms-send`, `review-campaign`, … (`PRODUCTION_DISPATCH_WORKER_BULLMQ_QUEUES`).
- **Parallel workers** with per-queue concurrency (e.g. `sms-send` ≈ 5, `appointment_reminders` ≈ 6, default 4).
- **No cross-queue priority** at Redis — a job in `sms-send` does not yield to `mctb` based on priority once both are active.

### Outbox → BullMQ sync (partial cross-product bias)

- `syncDbOutboxToBullmq` (`bullmq.ts`): ~70% of sync budget for rows with `priority <= JOB_PRIORITY_INTERACTIVE_MAX` (20), then bulk — **only affects promotion into Redis**, not in-flight send ordering across queues.

### Rate limits

| Mechanism | Scope | Shared across 4 products? |
|-----------|--------|---------------------------|
| `canDispatchNow` | Campaign batch enqueue | Platform bucket is global **in-process** but only consulted for **campaign** enqueue |
| `acquireProviderSlot` | Review send path | Twilio/Brevo slot — **not** used by MCTB/AR `sendQuickSms` |
| Telnyx/provider limits | Implicit | **Not** centrally coordinated |

---

## Simultaneous-send scenario (expected behavior)

**Setup:** One MCTB job (prio 5), three AR reminders (prio 8), one review `send_campaign_sms` (50), campaign batch (50+) — all due now.

| Mode | Expected behavior |
|------|-------------------|
| **DB-only** (`processDueJobs` / `claimDueJobs` unfiltered) | Claims respect global priority; MCTB before AR before bulk **within one drain loop** |
| **BullMQ production** | MCTB, AR, and sms-send workers **run concurrently**; campaign bulk can send in parallel with MCTB — **no strict global ordering** |
| **Recording provider** | All paths that reach `sendQuickSms` record to shared in-memory outbox; idempotency keys dedupe |

**Not verified end-to-end in this audit:** Live Redis multi-worker ordering under production concurrency (requires staged BullMQ soak). **Verified:** priority ordering at DB claim layer; recording idempotency; campaign enqueue rate limit; handler routing for reviews.

---

## Implemented: shared platform dispatch gate (2026-10-14 follow-up)

**Module:** `src/lib/messaging/platform-dispatch/`  
**Integration:** `sendQuickSms` → `assertPlatformDispatchForSendQuickSms` immediately before provider dispatch (and before recording adapter when `senderRoute` is set).

| Behavior | Mechanism |
|----------|-----------|
| Distributed throughput | Redis Lua (`redis-coordinator.ts`) per `fromE164` per-second counter; env `PLATFORM_DISPATCH_MPS` (default 10) |
| Priority + FIFO within tier | ZSET score = `priority * PLATFORM_DISPATCH_SCORE_STRIDE + monotonicSeq` (Redis `INCR` per sender; memory counter) — not wall-clock ms. MCTB 5, AR reminder 8, AR transactional 25, bulk 50 |
| Bulk vs interactive | Bulk waiters defer while lower-score (interactive) waiters are due (`interactive_waiting`) |
| Scheduled sends | `platformDispatchNotBefore` on `QuickSendSmsInput` |
| Worker-safe deferral | `PlatformDispatchDeferredError` → `JobDeferredError` (soft) in MCTB / AR / mass campaign jobs |
| Customer A2P | Gate runs only when `isTransovoPlatformOutboundSenderRoute(senderRoute)` |
| Redis down (production) | `PLATFORM_DISPATCH_REQUIRE_REDIS` default on in production → defer (`redis_unavailable`), no silent bypass |
| Tests / local | `PLATFORM_DISPATCH_USE_MEMORY=1` in-process coordinator |

**Reconciled:** `canDispatchNow` no longer consumes a process-local platform bucket (tenant/campaign/sender only). Review platform SMS skips `acquireProviderSlot("twilio")` — platform gate owns throughput.

**Still separate:** BullMQ queue workers and Postgres `job_queue` claim order — gate coordinates **provider dispatch** only, not job dequeue across Redis queues.

## Remaining limitations

1. **BullMQ dequeue order** unchanged — two workers can still *attempt* sends concurrently; gate serializes accepted dispatches to MPS.
2. **Redis multi-process concurrency** covered by `scripts/test-platform-sms-dispatch-redis-concurrency.ts` (requires `REDIS_URL`).
3. **BullMQ four-queue probe** — `scripts/test-platform-sms-dispatch-bullmq.ts` (`mctb`, `appointment_reminders`, `sms-send`, `review-campaign`) with recording provider and `platform_dispatch_gate_probe` job (integration env only).
4. **Weighted bulk reservation** (e.g. 30% cap) not implemented — strict priority with `interactive_waiting` guard only.

---

## Verification commands

```bash
# Topology + priority claim + recording idempotency + review routing (no live SMS)
HEADLESS_PROVIDER_MODE=recording PLATFORM_DISPATCH_USE_MEMORY=1 \
  npx tsx scripts/test-platform-sms-dispatch-coordination.ts

# Multi-process Redis gate (4 child processes, recording provider; requires REDIS_URL)
HEADLESS_PROVIDER_MODE=recording PLATFORM_DISPATCH_MPS=10 \
  npx tsx scripts/test-platform-sms-dispatch-redis-concurrency.ts

# BullMQ four-queue platform gate probe (REDIS_URL + DATABASE_URL)
HEADLESS_PROVIDER_MODE=recording PLATFORM_DISPATCH_USE_MEMORY=1 \
  PLATFORM_DISPATCH_BULLMQ_INTEGRATION_TEST=1 \
  npx tsx scripts/test-platform-sms-dispatch-bullmq.ts

# Priority score unit checks
npx tsx --test src/lib/messaging/platform-dispatch/priority.test.ts

# Existing SMS worker rate-limit unit checks
npx tsx scripts/test-sms-worker-cert.ts
```

---

## Assumptions vs verified

| Item | Verified? |
|------|-----------|
| Separate BullMQ queues per product family | Code + static test |
| `claimDueJobs` global priority ordering | DB-backed test (local cert DB) |
| MCTB priority &lt; AR transactional &lt; default campaign | Constants + claim test |
| Campaign `canDispatchNow` blocks rapid re-enqueue | Pattern in `test-sms-worker-cert.ts` |
| Recording `sendQuickSms` idempotency | Script |
| Reviews BullMQ uses reputation sender | Code fix + routing test |
| Global platform dispatch gate (software MPS) across workers | **Implemented** — Redis Lua + `sendQuickSms`; see `platform-dispatch/` |
| Multi-process Redis priority under contention | **Verified** — `test-platform-sms-dispatch-redis-concurrency.ts` (4 processes, MCTB before bulk, defer/retry, idempotent duplicate job) |
| Carrier-assigned Telnyx throughput matches `PLATFORM_DISPATCH_MPS` | **Not verified** — config default only, not provider contract |
| Full BullMQ worker soak (production queue names + job handlers) | **Not verified** — gate tested at `sendQuickSms` boundary with recording provider |
| Credits never double-charged on retry | **Partial** — idempotency in recording duplicate-job path in Redis test; billing not re-tested here |
