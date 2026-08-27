# MCTB Direct Telnyx Test — Implementation Audit

Non-destructive isolation experiment: determine whether MCTB can work **without LiveKit** when forwarded PSTN calls use the existing FQDN SIP signaling stack (3PCC, PRACK, 183 Session Progress, ringback).

**This is a test only.** Production defaults and the LiveKit path are unchanged.

---

## 1. Where the forwarded PSTN call first enters our system

| Path | Entry | Used for |
|------|-------|----------|
| **FQDN SIP (production MCTB)** | Telnyx FQDN connection `3022029259041408870` ("Transovo LiveKit Inbound") | Carrier conditional forward → Telnyx PSTN → SIP INVITE on FQDN |
| **Call Control hub** | `POST /api/telnyx/voice` (`webhook-handlers.ts`) | Smart Routing, AI voice, legacy 571 fast-answer |
| **TeXML Press-1** | `/api/telnyx/voice/mctb-consent` | `press_1` consent mode |
| **EVENT_ONLY** | `/api/telnyx/voice/mctb-event-only` | `existing_consent` — metadata only, no answer |
| **Voice bridge** | `/api/telnyx/voice/mctb-voice-bridge` | Telnyx 571 → Twilio second hop |
| **Direct test (new)** | `/api/telnyx/voice/mctb-direct-telnyx-test` | **Test only** — FQDN 3PCC, no LiveKit |

For this experiment, the test number **`+18553103375`** (855 TFN) is assigned to the **same FQDN connection** as LiveKit ingress, with webhook pointed at the direct-test handler.

---

## 2. Telnyx SIP / Call Control / TeXML / 3PCC usage

| Component | ID / route | Role |
|-----------|------------|------|
| FQDN connection | `3022029259041408870` | Inbound SIP with `prack_enabled`, `generate_ringback_tone`, `third_party_control_enabled` |
| FQDN destinations | `voice.transovo.ai` (LiveKit SIP) | Production media destination — **not invoked** when 3PCC holds call at Telnyx |
| Call Control diagnostic | `3031983555518399856` | Separate 571 test app (no PRACK on Call Control API) |
| TeXML consent | `MCTB_571_CONSENT_TEXML_APP_ID` | Press-1 path |
| 3PCC API field | `third_party_control_enabled` | Enables Call Control webhooks on SIP/FQDN before bridging to destination |

Key files:

- `src/lib/mctb/consent-prompt/telnyx-3pcc.ts` — 3PCC / PRACK field constants
- `src/lib/mctb/sip-diagnostic/fqdn-audit.ts` — FQDN late-media audit + PATCH
- `src/lib/mctb/direct-telnyx-test/telnyx-fqdn-route.ts` — test webhook + number assignment

---

## 3. Where LiveKit enters the call path (production)

```
Carrier conditional forward
  → Telnyx PSTN (+18553103375 or +15714073615)
  → FQDN SIP connection (3PCC + PRACK at Telnyx edge)
  → [production] SIP INVITE to voice.transovo.ai (LiveKit SIP)
  → LiveKit room + Python worker (`transovo_voice/main.py`)
  → capture_mctb_sip_inbound / MCTB session (`mctb_sip_production.py`)
```

LiveKit entry points:

- `voice-runtime-python/transovo_voice/main.py` — worker registration
- `voice-runtime-python/transovo_voice/session/mctb_sip_production.py` — MCTB SIP session
- `src/lib/voice/python-runtime-bridge/mctb-sip-session.ts` — Next.js bridge
- `src/app/api/internal/voice-runtime/route.ts` — `capture_mctb_sip_inbound`

**Direct test path bypasses steps after 3PCC webhook** — no LiveKit room, no Python worker job.

---

## 4. Signaling changes that fixed forwarded-call disconnect

Evidence from scripts, comments, and runbooks:

| Symptom | Source | Interpretation |
|---------|--------|----------------|
| `PROGRESS_TIMEOUT` | `scripts/mctb-trace-pipeline.ts` | Telnyx received no 180/183 from SIP destination in time — carrier dropped forward |
| Need 183 + SDP, not empty 180 | `scripts/mctb-setup-571-sip-delayed-offer.ts` | Delayed-offer INVITE from AT&T requires Session Progress with SDP |
| PRACK / 100rel | FQDN `prack_enabled` | Reliable provisional responses for carrier forward leg |
| 3PCC | `third_party_control_enabled` on FQDN | Telnyx answers carrier with proper late-media before downstream SIP |
| Generate ringback | `generate_ringback_tone` on FQDN | Audible progress for carrier while negotiating |

**Ownership:** These behaviors are **Telnyx FQDN connection configuration**, not LiveKit application code. LiveKit receives the call only after Telnyx has satisfied the carrier signaling window (~5s for AT&T).

---

## 5. Explicit dependencies traced

| Behavior | Controlled by | Notes |
|----------|---------------|-------|
| **100rel** | Telnyx FQDN `prack_enabled` + carrier | Visible in `sip_headers` when negotiated |
| **PRACK** | Telnyx FQDN inbound settings | API field `prack_enabled` on FQDN only |
| **183 Session Progress** | Telnyx edge (3PCC + ringback) | Not emitted by our app code |
| **Early SDP** | Telnyx 3PCC late-media negotiation | Before bridge to LiveKit |
| **Early media** | Telnyx ringback tone | `generate_ringback_tone` |
| **Delayed offer** | Carrier (AT&T forward) + Telnyx 3PCC | INVITE may arrive without SDP |
| **3PCC** | `third_party_control_enabled` on FQDN | Webhook → Call Control API |

LiveKit SIP endpoint (`voice.transovo.ai`) handles **post-signaling** media — it does not configure PRACK/183 for the carrier leg.

---

## 6. Previous failure condition

**Root cause (best evidence):** Carrier conditional-forward leg dropped because Telnyx could not send timely **183 Session Progress with SDP** (or PRACK-completed provisional) to the carrier before the forward timeout.

Failure mode: `PROGRESS_TIMEOUT` — no 180/183 from SIP destination in time.

Contributing factors documented in repo:

- Routing 571 through Call Control app without FQDN PRACK fields
- Empty 180 Ringing (Content-Length: 0) on delayed-offer INVITEs
- AT&T Diversion header present but downstream SIP destination too slow to respond

**Hypothesis under test:** Enabling FQDN 3PCC + PRACK + ringback fixes the carrier leg; LiveKit is not required for holding the forward long enough to capture a missed call.

---

## 7. Direct test architecture

```
Carrier conditional forward (no answer)
  → Telnyx PSTN +18553103375
  → FQDN 3022029259041408870 (3PCC + PRACK + ringback — same as LiveKit path)
  → Telnyx Call Control webhook → /api/telnyx/voice/mctb-direct-telnyx-test
  → answer + speak + hold ≥15s
  → call.hangup → normalized call.forwarded_unanswered / call.missed (log only, no SMS default)
  → NO LiveKit room
```

Gates:

- `MCTB_DIRECT_TELNYX_TEST=1` on server
- `MCTB_DIRECT_TELNYX_TEST_E164S=+18553103375` (default)
- Telnyx: `scripts/mctb-setup-direct-telnyx-test-800.ts --apply`

---

## 8. Files added (test only)

| File | Purpose |
|------|---------|
| `src/lib/mctb/direct-telnyx-test/config.ts` | Feature flag + test E164 allowlist |
| `src/lib/mctb/direct-telnyx-test/signaling-log.ts` | Structured signaling instrumentation |
| `src/lib/mctb/direct-telnyx-test/handler.ts` | Answer / hold / hangup handler |
| `src/lib/mctb/direct-telnyx-test/emit-event.ts` | Normalized event emission (no SMS default) |
| `src/lib/mctb/direct-telnyx-test/telnyx-fqdn-route.ts` | FQDN webhook + number assignment helpers |
| `src/app/api/telnyx/voice/mctb-direct-telnyx-test/route.ts` | Webhook route |
| `scripts/mctb-setup-direct-telnyx-test-800.ts` | Telnyx cutover for 855 |
| `scripts/mctb-rollback-direct-telnyx-test-800.ts` | Restore backup |
| `scripts/test-mctb-direct-telnyx-handler.ts` | Unit fixtures |
| `docs/MCTB-DIRECT-TELNYX-LIVE-TEST.md` | Manual PSTN procedure |
| `docs/MCTB-DIRECT-TELNYX-CERT-REPORT.md` | Certification template |

---

## 9. LiveKit required for MCTB?

**NOT YET PROVEN** — requires 5 consecutive successful forwarded PSTN calls on the direct path. See live test runbook.
