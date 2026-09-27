# Voice V3 PSTN — Luna “hard” cert call audit (book → callback)

**Date (UTC):** 2026-09-24  
**Call room suffix:** `bnmuJyyrJ8tV`  
**Sources:** Production DB (`VoiceCall`, `CallbackRequest`), `metadata.voiceV3Forensics`

**Context:** Stress / “super hard” cert test on **GPT-6 Luna** after **`VOICE_V3_ASTRA_MODEL=gpt-6-luna`** (~04:56 UTC container recreate). Booking path with scheduling + guarded book, then **pivot to callback** with richer intake (name, email, phone, service reason).

---

## Model verification

| Check | Result |
|--------|--------|
| Forensics `backend_model` | **`gpt-6-luna`** |
| **`gpt-6-sol` / `gpt-5.6-sol`** | **Not used** |
| Live audio | **`gpt-live-1`** (voice **vesper**) |
| Coolify env (at test time) | `VOICE_V3_ASTRA_MODEL=gpt-6-luna` |

```json
{
  "dialed_e164": "+15717491060",
  "backend_model": "gpt-6-luna",
  "live_voice_id": "vesper",
  "caller_present": true
}
```

---

## Call identity

| Field | Value |
|--------|--------|
| **`VoiceCall` id** | `lk_transovo-call-<caller_e164>_bnmuJyyrJ8tV` |
| **Started (UTC)** | **2026-09-24T04:56:53.824Z** |
| **Ended (UTC)** | **2026-09-24T05:00:06.052Z** |
| **Wall duration** | **~3 min 12 s** (~192 s) |
| **Cert line** | **+15717491060** |
| **Agent** | After-Hours Voice Agent UI CERT TEST 2304 (`cmshz2lc25c622c4i58303501`) |
| **GPT-Live session** | `live_u0_ERVnrp3oN0GBRYPvvnXBsYELFUUiEhF5` |
| **LiveKit job** | `AJ_pgZD2J4cAdbY` |
| **Transport** | `voice_v3_livekit_gpt_live` |
| **Outcome** | **`callback_requested`** |
| **`appointmentBooked`** | **false** |
| **Appointments** | **0** (no Graph book on this call) |

### `metadata.voiceV3`

```json
{
  "callbackReason": "Leaking toilet",
  "callbackRequestId": "cmuf2bcpz6w665o164m2l3q3j",
  "gptLiveSessionId": "live_u0_ERVnrp3oN0GBRYPvvnXBsYELFUUiEhF5",
  "liveSessionId": "lk_transovo-call-<caller_e164>_bnmuJyyrJ8tV"
}
```

---

## Story (what happened)

1. **Booking path started** — Intake and scheduling on Luna: **`update_intake`**, **`set_scheduling_preference`** (success, no `INVALID_ARGUMENTS` on this call), **`find_availability`** → **`available`** (~718 ms).
2. **Preference / slot refinement** — Second **`set_scheduling_preference`** and second **`find_availability`** (~733 ms).
3. **Guarded book** — **`book_appointment`** → **`not_ready`** twice (~74 s and ~78 s), including **`MISSING_REQUIRED_INFORMATION`** — runtime blocked premature book (expected).
4. **Long middle segment** — ~**64 s** between last failed book (~78 s) and next **`update_intake`** (~142 s) — conversation / hard-case intake (caller complexity, pivot, or extra fields).
5. **Intake completion** — **`update_intake`** at ~142 s and ~147 s; snapshot later includes **name**, **email**, **phone**, **service_reason**.
6. **Callback terminal** — **`request_callback`** → **`callback_requested`** (~148 s and ~153 s; ~343–390 ms Node-side on callback tool).
7. **No successful book** — Correct terminal for a **book → callback** hard test: callback persisted, no appointment row.

**Hard-case behaviors on this call (why it was “super duper hard”):**

- Booking path with **slot pick** (today, **4 PM**) and **two FIND** passes.
- **Pricing detour** (diagnostic $95, after-hours $140, labor $125/hr) mid-intake.
- **Email correction** (started 703…@gmail, pivoted to **anthony@yahoo.com**); runtime still asked for **mother’s name** (wizard/custom field) before user aborted booking.
- Explicit **intent switch**: “I just wanna call back actually” → **`request_callback`** with full snapshot (name, email, phone, reason).

---

## Conversation transcript (deduped from forensics)

Timestamps are **seconds from call start** (monotonic).

```
[013s] USER: Hello
[018s] ASSISTANT: Thank you for calling WS1 Cert Plumbing Co. This is Riley, how can I help you today?
[022s] USER: How you doing? I need to book an appointment
[026s] ASSISTANT: Sure. Um. What kind of plumbing issue are you dealing with?
[029s] USER: Uh, my toilet's leaking
[036s] ASSISTANT: Oh, yeah, we can definitely help you with that. Can I have your name and the best phone number for the appointment?
[039s] USER: Uh, Anthony Johnson
[040s] ASSISTANT: Mm-hmm.
[044s] ASSISTANT: And your phone number?
[050s] USER: Um, you know what, can I go ahead and book an appointment
[055s] ASSISTANT: Definitely, we can take care of that. What's a good day and time for you?
[061s] USER: Uh, let's say today, whatever your earliest appointment is
[064s] ASSISTANT: Okay, yeah, let me check today's availability.
[075s] ASSISTANT: I do have openings at 3, 3:30 and 4 PM. Which time would you like?
[078s] USER: Uh, 4 p.m
[079s] ASSISTANT: Great. I'm on it.
[090s] ASSISTANT: Okay, I can go ahead with that but I still need your phone number, an email address and your mother's name. What's the best phone number for the booking?
[097s] USER: Uh, , five seven one, four seven seven, six one, seven five
[099s] ASSISTANT: Thanks. And what's your email address?
[102s] USER: Ah- an- actually, how much do you guys
[103s] USER: charge
[114s] ASSISTANT: Our standard diagnostic visit is ninety-five dollars. If it's after hours emergency, the dispatch fee is one-forty. And our hourly labor rate is one twenty-five.
[117s] USER: Oh okay, okay
[122s] ASSISTANT: Yeah. So can I get your email address to continue the booking?
[126s] USER: Sure, it's a seven-zero-three
[133s] USER: deuce at gmail dot com. Actually, you know what? Never mind. My, let's use the other one. It's Anthony at Yahoo dot com
[138s] ASSISTANT: Got it. Anthony at Yahoo dot com. And could I get your mother's name as well?
[146s] USER: Um- you know what, let's switch back. Let's go back. You know what? I just wanna call back actually. I don't need to book the appointment
[151s] ASSISTANT: Alright, no problem. I'll go ahead and note that you'd prefer a call back instead.
[162s] ASSISTANT: Thanks for waiting. I've got that callback request recorded with your number. They'll reach out to you soon. Anything else I can help with in the meantime?
[165s] USER: Uh, no, that's it
[169s] ASSISTANT: Alright. Thank you for calling WS1 Cert Plumbing Co. Take care.
```

---

## Tool timeline (monotonic ms, deduped)

| ~ms | Tool | Result | Elapsed (ms) |
|-----|------|--------|--------------|
| 56,957 | `update_intake` | `INTAKE_UPDATED` | 6 |
| 60,627 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 5 |
| 61,700 | `update_intake` | `INTAKE_UPDATED` | 46 |
| 62,403 | `find_availability` | **`available`** | 718 |
| 65,376 | `set_scheduling_preference` | `SCHEDULING_PREFERENCE_SET` | 23 |
| 67,144 | `find_availability` | **`available`** | 733 |
| 73,715 | `book_appointment` | **`not_ready`** | 2 |
| 78,462 | `book_appointment` | **`not_ready`** / `MISSING_REQUIRED_INFORMATION` | 16 |
| 142,247 | `update_intake` | `INTAKE_UPDATED` | 3 |
| 146,990 | `update_intake` | `INTAKE_UPDATED` | 16 |
| 147,992 | `request_callback` | **`callback_requested`** | 343 |
| 152,738 | `request_callback` | **`callback_requested`** | 390 |

---

## Callback persistence (authoritative)

| Field | Value |
|--------|--------|
| **`callbackRequestId`** | **`cmuf2bcpz6w665o164m2l3q3j`** |
| **Reason** | **Leaking toilet** |
| **Status** | **`new`** |
| **Source** | `VOICE_V3` |

### Intake snapshot on callback (`metadata.voiceV3.customFieldsSnapshot`)

| Field | Value | Source |
|--------|--------|--------|
| **name** | Anthony Johnson | caller |
| **service_reason** | Leaking toilet | caller |
| **email** | anthony@yahoo.com | caller |
| **phone** | 5714776175 | caller |

**ANI:** `inboundAni` stored on callback metadata (matches `callback_requests.callerE164` for return call). Caller also provided **explicit phone** in intake — useful for hard-case / alternate-number scenarios.

**SLA:** `voiceV2CallbackSla` — NORMAL urgency, promised deadline ~**2026-09-24T05:59:21Z** (~1h target).

---

## Verdict (hard test)

| Check | Result |
|--------|--------|
| Luna backend | **Yes** (`gpt-6-luna`) |
| Booking path exercised | **Yes** (FIND + guarded BOOK) |
| Runtime safety | **Yes** (no forced book on `not_ready`) |
| Pivot to callback | **Yes** |
| Callback persisted | **Yes** (`cmuf2bcpz6w665o164m2l3q3j`) |
| Phantom appointment | **No** |
| Rich intake on callback | **Yes** (email + phone + name + reason) |

---

## Related Luna audits (same night)

| Suffix | Path | Outcome |
|--------|------|---------|
| `GhcuVC5EZbrq` | Book → callback | `callback_requested` |
| `jpbrfMBzQd86` | Callback → book | `appointment_booked` |
| **`bnmuJyyrJ8tV`** | **Hard book → callback** | **`callback_requested`** |
| `jU5s6hKcGXo4` | Straight book | `appointment_booked` |

---

## Re-inspect

```bash
# Forensics summary (tools + callback row)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-forensics.ts bnmuJyyrJ8tV

# Full metadata + forensics events JSON (~450KB)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/dump-call-audit-bundle.ts bnmuJyyrJ8tV ./bnmuJyyrJ8tV-full.json
```

Production (Coolify):

```bash
ssh coolify-server
CID=$(docker ps -q -f name=ds8s3hjin | head -1)
docker exec "$CID" sh -c 'cd /app && NODE_OPTIONS="--import ./scripts/preload-server-only.mjs" npx tsx scripts/audit-forensics.ts bnmuJyyrJ8tV'
```
