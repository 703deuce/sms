# Voice V3 PSTN — last call forensics (callback curveball)

**Date (UTC):** 2026-09-21  
**Call room suffix:** `a32W4yyajhZc`  
**Sources:** Production DB (`VoiceCall`, `CallbackRequest`), voice worker logs, web logs

---

## Call at a glance

| Field | Value |
|--------|--------|
| **Live session / `VoiceCall` id** | `lk_transovo-call-<caller_e164>_a32W4yyajhZc` |
| **LiveKit job** | `AJ_sXKbu5vuSh7B` |
| **When (UTC)** | **12:37:53.763** → **12:40:47.799** (~**174 s** on DB record) |
| **Caller disconnect (worker)** | **12:40:23.095** |
| **Dialed line** | **+15717491060** (WS1 Cert Plumbing) |
| **Workspace / agent** | `ws_1` / `cmshz2lc25c622c4i58303501` |
| **Realtime voice** | **gpt-live-1**, voice **vesper** |
| **Backend delegated tools** | **gpt-5.6-sol** |
| **GPT-Live session** | `live_u1_EQXZLp3oNBfmwFDUgAugSummqgG6XadH` |
| **DB status** | `COMPLETED` |
| **Outcome** | **Callback requested — not booked** |
| **`appointmentBooked`** | **false** |
| **`transferred`** | **false** |

---

## Story (caller intent vs runtime)

1. **Booking path started** — Caller reported a **bathroom leak** and wanted an appointment **today** for someone to come look.

2. **Tools executed successfully** (no `VoiceV3CallForensics` / tool-hint failures on this call):
   - `update_intake` → **INTAKE_UPDATED**
   - `set_scheduling_preference` → **SCHEDULING_PREFERENCE_SET** (today)
   - **`find_availability`** → **`available`** (~**728 ms** Node; ~**745 ms** worker round-trip)

3. **Amy offered slots** — Earliest today **11:00** or **11:30**. Caller chose **11**.

4. **Early `book_appointment`** (~**62 s** monotonic from call start) → **`not_ready`** / **`MISSING_REQUIRED_INFORMATION`** (booking fields not complete yet — expected while still collecting intake).

5. **Curveball — switch to callback** — Caller asked to **get a callback instead of booking** (e.g. “Can I switch? Can I just get a callback?”).

6. **`request_callback` succeeded** (~**125 s** monotonic):
   - Tool status: **`callback_requested`**
   - Node elapsed: **~326 ms**; worker: **~338 ms**
   - Function call id: `call_euxdRUo7yT98I3x9BRQnt1Wr`

7. **Verbal close** — Amy confirmed a callback at **571-477-6175** for the bathroom leak; caller thanked her and ended the call.

**No successful `book_appointment`** on this call. **No Microsoft calendar book** completed.

---

## Tool timeline (forensics monotonic ms from call start)

| ~ms | Tool | Result |
|-----|------|--------|
| 35,936 | `update_intake` | OK |
| 39,860 | `set_scheduling_preference` | OK |
| 42,951 | `find_availability` | **available** (~728 ms) |
| 62,239 | `book_appointment` | **not_ready** (missing required information) |
| 75,399+ | `update_intake` | OK (continued intake) |
| 124,864 | **`request_callback`** | **`callback_requested`** (~326 ms) |

---

## Callback persistence (authoritative)

| Field | Value |
|--------|--------|
| **`callbackRequestId`** | **`cmub8g5g05g1v341t5y2f6b07`** |
| **Reason** | **Bathroom leak** |
| **Status** | **`new`** (not contacted at time of report) |
| **Source route** | `voice_v3_request_callback` |
| **Requested at** | **2026-09-21T12:39:58.734Z** |
| **Caller name (metadata)** | Anthony Johnson |
| **Business line (callback record)** | +15714073615 |

Stored on `VoiceCall.metadata.voiceV3`:

```json
{
  "callbackReason": "Bathroom leak",
  "callbackRequestId": "cmub8g5g05g1v341t5y2f6b07"
}
```

Web log sequence:

- `VOICE_V3_CALLBACK_REQUEST_STARTED`
- `VOICE_V3_CALLBACK_REQUEST_PERSISTED`
- `VOICE_V3_CALLBACK_TOOL_SUCCEEDED`

---

## Transcript summary (high level)

- Greeting; caller: bathroom leak, book today.
- Find today’s availability; offer **11:00** or **11:30**; caller picks **11**.
- Amy collects **Anthony Johnson**, **571-477-6175**, **123 Main Street, Alexandria, Virginia**.
- Caller pivots: **callback instead of booking**.
- Amy confirms callback requested for bathroom leak at that number; polite goodbye.

---

## UX note (conversation vs backend)

Transcript shows Amy still in **booking** wording for a short window after the pivot (e.g. confirming “11 works” and asking for address) while the caller was already asking for a **callback**. Backend behavior was still correct: find worked, premature book was rejected, and **`request_callback` persisted**. This is a **conversation-order / prompt** issue, not a tool transport failure.

---

## Caller turns

- **13** committed caller utterances (`voice_v3_caller_utterance_committed` in worker logs).
- Forensics: **13** `callerTurnTiming` rows.

---

## Infrastructure (same deploy as prior successful book call)

- Voice worker image: **`56bda9063dcef0c6eb6fda0246fa2bf2ca16f579`** (includes tools.py forensics fix + transcript timestamp fix).
- Worker container example: `tgjridm6vrmrgljkfrr0rpjn-113845871330`.

---

## Short checklist

| Question | Answer |
|----------|--------|
| Calendar / find work? | **Yes** — `find_availability` → available (~0.7 s) |
| Book 11 AM? | **No** — only failed early book; no confirmed book |
| Callback curveball work? | **Yes** — `cmub8g5g05g1v341t5y2f6b07`, reason bathroom leak |
| Call length | **~174 s** (DB); disconnect **~12:40:23** UTC |
| Backend model | **gpt-5.6-sol** (tools); **gpt-live-1** + **vesper** (voice) |

---

## Repro commands (read-only)

```bash
# Recent calls
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-last-voice-v3-call.ts

# Voice worker logs (replace container name if needed)
ssh coolify-server 'docker logs --since 30m tgjridm6vrmrgljkfrr0rpjn-113845871330 2>&1 | grep a32W4yyajhZc'

# Web logs
ssh coolify-server 'docker logs --since 30m ds8s3hjin60qs6g7s0iqkixs-<suffix> 2>&1 | grep -E "a32W4yyajhZc|CALLBACK|request_callback"'
```

---

*Generated from production forensics on 2026-09-21. Related earlier report: `docs/VOICE-V3-PSTN-CALL-FORENSICS-REPORT-2026-09-21.md` (tools fix + book call `YUoMbNMpscEF`).*
