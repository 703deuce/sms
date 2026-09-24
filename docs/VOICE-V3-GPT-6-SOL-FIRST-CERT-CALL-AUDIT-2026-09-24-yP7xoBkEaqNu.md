# Voice V3 PSTN — first GPT-6 Sol cert call audit

**Date (UTC):** 2026-09-24  
**Call room suffix:** `yP7xoBkEaqNu`  
**Sources:** Production DB (`VoiceCall`, `VoiceAppointment`), `metadata.voiceV3Forensics`, web logs (`VOICE_V3_ASTRA_MODEL_RESOLVED`)

**Context:** First cert-line call after switching Coolify **`VOICE_V3_ASTRA_MODEL`** from **`gpt-6-luna`** to **`gpt-6-sol`** and recreating transovo-web (~04:19 UTC). Confirms delegated backend is **GPT-6 Sol**, not Luna or legacy GPT-5.6 Sol.

---

## Model verification (required)

| Check | Result |
|--------|--------|
| Coolify `.env` | `VOICE_V3_ASTRA_MODEL=gpt-6-sol` |
| Web process log | `VOICE_V3_ASTRA_MODEL_RESOLVED { model: 'gpt-6-sol', reasoning_effort: 'none', source: 'env' }` |
| Forensics bootstrap `backend_model` | **`gpt-6-sol`** |
| Luna (`gpt-6-luna`) on this call? | **No** |
| Legacy Sol (`gpt-5.6-sol`) on this call? | **No** |
| Live audio layer | **`gpt-live-1`** (voice **vesper**) — unchanged |

Bootstrap detail (Node, ~8 ms monotonic):

```json
{
  "room_name": "transovo-call-<caller_e164>_yP7xoBkEaqNu",
  "dialed_e164": "+15717491060",
  "backend_model": "gpt-6-sol",
  "live_voice_id": "vesper",
  "caller_present": true
}
```

---

## Call identity

| Field | Value |
|--------|--------|
| **When (UTC)** | **04:23:05** → **04:26:05** (~**3 min 0 s**) |
| **Dialed line** | **+15717491060** (cert / WS1) |
| **GPT-Live session** | `live_u0_ERVH8p3oMt0RUyjl6Z5FBSjO2eh0lvAU` |
| **DB status** | `COMPLETED` |
| **Outcome** | **`appointment_booked`** |
| **`appointmentBooked`** | **true** |
| **Callback** | **None** (`request_callback` not completed; no `callbackRequestId`) |

---

## What happened (story)

1. **Booking path** — Intake via multiple **`update_intake`** rounds (~43–131 s monotonic).
2. **Scheduling** — **`set_scheduling_preference`** succeeded twice (~51 s and ~55 s) — caller likely refined when they wanted the visit; then **`find_availability`** → **`available`** (~53 s and ~57 s).
3. **More intake** — Additional **`update_intake`** cycles (~92–131 s) before book.
4. **Book** — **`book_appointment`** → **`confirmed`** (~141 s and ~146 s in duplicate forensics mirrors).
5. **No premature-book guardrail event** on this trace — unlike some Luna pivot calls, Sol did not hit a logged `book_appointment` `not_ready` before success (intake may have been complete enough on first book attempt).

**Terminal truth:** Real Microsoft calendar write — not voice-only confirmation.

---

## Tool timeline (forensics monotonic ms — deduped)

| ~ms | Tool | Result |
|-----|------|--------|
| 43,259 | `update_intake` | `INTAKE_UPDATED` |
| 47,439 | `update_intake` | `INTAKE_UPDATED` |
| 51,189 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` |
| 53,073 | `find_availability` | **`available`** |
| 55,367 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` |
| 57,249 | `find_availability` | **`available`** |
| 91,553 – 131,303 | `update_intake` | `INTAKE_UPDATED` (several rounds) |
| 141,812 | `book_appointment` | **`confirmed`** |

---

## Appointment (authoritative)

| Field | Value |
|--------|--------|
| **`voice_appointments.id`** | **`cmuf13r78536b0b1g4i2t5f30`** |
| **Status** | **`confirmed`** |
| **Service** | Service Visit |
| **Slot (stored UTC)** | **2026-09-24T14:00:00.000Z** (display in workspace timezone on calendar UI) |
| **Provider** | Microsoft Graph (`externalId` prefix `microsoft:`) |

---

## Same-night backend comparison (cert line)

| Call suffix | ~UTC | `backend_model` | Outcome |
|-------------|------|-----------------|--------|
| `jU5s6hKcGXo4` | 03:08 | `gpt-6-luna` | `appointment_booked` |
| `GhcuVC5EZbrq` | 03:56 | `gpt-6-luna` | `callback_requested` |
| `jpbrfMBzQd86` | 04:08 | `gpt-6-luna` | `appointment_booked` (callback→book pivot) |
| **`yP7xoBkEaqNu`** | **04:23** | **`gpt-6-sol`** | **`appointment_booked`** |

---

## Ops reference

- Delegated model config: `docs/VOICE-V3-DELEGATED-BACKEND-MODEL.md`
- Code default (after merge PR #492): `gpt-6-sol` in `src/lib/voice-v3/intake/delegation-config.ts`
