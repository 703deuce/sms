# MCTB FQDN Direct — Manual PSTN Test

Unplug LiveKit from the existing MCTB path. Same Telnyx FQDN SIP connection and signaling; calls terminate in the **existing** `mctb-event-only` handler.

## Architecture

**Before:** Carrier forward → Telnyx FQDN (3PCC+PRACK) → LiveKit → Python MCTB worker → SMS

**Test:** Carrier forward → Telnyx FQDN (3PCC+PRACK) → `/api/telnyx/voice/mctb-event-only` → existing MCTB pipeline → SMS

Only LiveKit is removed. No new MCTB implementation.

## Telnyx setup (once)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-setup-fqdn-direct-mctb.ts --apply
```

This patches the FQDN connection webhook to `mctb-event-only` and ensures the toll-free is on that connection. SIP settings (3PCC, PRACK, ringback) are **not** changed.

## Test numbers

| Role | Number |
|------|--------|
| Forward **to** (Telnyx) | `+1-866-346-4256` |
| Do **not** use | `+1-571-407-3615` (platform 571) |

| Telnyx resource | Value |
|-----------------|-------|
| FQDN connection | `3022029259041408870` (Transovo LiveKit Inbound) |
| Webhook | `/api/telnyx/voice/mctb-event-only` |

No environment variables required.

## Manual test steps

1. Deploy `transovo-web` with these changes.
2. On your phone: set **conditional forward on no answer** to `+1-866-346-4256`.
3. From a second phone, call your business line.
4. Let your phone ring — **do not answer**.
5. After forward connects, stay on the line **15+ seconds**.
6. Hang up.

## What should happen

1. Your phone rings first.
2. Forward reaches Telnyx `+18663464256`.
3. Call stays connected (handler answers via 3PCC Call Control).
4. Original caller ID preserved (Diversion header → `forwardedFrom`).
5. Existing missed-call event fires (`handleMctbInboundEvent`).
6. **No** LiveKit room (`mctb-sip-e2e` / `worker_job_received` absent).

SMS: at most one message if workspace is configured for existing_consent and eligibility passes.

## Logs to watch

```bash
grep 'mctb-event-only'
grep 'fqdn_direct_answer_sent'
grep 'inbound_call_captured'
```

Confirm `livekitRoomCreated: false` and `fqdnDirect: true` on FQDN path events.

## Rollback

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/mctb-rollback-fqdn-direct-mctb.ts --apply
```

## Reliability target

10 consecutive conditional-forward calls — all PASS before declaring LiveKit unnecessary for MCTB.
