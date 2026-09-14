# MCTB inbound SMS — durable processing architecture

## Why the production failure happened

The Telnyx webhook path was still **synchronously awaiting Lead Recovery** (DeepSeek, Microsoft, outbound SMS) inside the HTTP request. The separate `john_mctb_send` worker only sends the **missed-call opener**; it does **not** process inbound customer replies. When the webhook stalled or the process restarted, the inbound row could exist without a completed turn.

## Core invariant

**Never ACK the provider until the inbound event is durably stored and a processing job is committed.**  
**Never require the webhook request to survive AI or provider latency.**

## Flow

```
Telnyx webhook
  → validate / route
  → acceptMctbInboundSmsIngress (transaction)
       • dedupe by providerMessageId
       • persist conversation + inbound message
       • create job_queue row: mctb_process_inbound_sms (queue mctb)
  → COMMIT
  → 2xx immediately

Worker (DB poll or BullMQ)
  → mctb_process_inbound_sms
       • Lead Recovery + DeepSeek + booking (short DB writes only)
       • enqueue mctb_send_customer_sms (outbox)
  → mctb_send_customer_sms
       • sendQuickSms + record conversation outbound
```

## Job types

| Job | Purpose |
|-----|---------|
| `mctb_process_inbound_sms` | One logical inbound turn (Lead Recovery) |
| `mctb_send_customer_sms` | Durable customer SMS delivery |
| `john_mctb_send` | Missed-call **opener** only (unchanged) |

## Idempotency

- Inbound job key: `mctb-process-inbound:{workspaceId}:{providerMessageId}`
- Outbound SMS key: `mctb-lead-recovery:{conversationId}:{providerMessageId}`
- Terminal AI fallback: `mctb-lr-fallback:{conversationId}:{providerMessageId}`

## Observability

Structured logs and `mctbConversationBookingActivity` rows via `logMctbInboundProcessingEvent` (`INBOUND_ACCEPTED`, `WORKER_CLAIMED`, `LR_STARTED`, `LR_COMPLETED`, `OUTBOUND_ENQUEUED`, `OUTBOUND_SENT`, `LR_FAILED`, `LR_FALLBACK_ENQUEUED`).

## Acceptance checklist (deploy)

| Check | Expected |
|-------|----------|
| INBOUND WEBHOOK MAX RESPONSIBILITY | persist + enqueue + ACK |
| WEBHOOK WAITS FOR DEEPSEEK | **NO** |
| WEBHOOK WAITS FOR MICROSOFT | **NO** |
| WEBHOOK WAITS FOR CUSTOMER SMS SEND | **NO** |
| DURABLE INBOUND JOB | PASS |
| DURABLE OUTBOUND JOB | PASS |
| PROVIDER MESSAGE DEDUPE | PASS |
| WORKER CRASH RECOVERY | PASS (job_queue reclaim + retries) |
| DEPLOY/RESTART RECOVERY | PASS |
| CROSS-WORKER SERIALIZATION | PASS (conversation guard, no txn-scoped advisory lock) |
| NO LONG DB TRANSACTION ACROSS LLM | PASS |
| NO LONG DB TRANSACTION ACROSS PROVIDER | PASS |
| MODEL FAILURE SAFE FALLBACK | PASS (bounded retries → terminal fallback SMS job) |

## Worker health

Production (`QUEUE_DRIVER=bullmq`): the **same** `npm run worker:sms` container must run
`startSmsDispatchBullmqWorkers()`, which consumes:

- `review-campaign`, `sms-send`, `email-send` (campaign dispatch)
- **`mctb`** (`mctb_process_inbound_sms`, `mctb_send_customer_sms`, smoke)
- **`automations`** (`john_mctb_send` openers + automation jobs)

Heartbeats: `sms-dispatch` and `mctb-interactive` (same process).

After inbound DB commit, `wakeDurableJobQueueRowToBullmq` pushes the row to BullMQ
immediately (DB remains source of truth). `syncDbOutboxToBullmq` uses **priority-aware**
drain (interactive `priority <= 20` first, then bulk).

Smoke: `npx tsx scripts/mctb-worker-production-smoke.ts` (non-destructive `mctb_worker_smoke` job).
