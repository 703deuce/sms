# Voice AI worker (Coolify)

Voice jobs use the same worker infrastructure as SMS and automations.

## Start command

```bash
npm run worker:all
```

With Redis-backed BullMQ (recommended in production):

```bash
QUEUE_DRIVER=bullmq
REDIS_URL=redis://...
npm run worker:all
```

## Voice job types

| Job type | Queue | Purpose |
|----------|-------|---------|
| `voice_webhook_process` | `voice-calls` | Process Telnyx Call Control / AI events |
| `voice_post_call` | `voice-calls` | Insights, usage, automations |
| `voice_campaign_batch` | `voice-calls` | Outbound campaign pacing (minute cron) |
| `voice_mock_call_complete` | `voice-calls` | Mock dial lifecycle for dev/test |
| `voice_recording_ingest` | `voice-calls` | Store recording URLs from webhooks |

Cron `/api/jobs/process` (or worker minute tick) enqueues `voice_campaign_batch`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELNYX_API_KEY` | Live calls | Telnyx API key |
| `TELNYX_PUBLIC_KEY` | Webhooks | Ed25519 webhook verification |
| `TELNYX_CONNECTION_ID` | Outbound/inbound CC | Call Control application / connection ID |
| `APP_URL` | Yes | Public base URL for webhooks |
| `QUEUE_DRIVER` | Prod | `bullmq` with `REDIS_URL` |
| `REDIS_URL` | BullMQ | Redis connection |
| `VOICE_TELEPHONY_CENTS_PER_MIN` | Optional | Provider telephony cost basis |
| `VOICE_AI_CENTS_PER_MIN` | Optional | AI minute cost basis |
| `VOICE_BILLING_MARKUP` | Optional | Customer markup multiplier |

## Telnyx webhook URL

Configure in Telnyx Call Control application:

```
https://your-app.com/api/telnyx/voice
```

Also available via `getTelnyxWebhookUrls().voice` in code.

## Health

Worker logs job results. Failed jobs remain in `job_queue` with `failed` status for inspection.

Emergency stop: set `VoiceComplianceProfile.emergencyStop` for a workspace (settings UI).
