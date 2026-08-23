# Smart Routing — Forwarding Metadata Audit

**Date:** 2026-08-23  
**Scope:** Production ingress paths that populate `forwardedFrom` for employee-vs-customer access detection (`access-detection.ts`).

## Decision rule (implemented — dual-number architecture)

```
called Routing Number → inbound Smart Routing (always)
called Callback Number → employee Business Callback (authorized + PIN)
```

Forwarding metadata (`forwardedFrom`, Diversion) is still parsed for **caller preservation** and analytics, but **does not** choose between inbound routing and employee callback.

Legacy single-DID rule (removed):

```
if forwardedFrom present → customer
if no forwardedFrom + authorized ANI → employee callback  ❌ removed
```

---

## Ingress path for Smart Routing (Telnyx Call Control)

Smart Routing inbound on a workspace routing number is handled synchronously on `call.initiated`:

| Step | Location | Field |
|------|----------|-------|
| 1. Telnyx webhook | `POST` voice webhook → `handleTelnyxVoiceWebhook` | `body.data.payload` |
| 2. Parse forward metadata | `parseTelnyxForwardedFrom(eventPayload)` | see below |
| 3. Employee check | `shouldStartEmployeeAccess({ forwardedFrom, callerE164 })` | `access-detection.ts` |
| 4. Customer routing | `tryStartSmartRoutingInbound({ forwardedFrom })` | `webhook-handler.ts` |
| 5. Session storage | `forwardedFromNumber` on `SmartRoutingCallSession` | `session-store.ts` |

**File:** `src/lib/voice/telnyx/webhook-handlers.ts` (lines ~334–387)

Smart Routing does **not** use the LiveKit SIP attribute scanner on this path. It uses Call Control `call.initiated` payload only.

---

## Normalization: `parseTelnyxForwardedFrom`

**File:** `src/lib/voice/telnyx/forwarded-from.ts`

### Priority order

1. **Top-level `forwarded_from` or `ForwardedFrom`** on the Telnyx `call.initiated` payload  
   - Normalized to E.164 via `normalizeForwardedFromE164`  
   - Handles values like `sip:+15405551234@one.att.net` (TeXML / some carriers)

2. **`sip_headers[]` entry where `name` === `diversion` (case-insensitive)**  
   - Parses SIP URI / tel URI from header value  
   - Documented AT&T pattern:  
     `<sip:+15405551234@one.att.net;user=phone>;privacy="off";reason=no-answer;counter=1`

3. If neither yields a number → `undefined` (treated as **direct dial**, not forwarded)

### Unit test coverage (synthetic payloads)

**File:** `scripts/test-telnyx-forwarded-from.ts`

- `forwarded_from: "+15405551234"`
- `ForwardedFrom: "sip:+15405551234@one.att.net"`
- `sip_headers: [{ name: "Diversion", value: "<sip:+1...@one.att.net;...>" }]`

These are **not** production captures; they validate the parser only.

---

## Carrier signaling (expected Telnyx fields)

| Carrier | Typical signaling on forward to Transovo routing DID | Populated by Smart Routing parser? |
|---------|------------------------------------------------------|-------------------------------------|
| **AT&T** | Often `Diversion` in `sip_headers`; sometimes `ForwardedFrom` SIP URI | Yes — Diversion header path |
| **Verizon** | Often `*72` unconditional forward; may send `forwarded_from` on Call Control | Yes — if Telnyx maps to `forwarded_from` |
| **T-Mobile** | Similar to Verizon; carrier-dependent | Yes — if Telnyx maps to `forwarded_from` |
| **Spectrum / Comcast** | Variable; may use diversion or forwarded-from | Yes — whichever Telnyx exposes on payload |
| **Direct dial** (employee) | No forward metadata | `undefined` → employee path eligible |

**Note:** Transovo does not receive raw carrier SIP directly. Telnyx Call Control normalizes into `eventPayload`. Production truth is whatever Telnyx places in `forwarded_from`, `ForwardedFrom`, or `sip_headers[].Diversion`.

---

## Related paths (NOT used for Smart Routing employee detection)

These paths have **richer** forward extraction but are **separate** from Smart Routing access detection:

| Path | Extra fields scanned | Used for SR employee check? |
|------|----------------------|----------------------------|
| MCTB event-only normalize | Same `parseTelnyxForwardedFrom` + diversion summary | No |
| MCTB SIP / LiveKit | SIP participant attrs: diversion, forward, history-info | No |
| Python `sip_forwarded_from.py` | Same pattern for LiveKit worker | No |
| Twilio ingress | `ForwardedFrom` query param / Twilio field | Twilio inbound only; employee access is Telnyx-only V1 |

---

## Raw → normalized field map

| Production concept | Raw Telnyx / provider fields | Normalized field | Stored on session |
|--------------------|------------------------------|------------------|-----------------|
| Original caller (ANI) | `payload.from` | E.164 string | `callerNumber` |
| Routing DID (called) | `payload.to` | E.164 string | `calledNumber` |
| Forwarding source (business line) | `forwarded_from`, `ForwardedFrom`, or `sip_headers[Diversion]` | `forwardedFrom` E.164 | `forwardedFromNumber` |
| Call control ID | `call_control_id` | string | `callControlId` |

---

## Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Carrier forward missing forward metadata | **Medium** — ANI preservation only | Live PSTN Test 1 |
| Employee ANI on forwarded leg mistaken for callback | **Eliminated** — separate Callback Number | Dual-number architecture |
| Test-only synthetic `forwardedFrom` in unit tests | **Low** | Production uses webhook payload only |

**No code change recommended** for ingress discrimination until live PSTN confirms caller preservation. Employee vs customer path no longer depends on `forwardedFrom`.

---

## Verification checklist (manual PSTN)

1. Forward business number → routing DID; call business number from third phone.  
   - Expect: customer menu, `forwardedFromNumber` = business line, ANI = third phone.  
2. Call routing DID directly from authorized employee phone (no forward).  
   - Expect: PIN flow, no `forwardedFromNumber`.  
3. Edge case: employee calls business number (forwarded).  
   - Expect: customer menu even if ANI matches authorized caller.

Query support data: `smart_routing_call_sessions.forwarded_from_number` and `provider_webhook_events` payload for the call.
