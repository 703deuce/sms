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

## Gaps and smallest safe follow-ups (not implemented here)

1. **Global send gate at `sendQuickSms`** (or shared Redis limiter keyed by platform `fromE164`) if carrier throughput must be enforced across MCTB + AR + campaigns + reviews simultaneously.
2. **Unified BullMQ priority queue** (single queue + weighted fair queue) — larger change; conflicts with current queue isolation for ops/metrics.
3. **Extend `acquireProviderSlot` to all platform-sender sends** — aligns reviews with MCTB/AR for provider throttling without rewriting product engines.

---

## Verification commands

```bash
# Topology + priority claim + recording idempotency + review routing (no live SMS)
HEADLESS_PROVIDER_MODE=recording npx tsx scripts/test-platform-sms-dispatch-coordination.ts

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
| Production never exceeds combined Telnyx MPS across workers | **Not verified** — no global gate |
| Credits never double-charged on retry | **Partial** — idempotency in `sendQuickSms` / product rows; not re-tested here |
