# MCTB golden path — actionable job_queue health gate

Operational gate (not zero backlog). Run after backlog repair and before MCTB commercial certification.

## Thresholds

| Check | Pass |
|-------|------|
| Unexplained actionable age | No `pending`/`deferred` row older than **14 days** unless type is intentionally scheduled future work |
| Stuck processing | No `processing` with `lockedAt` older than **15 minutes** (reclaim should clear) |
| Backlog trend | 15-minute snapshot: actionable count not growing without new legitimate traffic |
| Null `workspaceId` | No actionable rows on types that require tenant scope (except documented global maintenance) |
| Orphan BullMQ queues | Every `queueName` with actionable rows has a worker in `startBullmqWorkers()` |
| MCTB dispatch | `mctb` + `automations` BullMQ workers ready; recent `john_mctb_send` / `mctb_send_customer_sms` complete or legitimately deferred |
| Shared worker | `QUEUE_DRIVER=bullmq`, Redis reachable, `syncDbOutboxToBullmq` examined > 0 when DB outbox ahead of Redis |

## Scripts

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/actionable-job-queue-triage.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/operations/probe-bullmq-crm-depths.ts
DRY_RUN=1 npx tsx scripts/operations/repair-actionable-job-queue.ts  # default dry run
```

## Golden path blocker

Block MCTB certification only when **shared** queue/worker/DB problems affect SMS dispatch (`sms-send`, `mctb`, `automations`) or unexplained aged actionable rows on MCTB job types. Do not block on intentional CRM/integration backlog that is progressing or administratively retired.
