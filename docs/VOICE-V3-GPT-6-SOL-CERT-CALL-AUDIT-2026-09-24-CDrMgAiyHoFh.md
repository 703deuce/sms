# Voice V3 PSTN — GPT-6 Sol cert call audit (latest)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `CDrMgAiyHoFh`  
**Sources:** Production DB (`VoiceCall`, `VoiceAppointment`), `metadata.voiceV3Forensics`, web logs

**Context:** Cert-line call after transovo-web recreate with **`VOICE_V3_ASTRA_MODEL=gpt-6-sol`** (~04:42 UTC). Latest production call at audit time (~04:47 UTC).

---

## Model verification

| Check | Result |
|--------|--------|
| Coolify / container env | `VOICE_V3_ASTRA_MODEL=gpt-6-sol` |
| Web log | `VOICE_V3_ASTRA_MODEL_RESOLVED { model: 'gpt-6-sol', reasoning_effort: 'none', source: 'env' }` |
| Forensics `backend_model` | **`gpt-6-sol`** |
| Live audio | **`gpt-live-1`** (voice **vesper**) |
| Luna / `gpt-5.6-sol` | **Not used** |

```json
{
  "room_name": "transovo-call-<caller_e164>_CDrMgAiyHoFh",
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
| **`VoiceCall` id** | `lk_transovo-call-<caller_e164>_CDrMgAiyHoFh` |
| **Started (UTC)** | **2026-09-24T04:44:56.079Z** |
| **Ended (UTC)** | **2026-09-24T04:47:31.150Z** |
| **Wall duration** | **~2 min 35 s** (~155 s) |
| **Dialed line** | **+15717491060** (cert / WS1) |
| **Agent** | After-Hours Voice Agent UI CERT TEST 2304 (`cmshz2lc25c622c4i58303501`) |
| **Transport** | `voice_v3_livekit_gpt_live` |
| **GPT-Live session** | `live_u2_ERVcHp3oMRIkZOx0RW0Q65YAD59HMC2u` |
| **Python bootstrap (UTC)** | 2026-09-24T04:44:50.162Z |
| **Status** | `COMPLETED` |
| **Outcome** | **`appointment_booked`** |
| **`appointmentBooked`** | **true** |
| **Callback** | **None** |

### `metadata.voiceV3`

```json
{
  "callId": "lk_transovo-call-<caller_e164>_CDrMgAiyHoFh",
  "roomName": "transovo-call-<caller_e164>_CDrMgAiyHoFh",
  "transport": "voice_v3_livekit_gpt_live",
  "liveKitJobId": null,
  "liveSessionId": "lk_transovo-call-<caller_e164>_CDrMgAiyHoFh",
  "gptLiveSessionId": "live_u2_ERVcHp3oMRIkZOx0RW0Q65YAD59HMC2u",
  "sipParticipantIdentity": "sip_<redacted>"
}
```

---

## Story

1. **`update_intake`** — intake updated (~67 s monotonic).
2. **`set_scheduling_preference`** → **`SCHEDULING_PREFERENCE_SET`** (~71 s).
3. **`update_intake`** again (~73 s).
4. **`find_availability`** → **`available`** (~73 s, ~902 ms).
5. Second **`set_scheduling_preference`** (~77 s) and **`find_availability`** (~79 s, ~919 ms).
6. **`book_appointment`** → **`not_ready`** (~83 s and ~89 s, **`MISSING_REQUIRED_INFORMATION`**).
7. **`update_intake`** (~113 s and ~119 s).
8. **`book_appointment`** → **`confirmed`** (~118 s and ~124 s, ~1.6 s book latency).
9. Real **Microsoft Graph** appointment persisted.

---

## Tool timeline (monotonic ms, deduped)

| ~ms | Tool | Result | Elapsed (ms) |
|-----|------|--------|--------------|
| 66,703 | `update_intake` | `INTAKE_UPDATED` | 18 |
| 70,857 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 6 |
| 72,772 | `update_intake` | `INTAKE_UPDATED` | 35 |
| 72,929 | `find_availability` | **`available`** | 902 |
| 76,923 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 18 |
| 78,997 | `find_availability` | **`available`** | 919 |
| 83,292 | `book_appointment` | **`not_ready`** | 11 |
| 89,358 | `book_appointment` | **`not_ready`** / `MISSING_REQUIRED_INFORMATION` | 18 |
| 113,183 | `update_intake` | `INTAKE_UPDATED` | 2 |
| 117,899 | `book_appointment` | **`confirmed`** | 1,598 |
| 119,250 | `update_intake` | `INTAKE_UPDATED` | 14 |
| 123,967 | `book_appointment` | **`confirmed`** | 1,610 |

**Not used:** `request_callback`, transfer, cancel/reschedule, `find_appointment`.

---

## Appointment

| Field | Value |
|--------|--------|
| **Id** | **`cmuf1vc26156f1l1c1c1f5d4v`** |
| **Status** | **`confirmed`** |
| **Service** | Service Visit |
| **Starts (UTC)** | **2026-09-24T17:00:00.000Z** |
| **`externalId`** | `microsoft:…` (Graph) |

---

## Same-night GPT-6 Sol calls (cert line)

| Suffix | ~UTC start | Duration | Early book `not_ready` | Appt id | Slot (UTC) |
|--------|------------|----------|------------------------|---------|------------|
| `yP7xoBkEaqNu` | 04:23 | ~3:00 | No | `cmuf13r78536b0b1g4i2t5f30` | 14:00 |
| `pDQQujL2nKtj` | 04:33 | ~2:49 | Yes | `cmuf1gfzu5s3z6i27403s0r1t` | 15:00 |
| **`CDrMgAiyHoFh`** | **04:44** | **~2:35** | **Yes** | **`cmuf1vc26156f1l1c1c1f5d4v`** | **17:00** |

---

## Related docs

- `docs/VOICE-V3-DELEGATED-BACKEND-MODEL.md`
- `docs/VOICE-V3-GPT-6-SOL-CERT-CALL-AUDIT-2026-09-24-pDQQujL2nKtj.md`
- `docs/VOICE-V3-GPT-6-SOL-FIRST-CERT-CALL-AUDIT-2026-09-24-yP7xoBkEaqNu.md`

---

## Re-inspect

```bash
ssh coolify-server
CID=$(docker ps -q -f name=ds8s3hjin | head -1)
docker exec "$CID" sh -c 'cd /app && NODE_OPTIONS="--import ./scripts/preload-server-only.mjs" npx tsx scripts/audit-forensics.ts CDrMgAiyHoFh'
```
