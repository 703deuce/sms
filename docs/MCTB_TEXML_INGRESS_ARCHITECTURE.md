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

## 6. Certification modes (`?cert=` on Telnyx voice_url)

**No env vars or redeploy needed** after this code is live. Patch Telnyx only:

```bash
npx tsx scripts/set-866-mctb-cert-mode.ts A   # Say "Test successful."
npx tsx scripts/set-866-mctb-cert-mode.ts B   # Gather + press 1, no SMS
npx tsx scripts/set-866-mctb-cert-mode.ts C   # Gather + consent + enqueue SMS
npx tsx scripts/set-866-mctb-cert-mode.ts D   # Full production (default)
```

| Mode | Behavior |
|------|----------|
| **A** | Say + Pause + Hangup (no Gather, no SMS) |
| **B** | Gather + Say + press 1 + thank you (no SMS) |
| **B2** | `<Play>` production consent audio only + Pause + Hangup (media cert) |
| **B3** | Gather + `<Play>` + press 1 + thank you (no SMS) |
| **C** | Gather + consent + enqueue SMS (production pipeline) |
| **D** | Full production (default when no `?cert=`) |

```bash
npx tsx scripts/set-866-mctb-cert-mode.ts B2   # Play-only media cert
npx tsx scripts/validate-mctb-consent-audio-url.ts
npx tsx scripts/test-mctb-texml-b2-play-route.ts
```

Run real PSTN conditional-forward tests for each mode before declaring pass.

---

## 6b. Route drift prevention (866)

**Why 866 kept switching routes:** Several code paths independently reprovision Telnyx to the LiveKit FQDN (`telnyxFqdnConnectionId`) and set `telephony.routingMode = livekit_sip`:

- Agent publish / assign (`ensureNumberProvisioned` in `agent-service.ts`)
- LiveKit readiness repair (`/api/voice/livekit/readiness`)
- Ops scripts (`setup-ws1-ai-after-hours-callable.ts`, `switch-ws1-ai-after-hours-to-866.ts`)
- `syncVoiceAgentPhoneAssignment` enabling `aiAfterHoursEnabled` on the DID

When `aiAfterHoursEnabled` is true, smart routing can steal the call to Sarah/voicemail even if MCTB TeXML was configured moments earlier.

**Lock strategy:**

1. DB: `telephony.routingMode = mctb_texml`, `routingOwner = mctb_texml`, `aiAfterHoursEnabled = false`
2. Code guards: `isMctbTexmlIngressLocked()` blocks LiveKit reprovision/repair/publish steals
3. Telnyx: DID `connection_id` must stay on MCTB TeXML app `3037587396909598261`
4. One-shot cleanup: `scripts/decommission-866-competing-routes.ts` (clears agent joins + repoints Telnyx + cert mode)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/decommission-866-competing-routes.ts C
```

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

### 2026-08-30 — First conditional-forward test (application error)

**Symptom:** Caller heard Telnyx *"We're sorry, an application error has occurred. Goodbye."* after ~1 ring.

| Field | Value |
|-------|-------|
| **Root cause** | TeXML `voice_url` pointed at `POST /api/telnyx/voice/mctb-entry`, but that route is **not deployed to production** (404 Next.js HTML page). |
| **Failed request** | `POST /api/telnyx/voice/mctb-entry` (Telnyx TeXML app `3037587396909598261`) |
| **HTTP status** | `404` |
| **Content-Type** | `text/html; charset=utf-8` |
| **Returned body** | Next.js HTML 404 page (`<!DOCTYPE html>…`) — not TeXML |
| **CallSid** | `v3:88eBN6WgHyUdseQI_QczBp1j_v_ahSV16CUee0zIo5dSevyuhqnl5A` |
| **VoiceCall id** | `cmtf5fw8t6a141y3a52243o3c` |
| **From / To** | PSTN caller → `+18663464256` |
| **ConnectionId** | `3037587396909598261` |
| **Workspace** | `ws_1` (`existing_consent` mode) |
| **routingMode** | `mctb_texml` (DB) |
| **Telnyx termination** | `texml.call.hangup` — `HangupCause: normal_clearing`, 4s duration |
| **mctb-entry server log** | None — route does not exist in prod build |

**Interim hotfix (no carrier change):** `scripts/hotfix-866-mctb-texml-voice-url.ts` repointed TeXML `voice_url` to `mctb-consent?prompt=say-only` (returns valid XML on prod today). **Permanent fix:** deploy PR #304 so `mctb-entry` exists, then repoint with preflight gate.

| Test | Status | Notes |
|------|--------|-------|
| A — Say/Pause/Hangup | **PASS (PSTN)** | `mctb-entry` on prod — caller heard "Test successful." on conditional forward (~02:05 UTC) |
| B — Gather Say no SMS | **PASS (PSTN)** | Real AT&T CFNA → Say → Gather → DTMF 1 → Say → Hangup |
| B2 — Play only | **PASS (PSTN)** | Prerecorded consent audio ~6.5s + hangup (no press 1 by design) |
| B3 — Gather Play no SMS | Pending PSTN | After B2 passes |
| C — Consent + SMS enqueue | **READY** | `set-866-mctb-cert-mode.ts C` applied — awaiting PSTN press-1 + SMS |
| D — Full production | Pending PSTN | `set-866-mctb-cert-mode.ts D` |

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
