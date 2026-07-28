# Local SEO Express–style Twilio ISV messaging backend for Transovo SMS.
#
# Mental model:
#   Parent ISV Twilio account
#     └── Per workspace → Twilio Subaccount
#           ├── Secondary Customer Profile (TrustHub)
#           ├── A2P Trust Product
#           ├── Brand Registration (BN…)
#           ├── Messaging Service (MG…)
#           ├── US A2P Campaign / 10DLC
#           └── Purchased phone number attached to Messaging Service
#
# Outbound SMS only works when registration overall_status = ready.

## Always-on processes

1. **Web app** — Next.js APIs + UI
2. **Worker** — `npm run worker:all` (registration advance + campaign drains + SMS sends)
3. **Minute cron**
   ```bash
   curl -X POST "$APP_URL/api/jobs/process" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```

Do not also run a separate messaging-only worker if `worker:all` is already running.

## Public Twilio webhooks

| URL | Purpose |
|---|---|
| `{APP_URL}/api/twilio/inbound` | Inbound SMS (STOP/replies) |
| `{APP_URL}/api/twilio/message-status` | Delivery receipts |
| `{APP_URL}/api/twilio/compliance-status` | TrustHub / Brand callbacks → enqueue advance |

## Registration API

`GET/POST /api/messaging/registration`

Actions (`POST` body `action`):

| Action | Notes |
|---|---|
| `start` | Create subaccount + registration row |
| `save_business` | TrustHub business attributes |
| `save_use_case` | Brand/campaign samples + opt-in language |
| `purchase_number` | Buy PN on subaccount (`phoneNumber`) |
| `release_number` | Release purchased PN |
| `submit` | Certify + submit Secondary Profile (`certified: true`) |
| `refresh_status` | Re-run / enqueue advance |
| `activate` / `pause` / `resume` | Toggle messaging |
| `send_test` | Test SMS via Messaging Service (`to`, optional `body`) |

Number search: `GET /api/messaging/numbers?workspaceId=…&areaCode=415`

## Sending

- One-off SMS: `POST /api/sms/send` `{ to, message, workspaceId? }` — **blocked until ready**
- Campaigns: `POST /api/campaigns` with optional `sequenceJson` + `recipients`
- Enroll: `POST /api/campaigns/{id}/enroll`
- Click tracking: `GET /r/{trackingToken}`

## Jobs

| Job | Queue | Does |
|---|---|---|
| `messaging_registration_advance` | `review-campaign` | A2P state machine |
| `campaign_send_batch` | `review-campaign` | Drain waits + queue due sends |
| `send_campaign_sms` | `sms-send` | Deliver one SMS |
| `send_campaign_email` | `email-send` | Deliver one email (Brevo stub until key set) |

DB table `job_queue` is the default driver. Set `QUEUE_DRIVER=bullmq` + `REDIS_URL` to also attach BullMQ workers.

## Ready gate (live)

- Secondary profile + trust product submitted/approved as required
- Brand `APPROVED`
- A2P Campaign `VERIFIED`
- Messaging Service exists
- Phone purchased **and attached**
- `messagingEnabled = true`, not paused

## Code map

| Path | Responsibility |
|---|---|
| `src/lib/messaging/*` | ISV config, crypto, adapters, registration processor |
| `src/lib/campaigns/*` | Sequence engine, enroll, drain, send |
| `src/lib/jobs/*` | Cron handlers + optional BullMQ |
| `src/app/api/messaging/*` | Registration + number search |
| `src/app/api/twilio/*` | Webhooks |
| `src/app/api/jobs/process` | Minute cron |
| `scripts/worker-all.ts` | Long-running worker |

## Local mock mode

Omit `TWILIO_MODE=live` (and `MESSAGING_ADAPTER=twilio`). The mock adapter creates fake SIDs and flips registration to `ready` after submit + number purchase — useful for UI/API integration without Twilio.
