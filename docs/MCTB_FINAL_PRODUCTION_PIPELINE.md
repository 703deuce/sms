# MCTB Final Production Pipeline (FROZEN)

**Pipeline ID:** `mctb_texml_final_v1`  
**Status:** Pre-production certified — **do not change behavior without explicit product sign-off**  
**PSTN cert (historical):** 2026-08-30 on `+18663464256` (ws_1). That DID is **not** the default `verify:mctb-final-pipeline` target; the verifier resolves the workspace’s configured MCTB voice trigger (ws_1 today: `+18666020680`).

This document is the **only** canonical description of Missed Call Text Back inbound voice + SMS for carrier conditional-forward (CFNA) launch. The implementation lives in `src/lib/mctb/texml-ingress/` and `src/app/api/telnyx/voice/mctb-entry/`.

---

## Frozen rule

**No changes** to the two consent-mode call flows below except bug fixes that restore this spec. Do not:

- Re-point certified DIDs to LiveKit FQDN, Call Control-only, or AI TeXML assistant ingress
- Replace TeXML `mctb-entry` with SIP/LiveKit for MCTB CFNA
- Merge press-1 consent audio with voicemail greeting (they are different assets)
- Remove either `press_1` or `existing_consent` mode
- Add env-var cert switches that alter production `cert=D` behavior without review

Verification:
- `npm run test:mctb-final-pipeline-contract` — unit lock on both mode TeXML shapes (no HTTP)
- `npm run verify:mctb-final-pipeline` — live DB + Telnyx + production `cert=D` entry webhook checks against **workspace config ingress** (override: `WORKSPACE_ID`, `PHONE_E164`, `PHONE_866_ID`)

---

## Architecture (frozen)

```
Carrier CFNA → customer DID (e.g. +18663464256)
    → Telnyx TeXML Application (MCTB_TEXML_DEFAULT_APP_ID)
    → POST /api/telnyx/voice/mctb-entry          (cert=D in production)
    → branch on workspace consentMode
        ├── press_1        → <Play consent audio> + <Gather> press 1
        │                      → POST /api/telnyx/voice/mctb-consent (gather)
        │                      → record consent → MCTB SMS pipeline
        └── existing_consent → <Play voicemail greeting> + <Record>
                               → POST /api/telnyx/voice/mctb-texml-voicemail (recording saved)
                               → POST /api/telnyx/voice/texml-status (hangup)
                               → existing-consent capture → MCTB SMS (any completed call; eligibility may block if paused)
```

**Not in this pipeline:** LiveKit SIP, FQDN ingress, Call Control event-only, voice bridge, AI receptionist on the MCTB DID, Smart Routing after-hours steal.

MCTB voice ingress is **TeXML only** — legacy alternate paths have been removed from the codebase.

---

## Mode 1 — `press_1` (VERIFIED_CALL_CONSENT)

| Step | Behavior |
|------|----------|
| Ingress | `mctb-entry` returns TeXML immediately (no blocking DB) |
| Audio | **Press-1 consent recording** via `<Play>` inside `<Gather numDigits="1">` |
| Consent asset | `cmt3o8tyd1o5r0o4k3e4n5v2l` (`getMctbConsentPlaybackUrl()`) |
| DTMF 1 | `mctb-consent?event=gather&path=texml_mctb_ingress` |
| SMS | After verified press-1 → `triggerMissedCallTextFromConsent` → ws_1 MCTB sender (571) |
| Cert replay | `?cert=C3` on Telnyx `voice_url` (cert only; production uses `cert=D` + `consentMode=press_1`) |

**PSTN cert:** PASS — conditional forward, heard consent audio, press 1, SMS received.

---

## Mode 2 — `existing_consent` (EXISTING_CONSENT)

| Step | Behavior |
|------|----------|
| Ingress | `mctb-entry` when `consentMode=existing_consent` and `cert=D` |
| Audio | **Voicemail greeting** via `<Play>` — **not** the press-1 consent clip |
| Voicemail asset | `cmt8pz72y1o096i6y3c24383j` (`resolveMctbVoicemailFallbackPlayback`) |
| Gather | None — no press 1 |
| Record | `<Record>` collects caller voicemail → transcribe + AI summary |
| Hangup | After greeting + optional message |
| SMS | `texml-status` terminal hangup → `scheduleMctbTexmlExistingConsentCapture` → auto SMS (missed call = text; voicemail optional) |
| Paused schedule | Voicemail still plays; SMS blocked by eligibility |
| Cert replay | `cert=D` + `consentMode=existing_consent` on workspace |

**PSTN cert:** PASS — conditional forward, heard voicemail greeting, hangup, SMS auto-sent.

---

## Production Telnyx (ws_1 / 866 reference)

| Item | Value |
|------|--------|
| DID | `+18663464256` |
| Phone ID | `cmsc3numa1j17084g391t2z5l` |
| TeXML app | `3037587396909598261` |
| Production `voice_url` | `{APP_URL}/api/telnyx/voice/mctb-entry` (no `?cert=`) |
| DB routing | `telephony.routingMode=mctb_texml`, `routingOwner=mctb_texml` |
| Voice + SMS sender | Same DID as Setup (`config.phoneNumberId`) when A2P-approved |
| Cert note | ws_1 historically used 571 for SMS while 866 was voice-only — not production default |
| `aiAfterHoursEnabled` | `false` on 866 |

---

## Ops scripts (frozen setup — do not delete)

| Script | Purpose |
|--------|---------|
| `scripts/prepare-866-mctb-final-test.ts press_1` | Cert press-1 + consent audio + SMS |
| `scripts/prepare-866-mctb-final-test.ts existing_consent` | Cert voicemail + auto SMS |
| `scripts/set-866-mctb-cert-mode.ts D` | Production Telnyx URL (no cert param) |
| `scripts/decommission-866-competing-routes.ts` | Strip AI/LiveKit steals, lock TeXML |
| `scripts/lock-866-mctb-texml-db.ts` | DB routing lock |
| `scripts/disable-ws1-mctb-cooldown.ts` | Cert testing only |
| `scripts/enable-ws1-mctb-cooldown.ts` | Restore 60m cooldown after cert |
| `scripts/verify-mctb-final-pipeline.ts` | Assert frozen state |

---

## Code map (frozen surface)

| Area | Path |
|------|------|
| Ingress | `src/app/api/telnyx/voice/mctb-entry/route.ts` |
| Gather / SMS trigger | `src/app/api/telnyx/voice/mctb-consent/route.ts` |
| Voicemail Record callback | `src/app/api/telnyx/voice/mctb-texml-voicemail/route.ts` |
| TeXML builders | `src/lib/mctb/consent-prompt/texml-response.ts` |
| Frozen constants | `src/lib/mctb/texml-ingress/frozen-pipeline.ts` |
| Status / existing consent SMS | `src/lib/voice/telnyx/texml-status-callback.ts` |
| Route lock guards | `src/lib/mctb/sip-ingress/sync.ts`, `number-assignment.ts`, `agent-service.ts` |

---

## What failed before (do not regress to)

- LiveKit FQDN (`3022029259041408870`) stealing 866 → slow answer / SIP 404 / wrong path
- After-hours AI + voicemail on same DID
- `mctb-entry` 404 before deploy
- SMS from wrong leg (SIP_INGRESS) while voice on TeXML
- `TRIGGER_DISABLED` / cooldown during cert

---

## Change control

Any PR that edits frozen files above must:

1. State why the frozen spec is insufficient
2. Update this document only with explicit approval
3. Re-run PSTN cert on **both** modes
4. Pass `npm run test:mctb-final-pipeline-contract` and `npm run verify:mctb-final-pipeline`
