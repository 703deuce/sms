# Voice V3 PSTN — GPT-6 Sol cert call audit (latest)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `pDQQujL2nKtj`  
**Sources:** Production DB (`VoiceCall`, `VoiceAppointment`), full `metadata.voiceV3Forensics` export, web container env/logs

**Context:** Cert-line call after **`VOICE_V3_ASTRA_MODEL=gpt-6-sol`** was re-applied and the transovo-web container was recreated (~04:30 UTC). This is the **latest** production call as of audit time (~04:36 UTC).

---

## Model verification

| Check | Result |
|--------|--------|
| **`backend_model` (forensics bootstrap)** | **`gpt-6-sol`** |
| **`dialed_e164`** | **+15717491060** |
| **`caller_present`** | **true** |
| **`live_voice_id`** | **vesper** |
| **Realtime / live layer** | **`gpt-live-1`** (delegation is separate) |
| **Luna (`gpt-6-luna`)** | **Not used** |
| **Legacy (`gpt-5.6-sol`)** | **Not used** |

Bootstrap detail (Node):

```json
{
  "room_name": "transovo-call-<caller_e164>_pDQQujL2nKtj",
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
| **`VoiceCall` id** | `lk_transovo-call-<caller_e164>_pDQQujL2nKtj` |
| **Started (UTC)** | **2026-09-24T04:33:11.556Z** |
| **Ended (UTC)** | **2026-09-24T04:36:00.758Z** |
| **Wall duration** | **~2 min 49 s** (~169 s) |
| **Workspace** | `ws_1` |
| **Agent** | After-Hours Voice Agent UI CERT TEST 2304 (`cmshz2lc25c622c4i58303501`) |
| **Transport** | `voice_v3_livekit_gpt_live` |
| **GPT-Live session id** | `live_u0_ERVQup3oNQ7o6iL1beDfXRpVz9QCmr1Q` |
| **DB status** | `COMPLETED` |
| **Outcome** | **`appointment_booked`** |
| **`appointmentBooked`** | **true** |
| **Callback** | **None** (no `callbackRequestId`; `callbackRow` null) |

### `metadata.voiceV3` (persisted)

```json
{
  "callId": "lk_transovo-call-<caller_e164>_pDQQujL2nKtj",
  "roomName": "transovo-call-<caller_e164>_pDQQujL2nKtj",
  "transport": "voice_v3_livekit_gpt_live",
  "liveKitJobId": null,
  "liveSessionId": "lk_transovo-call-<caller_e164>_pDQQujL2nKtj",
  "gptLiveSessionId": "live_u0_ERVQup3oNQ7o6iL1beDfXRpVz9QCmr1Q",
  "sipParticipantIdentity": "sip_<redacted>"
}
```

---

## Story (what happened)

1. **Intake** — Multiple **`update_intake`** rounds through ~90 s monotonic (~57–90 s).
2. **Scheduling** — **`set_scheduling_preference`** → **`SCHEDULING_PREFERENCE_SET`** (~89 s); **`find_availability`** → **`available`** (~91 s, ~694 ms).
3. **Preference refinement** — Second **`set_scheduling_preference`** (~93 s) and second **`find_availability`** (~96 s, ~707 ms).
4. **Early book (guardrail)** — **`book_appointment`** → **`not_ready`** (~106 s and ~111 s, **`MISSING_REQUIRED_INFORMATION`** on the second attempt).
5. **Intake completion** — More **`update_intake`** (~123 s and ~127 s).
6. **Successful book** — **`book_appointment`** → **`confirmed`** (~128 s and ~132 s; Node elapsed ~1.4 s on book).
7. **Terminal outcome** — Real Microsoft calendar appointment; not a verbal-only confirmation.

---

## Full tool timeline (forensics monotonic ms, deduped)

| ~ms | Tool | Status / code | Elapsed (ms) | OK |
|-----|------|---------------|--------------|-----|
| 56,623 | `update_intake` | `INTAKE_UPDATED` | 7 | yes |
| 60,849 | `update_intake` | `INTAKE_UPDATED` | 18 | yes |
| 85,918 | `update_intake` | `INTAKE_UPDATED` | 5 | yes |
| 89,212 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 6 | yes |
| 90,145 | `update_intake` | `INTAKE_UPDATED` | 20 | yes |
| 91,416 | `find_availability` | **`available`** | 694 | yes |
| 93,442 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 42 | yes |
| 95,643 | `find_availability` | **`available`** | 707 | yes |
| 106,363 | `book_appointment` | **`not_ready`** | 6 | no |
| 110,588 | `book_appointment` | **`not_ready`** / `MISSING_REQUIRED_INFORMATION` | 27 | no |
| 122,938 | `update_intake` | `INTAKE_UPDATED` | 13 | yes |
| 127,165 | `update_intake` | `INTAKE_UPDATED` | 30 | yes |
| 127,685 | `book_appointment` | **`confirmed`** | 1,398 | yes |
| 131,914 | `book_appointment` | **`confirmed`** | 1,411 | yes |

**Tools not observed on this call:** `request_callback`, `transfer_call`, `cancel_appointment`, `reschedule_appointment`, `find_appointment`, `end_call` (no completed forensics entries).

*(Duplicate mirror events from Python + Node telemetry are omitted.)*

---

## Appointment (authoritative)

| Field | Value |
|--------|--------|
| **`voice_appointments.id`** | **`cmuf1gfzu5s3z6i27403s0r1t`** |
| **Status** | **`confirmed`** |
| **Service** | Service Visit |
| **Starts (UTC)** | **2026-09-24T15:00:00.000Z** |
| **Microsoft `externalId`** | Present (`microsoft:…`) — external calendar write |

---

## Comparison — prior Sol cert call (same night)

| | **`yP7xoBkEaqNu`** (~04:23) | **`pDQQujL2nKtj`** (this call) |
|--|---------------------------|--------------------------------|
| **Backend** | `gpt-6-sol` | `gpt-6-sol` |
| **Duration** | ~3 min | ~2 min 49 s |
| **Outcome** | `appointment_booked` | `appointment_booked` |
| **Early `book` `not_ready`** | Not logged | **Yes** (guardrail) |
| **Appointment id** | `cmuf13r78536b0b1g4i2t5f30` | `cmuf1gfzu5s3z6i27403s0r1t` |
| **Slot (UTC)** | 14:00 same day | 15:00 same day |

---

## Ops / related docs

- Delegated model: `docs/VOICE-V3-DELEGATED-BACKEND-MODEL.md`
- First Sol cert write-up: `docs/VOICE-V3-GPT-6-SOL-FIRST-CERT-CALL-AUDIT-2026-09-24-yP7xoBkEaqNu.md`
- Luna cert series: `docs/VOICE-V3-LUNA-CERT-BIDIRECTIONAL-INTENT-SWITCH-CONCLUSIONS-2026-09-24.md`

---

## Re-inspect (production)

```bash
ssh coolify-server
CID=$(docker ps -q -f name=ds8s3hjin | head -1)
docker exec "$CID" sh -c 'cd /app && NODE_OPTIONS="--import ./scripts/preload-server-only.mjs" npx tsx scripts/audit-forensics.ts pDQQujL2nKtj'
```
