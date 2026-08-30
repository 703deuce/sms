# MCTB TeXML Ingress Architecture

**Status:** Implemented — TeXML-first MCTB on shared DID pattern  
**Production test DID:** `+18663464256` (`cmsc3numa1j17084g391t2z5l`)  
**Switch script:** `scripts/switch-866-amy-to-mctb-texml.ts`  
**Cert gate:** `scripts/mctb-texml-ingress-cert.ts`

---

## 1. Old MCTB ingress (deprecated for forwarded-call reliability)

```
Carrier CFNA → Telnyx DID
    → LiveKit SIP FQDN / Call Control (mctb-event-only)
    → Transovo answers + gather via Call Control API
    → consent + MCTB SMS pipeline
```

**Problems on conditional forward:** slow first audio, wrong connection stealing (LiveKit FQDN), voicemail intercept, split routing with AI.

---

## 2. Proven AI ingress (Amy — reference)

```
Carrier CFNA → Telnyx DID
    → TeXML Application
    → Telnyx AI Assistant (/v2/ai/assistants/{id}/call)
    → Transovo parallel webhooks only (texml-status, tools, dynamic-variables)
```

**Key:** Telnyx owns first audio. Transovo never blocks before answer.

---

## 3. New MCTB ingress (this work)

```
Carrier CFNA → Telnyx DID
    → TeXML Application (voice_url = /api/telnyx/voice/mctb-entry)
    → FAST deterministic branch (cached DID config)
        ├── press_1 → <Gather> → /api/telnyx/voice/mctb-consent
        └── existing_consent → brief Say + Hangup → texml-status async capture
    → existing MCTB SMS pipeline (recordSmsConsent → processMissedInboundCall)
```

**No LiveKit. No SIP FQDN. No Call Control before first audio. No AI assistant on MCTB DIDs.**

---

## 4. Routing decision (trusted config, not LLM)

Resolved in `resolveMctbTexmlIngressConfig(toE164)` (60s cache):

| Input | Source |
|-------|--------|
| Workspace | `phone_numbers.workspaceId` |
| Consent mode | `workspace.customFieldsConfig.mctb.consentMode` |
| Product | `settingsJson.capabilities.mctbEnabled` |
| Routing mode | `settingsJson.telephony.routingMode === mctb_texml` |

Branch at ingress:

| Mode | TeXML returned |
|------|----------------|
| `press_1` | `<Gather numDigits="1">` + Say prompt |
| `existing_consent` | `<Say>Thank you</Say><Hangup/>` + async capture on status callback |

---

## 5. Endpoints

| Endpoint | Role |
|----------|------|
| `POST /api/telnyx/voice/mctb-entry` | TeXML `voice_url` — first hop, returns XML immediately |
| `POST /api/telnyx/voice/mctb-consent` | Gather callback — DTMF `1`, consent, SMS enqueue |
| `POST /api/telnyx/voice/texml-status` | Call progress; MCTB legs skip AI `VoiceCall` enrollment |

---

## 6. Certification modes (`MCTB_TEXML_CERT_MODE`)

| Mode | Behavior |
|------|----------|
| **A** | Say + Pause + Hangup (no Gather, no SMS) |
| **B** | Gather + press 1 + "Thank you" (no SMS backend) |
| **C** | Gather + consent + enqueue SMS (production pipeline) |
| **D** | Full production (default) |

Run real PSTN conditional-forward tests for each mode before declaring pass.

---

## 7. Observability trace events

`source: mctb-texml-ingress` with `trace`:

- `MCTB_INGRESS`
- `MCTB_TEXML_RETURNED`
- `MCTB_GATHER_STARTED`
- `MCTB_DTMF_RECEIVED`
- `MCTB_CONSENT_RECORDED`
- `MCTB_SMS_QUEUED`
- `MCTB_SMS_ACCEPTED`
- `MCTB_CALL_COMPLETED`
- `MCTB_ROUTING_FAIL`

---

## 8. Caller ID / consent identity

Path `texml_mctb_ingress` trusts preserved PSTN ANI (`From`) when it does not match the Transovo ingress DID. **Does not require** `ForwardedFrom` / Diversion headers (carrier CFNA is often invisible).

---

## 9. Rollback (restore Amy on 866)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/restore-amy-866-texml.ts
```

Re-assigns Amy via `restoreTexmlInboundRoute` + `publishVoiceAgent`. Does not delete MCTB code.

---

## 10. Test results

| Test | Status | Notes |
|------|--------|-------|
| A — Say/Pause/Hangup | Pending PSTN | Set `MCTB_TEXML_CERT_MODE=A` |
| B — Gather no SMS | Pending PSTN | Set `MCTB_TEXML_CERT_MODE=B` |
| C — Consent + SMS enqueue | Pending PSTN | Set `MCTB_TEXML_CERT_MODE=C` |
| D — Full production | Pending PSTN | Default |

_Update this table after real conditional-forward calls._

---

## 11. Files

| Area | Path |
|------|------|
| Ingress route | `src/app/api/telnyx/voice/mctb-entry/route.ts` |
| Consent callback | `src/app/api/telnyx/voice/mctb-consent/route.ts` |
| TeXML builders | `src/lib/mctb/consent-prompt/texml-response.ts` |
| Provision / switch | `src/lib/mctb/texml-ingress/provision.ts` |
| Telnyx route | `src/lib/mctb/texml-ingress/texml-route.ts` |
| Config cache | `src/lib/mctb/texml-ingress/config-cache.ts` |
