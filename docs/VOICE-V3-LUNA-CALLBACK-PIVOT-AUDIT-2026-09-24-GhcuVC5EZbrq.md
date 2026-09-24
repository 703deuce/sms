# Voice V3 PSTN — Luna callback pivot audit (latest cert call)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `GhcuVC5EZbrq`  
**Sources:** Production DB (`VoiceCall`, `CallbackRequest`), `metadata.voiceV3Forensics`, web container logs (`VOICE_V3_ASTRA_MODEL_RESOLVED`)

**Context:** First cert-line call after setting **`VOICE_V3_ASTRA_MODEL=gpt-6-luna`** on Coolify transovo-web and recreating the container (~03:49 UTC). Caller repeated the **book → switch to callback** curveball (same intent as `KydsC6xPmGur` on Sol).

---

## Call identity

| Field | Value |
|--------|--------|
| **Live session / `VoiceCall` id** | `lk_transovo-call-<caller_e164>_GhcuVC5EZbrq` (suffix **`GhcuVC5EZbrq`**) |
| **When (UTC)** | **2026-09-24 03:56:47** → **03:58:55** (~**2 min 8 s**) |
| **Dialed line** | **+15717491060** (cert / WS1) |
| **Workspace / agent** | `ws_1` / **After-Hours Voice Agent UI CERT TEST 2304** (`cmshz2lc25c622c4i58303501`) |
| **Realtime voice** | **gpt-live-1** (voice **vesper**) |
| **DB status** | `COMPLETED` |
| **Outcome** | **`callback_requested`** |
| **`appointmentBooked`** | **false** |
| **GPT-Live session** | `live_u2_ERUrgp3oMqp49aYgdxvGrjIgFDfRvZXC` (from `metadata.voiceV3`) |

---

## Luna — confirmed

Forensics **Node bootstrap** (`VOICE_V3_SESSION_BOOTSTRAP_START`, ~8 ms monotonic):

| Field | Value |
|--------|--------|
| **`backend_model`** | **`gpt-6-luna`** |
| **`dialed_e164`** | **+15717491060** |
| **`caller_present`** | **true** |
| **`live_voice_id`** | **vesper** |

Web container (post-recreate) logged once per process:

```text
VOICE_V3_ASTRA_MODEL_RESOLVED { model: 'gpt-6-luna', reasoning_effort: 'none', source: 'env' }
```

**Verdict:** Delegated tools on this call used **GPT-6 Luna**, not GPT-5.6 Sol.

---

## Story (caller intent vs runtime)

1. **Booking path started** — Toilet leak / service visit; scheduling preference set and availability checked.

2. **Tools on booking path:**
   - **`set_scheduling_preference`** → `SCHEDULING_PREFERENCE_SET`
   - **`find_availability`** → **`available`** (~680 ms Node-side)
   - **`book_appointment`** → **`not_ready`** / **`MISSING_REQUIRED_INFORMATION`** (twice, ~41–46 s) — expected guardrail while intake incomplete

3. **Intake continued** — **`update_intake`** → **`INTAKE_UPDATED`** (caller name **Anthony Johnson**, **toilet leak** in `customFieldsSnapshot` on callback metadata).

4. **Pivot to callback** — **`request_callback`** first returned **`needs_information`** (~70–74 s) while required fields were still catching up; after further **`update_intake`**, **`request_callback`** → **`callback_requested`** (~87–91 s).

5. **No book** — No successful `book_appointment`; no Microsoft calendar write on this call.

---

## Tool timeline (forensics monotonic ms from call start)

| ~ms | Tool | Result |
|-----|------|--------|
| 24,809 | `set_scheduling_preference` | OK — `SCHEDULING_PREFERENCE_SET` (~11 ms) |
| 30,126 | `find_availability` | **`available`** (~680 ms) |
| 41,425 | `book_appointment` | **`not_ready`** |
| 45,545 | `book_appointment` | **`not_ready`** — `MISSING_REQUIRED_INFORMATION` |
| 66,228 | `update_intake` | **`INTAKE_UPDATED`** |
| 69,997 | `request_callback` | **`needs_information`** |
| 70,349 | `update_intake` | **`INTAKE_UPDATED`** |
| 74,118 | `request_callback` | **`needs_information`** |
| 82,557 | `update_intake` | **`INTAKE_UPDATED`** |
| 86,677 | `update_intake` | **`INTAKE_UPDATED`** |
| 87,040 | `request_callback` | **`callback_requested`** |
| 91,161 | `request_callback` | **`callback_requested`** |

*(Duplicate event pairs in forensics are normal — Python + Node telemetry mirrors.)*

---

## Callback persistence (authoritative)

| Field | Value |
|--------|--------|
| **`callbackRequestId`** | **`cmuf04qyy5q2a3p3l3l6d0255`** |
| **Reason** | **toilet leak** |
| **Status** | **`new`** |
| **Source** | Voice V3 (`metadata.source`: `VOICE_V3`) |
| **Caller name (metadata)** | Anthony Johnson |
| **`service_reason` (intake snapshot)** | toilet leak |

On `VoiceCall.metadata.voiceV3`:

```json
{
  "callbackReason": "toilet leak",
  "callbackRequestId": "cmuf04qyy5q2a3p3l3l6d0255"
}
```

---

## Phone number — why the agent did not ask

**Expected behavior:** When **trusted inbound caller ID (ANI)** is present, `request_callback` should use **`callback_phone: null`** and **not** ask for another number unless the caller wants a **different** callback number.

Tool contract (`src/lib/voice-v3/tools/request-callback-tool.ts`):

> Use null when trusted inbound caller ID (ANI) or an already-stored shared phone satisfies callback phone per configured policy — do not ask for another number unnecessarily in that case.

On this call:

- **`callback_requests.callerE164`** matches **`inboundAni`** in callback metadata (PSTN caller ID).
- The agent verbally confirming **the number you called from** is correct — that is the number stored for the return call.

Early **`needs_information`** on `request_callback` was about **intake/reason readiness**, not missing phone when ANI was already trusted.

---

## Comparison (same night, cert line)

| Call suffix | ~UTC | Backend | Outcome | Callback id |
|-------------|------|---------|---------|-------------|
| `jU5s6hKcGXo4` | 03:08 | **gpt-6-luna** | `appointment_booked` | — |
| `KydsC6xPmGur` | 03:39 | **gpt-5.6-sol** (env default) | `callback_requested` | `cmueziy641q6f6f5528125n4s` |
| **`GhcuVC5EZbrq`** | **03:56** | **`gpt-6-luna`** | **`callback_requested`** | **`cmuf04qyy5q2a3p3l3l6d0255`** |

---

## Ops notes

- **Luna env:** `VOICE_V3_ASTRA_MODEL=gpt-6-luna` in Coolify app `ds8s3hjin60qs6g7s0iqkixs` `.env`; web container recreated ~03:49 UTC.
- **Call history job:** `voice_v3_call_history` BullMQ enqueue failed (Upstash rate limit) for this call id — forensics on **`VoiceCall`** remain authoritative.

---

## Related docs

- Sol callback pivot (earlier same night): `docs/VOICE-V3-CALLBACK-PIVOT-AUDIT-2026-09-24-KydsC6xPmGur.md`
- Luna vs Sol vs Astra comparison: `docs/VOICE-V3-LUNA-VS-SOL-VS-ASTRA-CALL-COMPARISON-2026-09-24.md`
- Sep 21 callback forensics template: `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-CALLBACK-2026-09-21.md`
