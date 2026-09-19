# Voice V3 callback — PSTN production certification report

**Status:** Deployment and pre-call configuration **complete**. PSTN calls A/B require a **real phone** (Cloud Agent cannot place or complete PSTN audio calls).

## Deployment

| Item | Value |
|------|--------|
| PR | #439 merged to `master` (fast-forward) |
| Master SHA (production) | `32a4a28782d2c009796c672ed01af964624c2bb3` |
| Coolify deployment | `application_deployment_queues.id=2976` **finished** |
| Production container | `ds8s3hjin60qs6g7s0iqkixs-190727670192` |
| `/api/health` `commitSha` | `32a4a28782d2c009796c672ed01af964624c2bb3` |
| Container health | Up, clean boot logs |

Protected baselines: **no code changes** to Microsoft booking executors or SEND_LINK transport on this deploy.

## Pre-PSTN production agent configuration

**Number:** +15717491060  
**Agent:** `cmshz2lc25c622c4i58303501` (ACTIVE, `ws_1`)  
**Booking strategy:** `SEND_LINK` (unchanged)

| Check | Result |
|-------|--------|
| `callbackRequestsEnabled` | **true** (published v**105** — callback-only wizard flag; strategy untouched) |
| `callbackRequiredCollectFieldIds` | `full_name`, `phone`, `service` |
| `operationRequirements.request_callback` | `name`, `phone`, `service_reason` |
| Astra catalog includes `request_callback` | **yes** |
| Astra catalog includes `send_booking_link` | **yes** (SEND_LINK frozen path) |
| `operationRequirements.book_appointment` | unchanged (explicit `phone` intake still required for booking) |

Verify script: `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ws1-verify-voice-v3-callback-production.ts`

## PSTN certification A — direct callback

**Not executed from Cloud Agent** (no PSTN audio path on the VM).

After you complete the call, inspect:

```bash
CALL_CONTROL_ID='v3:...' \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/inspect-voice-v3-callback-pstn-cert.ts
```

Pass criteria: see user checklist (Astra `request_callback`, VOICE_V3 persistence, no legacy/CRM/SEND_LINK side effects).

## PSTN certification B — booking → callback switch

**Not executed from Cloud Agent.**

Same inspect script; confirm tool sequence shows booking tools before switch, then single `request_callback`, no `book_appointment` success, no SMS send.

## Post-call inspect

`scripts/inspect-voice-v3-callback-pstn-cert.ts` — tool sequence, `CallbackRequest` rows (`metadata.source = VOICE_V3`), booking attempts on call, SMS on call.

## Freeze

Do **not** mark callback FROZEN until both PSTN calls pass and evidence is recorded in this document.
