# Automation job processing

Drip campaigns, AI reply delays, automations, and campaigns all use the **Postgres `job_queue`** (with optional BullMQ dual-write when Redis is configured).

## Production default (recommended): dedicated SMS worker

For scheduled campaigns and production-scale dispatch, run the **SMS worker** in a separate Coolify container:

```bash
npm run worker:sms
```

Full Coolify configuration: **[SMS_WORKER_CONTAINER_SETUP.md](./SMS_WORKER_CONTAINER_SETUP.md)**

On the **web** app set:

```bash
EMBEDDED_JOB_WORKER=0
DISABLE_INPROCESS_WORKER=1
```

## Legacy: embedded worker in web container

The web container start command `node scripts/start-production.mjs` can still spawn `worker:all` in the same container when `EMBEDDED_JOB_WORKER` is not `0`.

**Do not** run embedded `worker:all` and `worker:sms` at the same time — that can double-send.

### Logs to expect on deploy

```text
[start] spawning embedded job worker (npm run worker:all) in same container
[start] using Next standalone server ...
[worker] starting (QUEUE_DRIVER=db)
[worker] DB poll every 5000ms
```

When jobs run:

```text
[worker] processed=2 drip_campaign_step:ok, automation_batch:ok
```

## Job types (automation + SMS)

| Responsibility | Job type | Queue |
|----------------|----------|-------|
| Drip delayed steps | `drip_campaign_step` | `default` |
| AI reply after delay | `ai_reply_respond` | `default` |
| Automation advance | `automation_advance` | `automations` |
| Wake waits / scheduled | `automation_batch` | `automations` |

### Drip campaigns

- **Immediate first message** — sent inline on enroll (no queue wait).
- **Delayed follow-ups** — `job_queue.run_after`; embedded worker sends when due (~5s poll).
- Web container must stay running (normal Coolify deployment).

## Optional configurations

| Variable | Effect |
|----------|--------|
| `EMBEDDED_JOB_WORKER=0` | No sibling worker; use in-process poller only (`instrumentation.ts`) |
| `DISABLE_INPROCESS_WORKER=1` | Web skips in-process drain (use with a **separate** `worker:all` service) |
| `WORKER_POLL_MS` | Poll interval (default `5000`) |
| `QUEUE_DRIVER=bullmq` + `REDIS_URL` | BullMQ consumers in embedded worker |

### Separate worker container (optional, not required)

If you already have a second Node container running `npm run worker:all`:

1. Set `DISABLE_INPROCESS_WORKER=1` on **web**
2. Set `EMBEDDED_JOB_WORKER=0` on **web** (so start script does not spawn another worker)

**Do not** run embedded worker + standalone worker + in-process poller — that can double-send.

Your **transovo-voice** Python container is unrelated to this queue; leave its start command as-is.

## Optional cron backup

Not required when the embedded worker is running. Safety net:

```bash
curl -sS -X POST "$APP_URL/api/jobs/process" -H "Authorization: Bearer $CRON_SECRET"
```

## Health check

- `[worker] processed=N` in web container logs
- `job_queue` rows: `pending` → `completed`
- Drip: `next_run_at` in the past → send within one poll interval
- Automations: `WAITING` + `next_action_at` in the past → advances after tick

## Telnyx SMS

Jobs call `sendQuickSms` → workspace messaging registration → Telnyx when configured. Registration must be **ready** (brand/campaign approved, number attached).
