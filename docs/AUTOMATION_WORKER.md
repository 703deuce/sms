# Automation worker deployment

Automations depend on a **background worker** (or cron) to advance executions, wake delayed steps, and run scheduled triggers. Saving a workflow in the UI does not execute it by itself.

## What must run

| Responsibility | Job type | Queue |
|----------------|----------|-------|
| Advance execution steps | `automation_advance` | `automations` |
| Wake waiting executions | `automation_batch` → `processAutomationWaits` | `automations` |
| Scheduled datetime triggers | `automation_batch` → `processScheduledAutomations` | `automations` |
| Campaign sends (separate) | `campaign_send_batch`, `send_campaign_sms` | `review-campaign`, `sms-send` |

## Worker command

```bash
npm run worker:all
```

This process:

1. **Default (`QUEUE_DRIVER` unset)** — polls the Postgres `job_queue` table every `WORKER_POLL_MS` (default 5s) and processes due jobs including `automation_batch` and `automation_advance`.
2. **BullMQ (`QUEUE_DRIVER=bullmq` + `REDIS_URL`)** — starts BullMQ workers for `automations` (and other queues). Minute cron should still call `POST /api/jobs/process` to enqueue `automation_batch` and sync the DB outbox.

Do **not** run two consumers on the same queue (DB poll + BullMQ for the same jobs) — that can double-send messages.

## Coolify / production

Run **two services** (or one web + one worker):

1. **Web** — `npm run build && npm run start` (Next.js app)
2. **Worker** — `npm run worker:all` (long-running process, no HTTP port)

Optional **cron** (if not relying solely on worker poll):

```bash
# Every minute — enqueue batch jobs and sync outbox
curl -sS -X POST "$APP_URL/api/jobs/process" -H "Authorization: Bearer $CRON_SECRET"
```

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma / job queue |
| `APP_URL` | Tracking links, webhook URLs |
| `INTEGRATION_SECRET_KEY` | Messaging credential encryption |
| `QUEUE_DRIVER` | `bullmq` for Redis queues, omit for DB-only |
| `REDIS_URL` | Required when `QUEUE_DRIVER=bullmq` |
| `CRON_SECRET` | Auth for `/api/jobs/process` |
| Twilio/Telnyx vars | Live SMS (mock works without) |
| `BREVO_API_KEY` | Email automation actions |

## Health check

- Worker logs: `[worker] processed=N` when jobs run
- DB: `job_queue` rows move from `pending` → `completed`
- DB: `automation_execution` with `status=WAITING` and `next_action_at` in the past should transition to `RUNNING` after worker/cron tick

## Retry policy

- BullMQ: 8 attempts with exponential backoff (15s base) for automation jobs; registration jobs use higher attempts
- DB queue: soft defer via `JobDeferredError` re-schedules `run_after`
- SMS/email actions use **idempotency keys** (`auto:{executionId}:{nodeId}`) so retries do not double-send

## Paused automations

- Flow `status=PAUSED` — `advanceAutomationExecution` skips; waits do not resume
- Scheduled triggers skip non-`ACTIVE` flows
