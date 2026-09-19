# Voice V3 SEND_LINK — production freeze gate

**Freeze parity:** same bar as Microsoft direct booking — do not mark SEND_LINK production-frozen until **one real PSTN call** passes **all four gates** on the deployed commit that includes dedicated SMS transport (`sendVoiceV3BookingLinkSms`).

## Required production commit

- Dedicated transport: `src/lib/voice-v3/booking-link/send-voice-v3-booking-link-sms.ts`
- Isolation guard: `scripts/test-voice-v3-booking-link-sms-isolation.ts`
- Minimum SHA: includes `8a0bb43a` (or later on `master`)

Verify: `GET /api/health` → `commitSha` matches.

## Four gates (single PSTN call)

| # | Gate | Pass criteria |
|---|------|----------------|
| **A** | **From** | `Message.from` = wizard published sender **+15717491060** (not HP +15714073615) |
| **B** | **URL** | Body contains exact published booking URL; **no** `/r/` tracking rewrite; `trackingToken` null |
| **C** | **CRM** | Web logs: **no** `bullmq_job_enqueued` for `crm-*` with id `sms.sent-sms-<messageId>` within 60s of send |
| **D** | **Delivery** | `Message.status` / `providerStatus` = **delivered**; Telnyx `providerId` present |

Voice path must also show:

- `SEND_BOOKING_LINK_PROVIDER_ACCEPTED`
- `VOICE_V3_BOOKING_LINK_SMS_ACCEPTED` (dedicated transport log line)
- `VOICE_TOOL_EXECUTION_SUCCEEDED` for `send_booking_link`
- Consent row `VOICE_BOOKING_LINK` for call session id

## Automated check (after call)

```bash
# From message id (inbox/admin) or after inspect script prints id:
CALL_CONTROL_ID='v3:...' \
EXPECTED_FROM='+15717491060' \
EXPECTED_BOOKING_URL='https://<your-public-booking-url>' \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/verify-voice-v3-send-link-freeze-gate.ts
```

Optional SSH (production web container, last 15m):

```bash
docker logs --since 15m <web-container> 2>&1 | rg 'VOICE_V3_BOOKING_LINK_SMS|crm-.*sms.sent'
```

Scheduler container: **no** SEND_LINK send expected.

## Failed call reference (do not freeze)

PSTN `v3:w5bmTLPUAd8U54mZRkmCrWTRrUS4QziT_1PGEFL8mvqU6g0buIuAPQ` @ 2026-09-19 ~18:19 UTC on `fd0dfb1c`:

- Tool succeeded; Telnyx **delivered**
- **Failed gates A, B, C** (wrong From, `/r/` append, CRM enqueued)
- See `docs/VOICE-V3-PSTN-CALL-FORENSICS-2026-09-19-live_u7.md` pattern

## When all four pass

1. Record call control id, message id, commit SHA, timestamp in this doc (append table).
2. Mark SEND_LINK **FROZEN** in `docs/VOICE-V3-SEND-BOOKING-LINK-IMPLEMENTATION-REPORT.md`.
3. No further SEND_LINK transport changes without new freeze gate + PSTN re-cert.
