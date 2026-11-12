# Voice V3 PSTN — Luna audit (callback → book pivot)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `jpbrfMBzQd86`  
**Sources:** Production DB (`VoiceCall`, `VoiceAppointment`), `metadata.voiceV3Forensics`

**Context:** Cert-line test **opposite direction** from prior calls: caller **started toward a callback**, then **switched to booking** and completed an appointment. Prior same-night audits: book → callback on `GhcuVC5EZbrq` / `KydsC6xPmGur`.

---

## Call identity

| Field | Value |
|--------|--------|
| **Live session / `VoiceCall` id** | `lk_transovo-call-<caller_e164>_jpbrfMBzQd86` (suffix **`jpbrfMBzQd86`**) |
| **When (UTC)** | **2026-09-24 04:08:16** → **04:10:50** (~**2 min 34 s**) |
| **Dialed line** | **+15717491060** (cert / WS1) |
| **Workspace / agent** | `ws_1` / **After-Hours Voice Agent UI CERT TEST 2304** (`cmshz2lc25c622c4i58303501`) |
| **Realtime voice** | **gpt-live-1** (voice **vesper**) |
| **GPT-Live session** | `live_u1_ERV2mp3oMZ330neK0bqQNyxbT3jWNoDw` |
| **DB status** | `COMPLETED` |
| **Outcome** | **`appointment_booked`** |
| **`appointmentBooked`** | **true** |

---

## Luna or Sol?

**Luna** — delegated backend on this call was **`gpt-6-luna`**, not Sol.

Forensics bootstrap (`VOICE_V3_SESSION_BOOTSTRAP_START`, Node detail):

| Field | Value |
|--------|--------|
| **`backend_model`** | **`gpt-6-luna`** |
| **`dialed_e164`** | **+15717491060** |
| **`caller_present`** | **true** |

Production web container still has **`VOICE_V3_ASTRA_MODEL=gpt-6-luna`** in Coolify `.env` and running env (unchanged since ~03:49 UTC recreate).

---

## What happened (story)

1. **Callback path first** — Early **`update_intake`** rounds ran while the agent collected context. **`request_callback`** was invoked **twice** and returned **`needs_information`** (~27 s and ~31 s monotonic) — callback was **not** persisted (no `callbackRequestId` on `VoiceCall.metadata.voiceV3`, no `callback_requests` row for this call).

2. **Pivot to booking** — Caller moved to scheduling. **`set_scheduling_preference`** failed **twice** with tool status **`error`** / code **`INVALID_ARGUMENTS`** (~55 s and ~59 s) — model sent arguments the scheduler rejected; then **succeeded** (~69 s and ~73 s) with **`SCHEDULING_PREFERENCE_SET`**.

3. **Availability** — **`find_availability`** → **`available`** (~75 s and ~79 s).

4. **Guarded book** — **`book_appointment`** → **`not_ready`** / **`MISSING_REQUIRED_INFORMATION`** (~87 s and ~91 s) while intake was still incomplete.

5. **Finish intake + book** — **`update_intake`** → **`INTAKE_UPDATED`** (~114 s), then **`book_appointment`** → **`confirmed`** (~117 s and ~121 s in duplicate forensics mirrors).

6. **Result** — Real calendar write: Transovo appointment **`cmuf0k5zn01575p4w5o4t5o4v`**, status **`confirmed`**, Microsoft **`externalId`** present (not voice-only confirmation).

**No callback was left open** — the successful path was **book**, not callback.

---

## Tool timeline (forensics monotonic ms from call start)

| ~ms | Tool | Result |
|-----|------|--------|
| 22,094 | `update_intake` | `INTAKE_UPDATED` |
| 26,020 | `update_intake` | `INTAKE_UPDATED` |
| 26,810 | `request_callback` | **`needs_information`** |
| 30,739 | `request_callback` | **`needs_information`** |
| 51,388 | `update_intake` | `INTAKE_UPDATED` |
| 54,627 | `set_scheduling_preference` | **`error`** |
| 55,315 | `update_intake` | `INTAKE_UPDATED` |
| 58,557 | `set_scheduling_preference` | **`error`** — `INVALID_ARGUMENTS` |
| 69,397 | `set_scheduling_preference` | **`SCHEDULING_PREFERENCE_SET`** |
| 73,321 | `set_scheduling_preference` | **`SCHEDULING_PREFERENCE_SET`** |
| 75,002 | `find_availability` | **`available`** |
| 78,927 | `find_availability` | **`available`** |
| 87,269 | `book_appointment` | **`not_ready`** |
| 91,196 | `book_appointment` | **`not_ready`** — `MISSING_REQUIRED_INFORMATION` |
| 113,916 | `update_intake` | `INTAKE_UPDATED` |
| 117,158 | `book_appointment` | **`confirmed`** |
| 121,085 | `book_appointment` | **`confirmed`** |

*(Duplicate rows = Python + Node telemetry mirrors.)*

---

## Appointment (authoritative)

| Field | Value |
|--------|--------|
| **`voice_appointments.id`** | **`cmuf0k5zn01575p4w5o4t5o4v`** |
| **Status** | **`confirmed`** |
| **Service** | Service Visit |
| **Slot (stored UTC)** | **2026-09-25T13:00:00.000Z** (display in workspace timezone on manage/calendar UI) |
| **Provider** | Microsoft Graph (`externalId` prefix `microsoft:`) |

---

## Callback vs book comparison (same night, cert line)

| Direction | Suffix | ~UTC | Backend | Final outcome |
|-----------|--------|------|---------|----------------|
| Book → callback | `GhcuVC5EZbrq` | 03:56 | **Luna** | `callback_requested` |
| Book → callback | `KydsC6xPmGur` | 03:39 | Sol | `callback_requested` |
| **Callback → book** | **`jpbrfMBzQd86`** | **04:08** | **Luna** | **`appointment_booked`** |
| Book only | `jU5s6hKcGXo4` | 03:08 | Luna | `appointment_booked` |

---

## Takeaways

1. **Backend:** This call was **Luna** end-to-end for delegated tools (`backend_model: gpt-6-luna`).
2. **Pivot worked:** Callback attempts stayed in **`needs_information`** until the conversation moved to scheduling; **no stray callback record** was created when the caller chose to book instead.
3. **Rough edges:** Two **`set_scheduling_preference`** **`INVALID_ARGUMENTS`** errors before a valid preference — worth watching in Luna regression, but the call still **completed a real book**.
4. **Same guardrails as Sol/Luna book tests:** Early **`book_appointment` `not_ready`**, then intake catch-up, then **`confirmed`**.

---

## Related docs

- Book → callback (Luna): `docs/VOICE-V3-LUNA-CALLBACK-PIVOT-AUDIT-2026-09-24-GhcuVC5EZbrq.md`
- Luna vs Sol comparison: `docs/VOICE-V3-LUNA-VS-SOL-VS-ASTRA-CALL-COMPARISON-2026-09-24.md`
