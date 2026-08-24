# MCTB SIP Press-1 — Regression Freeze Boundary

**Status:** FROZEN as of production proof on `+15714073615` (2026-08-24).

Smart Routing and other work must **not** modify these paths without explicit approval and full regression re-run.

## Canonical production path

```
PSTN → Telnyx FQDN (MCTB_571_SIP_FQDN_CONNECTION_ID)
     → self-hosted LiveKit SIP inbound trunk + shared dispatch rule
     → Python voice worker (TRANSOVO_LIVEKIT_AGENT_NAME)
     → resolve_mctb_sip_session
     → consent audio + DTMF Press-1
     → record_mctb_sip_press_1_consent
     → recordSmsConsent + triggerMissedCallTextFromConsent
     → processMissedInboundCall → missedCallEvent
     → scheduleMissedCallText → john_mctb_send
     → executeMissedCallTextSend → sendQuickSms
     → delivery webhook → sms.delivered trace
```

## Frozen files (do not refactor)

| Area | Path |
|------|------|
| SIP session resolve + consent record | `src/lib/voice/python-runtime-bridge/mctb-sip-session.ts` |
| Press-1 consent + MCTB trigger | `src/lib/smart-routing/consent-service.ts` |
| Missed call process + schedule | `src/lib/agents/missed-call-text-back/process.ts`, `schedule.ts` |
| SMS send gate (SIP_INGRESS vs EVENT_ONLY) | `src/lib/agents/missed-call-text-back/send.ts` |
| Internal voice-runtime API | `src/app/api/internal/voice-runtime/route.ts` |
| Python MCTB production session | `voice-runtime-python/transovo_voice/session/mctb_sip_production.py` |
| Python MCTB router + frozen SIP answer | `mctb_sip_diagnostic.py`, `sip_frozen_answer.py`, `sip_consent_audio.py`, `sip_dtmf.py` |
| MCTB SIP ingress resolver/sync | `src/lib/mctb/sip-ingress/resolver.ts`, `sync.ts` |
| Platform demo E164 constant | `src/lib/mctb/onboarding/constants.ts` |
| Frozen trunk/dispatch env | `LIVEKIT_INBOUND_TRUNK_ID`, `LIVEKIT_DISPATCH_RULE_ID` (see `production-verification-pass.ts`) |

## Frozen production identifiers (571 demo)

- **E164:** `+15714073615` (`MCTB_PLATFORM_DEMO_E164`)
- **LiveKit inbound trunk:** `ST_acZETLdoDQ8o`
- **Dispatch rule:** `SDR_anLzF5j5kqpU`
- **Telnyx FQDN connection:** `MCTB_571_SIP_FQDN_CONNECTION_ID` (default `3022029259041408870`)

## Regression commands (run before AND after Smart Routing changes)

```bash
npm run test:mctb-sip-ingress-send-gate
npm run test:mctb-press1-consent-db
npm run test:mctb-consent-log
npm run test:mctb-sip-e2e-trace
npm run test:mctb-engine-matrix
node scripts/mctb-audit-proof-call-db.ts <latest-missed-call-event-id>
node scripts/production-verification-pass.ts
```

Baseline snapshot: `scripts/mctb-regression-baseline.ts --write`

## Allowed Smart Routing touch points

- **Telnyx Call Control** path (`webhook-handlers.ts` `call.initiated` → Smart Routing) — separate from LiveKit SIP MCTB ingress
- **New** `callHandlingMode` on customer numbers — must not alter 571 platform demo flags
- **New** number purchase/provision UI — must not call `provisionMctbTelnyxSipIngress` for SR-only numbers

## Isolation rule

When a number is in `callHandlingMode: smart_routing`:

- MUST NOT set `mctbSipIngress: true`
- MUST NOT route Telnyx to LiveKit FQDN for that DID
- MUST NOT create `missedCallEvent` / Press-1 consent for SR menu calls

When a number is in `callHandlingMode: mctb`:

- MUST NOT assign `routingOwner: smart_routing` on that DID
- MUST use LiveKit SIP ingress (not Call Control menu runtime)
