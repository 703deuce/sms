# PSTN Call Forensic Report — OpenAI Live + Voice V2 Delegation

**Call ID:** `cmu58huys1m0u2z480s656y3j`  
**Line:** +1 571-407-3615  
**When (UTC):** 2026-09-17 **07:54:41** – **07:57:18** (~2 min 37 s)  
**Workspace:** `ws_1`  
**Path:** `openai-live-bridge` · `live_delegation: true` · `live_split_prompts: true` · model `gpt-live-1`  
**Bridge:** `wss://api.openai.com/v1/live/sessions` · voice `marin` · `audio/pcmu@8000`

No `invalid_request_error` or `delegation_id` protocol failures on this call (unlike ~07:40–07:48 runs on the same line).

---

## Executive summary

- **Booking succeeded for real** — Microsoft Graph event created, `voiceAppointment` confirmed, idempotency row present.
- **FIND** and **BOOK** both completed with certified executors; statuses `AVAILABILITY_FOUND` and `BOOKING_CONFIRMED`.
- **Pricing** had no tool (expected); Amy used text-only delegation, then **save_intake** (×2) and **create_callback_request** succeeded.
- **`voiceToolExecution` is empty** for this call — Live bridge logs tools via `LIVE_*` container logs; DB proof is offer set + idempotency + `voiceAppointment`.

---

## Did booking actually happen for real?

**Yes.** Not spoken-only success; certified Voice V2 BOOK ran and persisted a Microsoft calendar event.

| Evidence | Value |
|----------|--------|
| Live tool result | `voice_v2_status: BOOKING_CONFIRMED` · `superseded: false` |
| Offer set | `v2offer_cmu58iz2l4j0u174p0h0u6c3t` · service **60 Minute Consultation** · **8 slots** |
| Booked slot | `slot_95e70e7a9bc0177c` · **9:00 AM** `America/Los_Angeles` |
| Wall time | **Wed 2026-09-23** 16:00–17:00 UTC (= 9:00–10:00 AM Pacific) |
| `voiceAppointment` | `cmu58jd7t72471y1p6w1j2p01` · `status: confirmed` · `callId` = this call |
| Microsoft Graph `event_id` | `AQMkADAwATM0MDAAMi1hOWY1LTY3MzEtMDACLTAwCgBGAAADxtFon5XuVEalmlhPr1nWBgcAs2vWk3hKT02vN5c-Q6OlzQAAAgENAAAAs2vWk3hKT02vN5c-Q6OlzQAAAEcWeDcAAAA=` |
| Mailbox (metadata) | `anthony@transovo.ai` |
| Provider connection | `cmu1uq7f15s1o5s4f6c5b6a57` |

Amy: *"You're all set for 9AM next Wednesday."* — matches stored booking (`spoken_label`: 9:00 AM).

**Idempotency row (created 07:55:53.012Z):**

- `offerSetId`: `v2offer_cmu58iz2l4j0u174p0h0u6c3t`
- `slotId`: `slot_95e70e7a9bc0177c`
- `microsoftEventId`: same as above
- `voiceAppointmentId`: `cmu58jd7t72471y1p6w1j2p01`
- `resultJson` preview: `spoken_confirmation`: "You're booked for 9:00 AM."

---

## What succeeded vs what failed

| Phase | Result |
|--------|--------|
| Media / Live session | **OK** — Telnyx stream `75e94837-165b-4f99-a8fc-7cfca87c7949`, bidirectional audio |
| Greeting | **OK** |
| Scheduling dialog (day/time) | **OK** — no tools until availability |
| **FIND** (`voice_v2_find_availability`) | **OK** — `AVAILABILITY_FOUND`, Microsoft certified executor |
| **BOOK** (`voice_v2_book_offered_slot`) | **OK** — `BOOKING_CONFIRMED`, Graph event created |
| **Pricing question** | **Expected gap** — no pricing/knowledge tool; Amy said no pricing on hand, offered transfer / callback |
| **Post-book intake** (`voice_v2_save_intake_fields` ×2) | **OK** — `INTAKE_SAVED` |
| **Callback** (`voice_v2_create_callback_request`) | **OK** — `CALLBACK_REQUESTED` |
| Transfer / live human for pricing | **Not exercised** — caller chose “take my info” |

No failed FIND/BOOK in production logs for this `callId`.

---

## Tool calls (executor, latency, outcome)

Offsets from **`voiceCall.startedAt`** = `2026-09-17T07:54:41.350Z`.  
Wall times from production Docker logs (`LIVE_FUNCTION_CALL` / `LIVE_TOOL_RESULT`).

| # | Tool | Wall start (UTC) | Offset from call start | `elapsed_ms` | `voice_v2_status` | Executor | `superseded` |
|---|------|------------------|------------------------|--------------|-------------------|----------|--------------|
| 1 | `voice_v2_find_availability` | 07:55:31.702 | ~50.4 s | **1846** | `AVAILABILITY_FOUND` | `executeMicrosoft365CertifiedFindAvailability\|executeVoiceV2FindAvailability` | false |
| 2 | `voice_v2_book_offered_slot` | 07:55:49.888 | ~68.5 s | **3492** | `BOOKING_CONFIRMED` | `executeVoiceV2BookOfferedSlot` | false |
| 3 | `voice_v2_save_intake_fields` | 07:56:36.879 | ~115.5 s | **209** | `INTAKE_SAVED` | `executeVoiceV2SaveIntakeFields` | false |
| 4 | `voice_v2_save_intake_fields` | 07:56:50.809 | ~129.5 s | **201** | `INTAKE_SAVED` | `executeVoiceV2SaveIntakeFields` | false |
| 5 | `voice_v2_create_callback_request` | 07:57:02.585 | ~141.2 s | **681** | `CALLBACK_REQUESTED` | `executeVoiceV2CreateCallbackRequest` | false |

**Delegation IDs (for log correlation):**

- FIND: `item_EP1FnddIrPJ8s12YHfrCY` · OpenAI `call_id` `call_jCS6x8K0YLHhtOVsKRPW7jdq`
- BOOK: `item_EP1G74ZiSdWhEekH7dRbB` · `call_AuNVrV0Cb6or7K4mGLMhvoHj`
- SAVE (1): `item_EP1Gsus0xSw6K95j9vdzq` · `call_JBtTPjl8GMxUk63SoMwPVBXz`
- SAVE (2): `item_EP1H6pwIld702w1iMHHqf` · `call_YhtOqOdEIrdlB9kLLutcbQJE`
- CALLBACK: `item_EP1HIG5mIM6YAThW9cmpm` · `call_2YFCtZ6FOpA8DJddL3Lo7Fbv`

**Output sizes:** FIND 1855 B · BOOK 798 B · SAVE ~776/749 B · CALLBACK 148 B.

---

## Latency: bridge boot (`openai_live_timing`)

Telnyx media WebSocket attach = 0 ms reference.

| Milestone | ms since Telnyx WS |
|-----------|---------------------|
| `telnyx_ws_attached` | 0 |
| `telnyx_stream_start` | 398 |
| `openai_ws_open` | 480 |
| `session_resolve_start` | 480 |
| `session_resolve_done` | **4454** (~4.5 s) |
| `session_start_sent` | 4455 |
| `session_started` | **4992** |
| `live_greeting_instruction_sent` | 4994 |
| `first_output_audio_delta` | **5413** (~5.4 s) |
| `live_greeting_kickoff_sent` | 5513 |

Live session id: `live_u2_EP1FIp3oNKaflV5FwQ3pZJxM8HZGdiPQ`.

Telnyx `voiceCallEvent` also recorded **`answerToAiMs: 6403`** on assistant start. First PSTN transcription of greeting ~**25.7 s** after `voiceCall.startedAt` (answer, disclosure, bridge attach before Live audio).

---

## Latency: conversational turns (Telnyx transcriptions)

Times are seconds after `voiceCall.startedAt`.  
**reply_latency** = outbound final transcript minus previous inbound final (STT + model + TTS + tools; not executor-only).

```
25.7s [outbound] Thanks for calling. This is Amy. How can I help you?
28.9s [inbound] I need to book an appointment.
33.5s [outbound] Absolutely. What day works best for you? (reply_latency~4.5s after caller)
36.6s [inbound] Next Wednesday.
42.5s [outbound] Perfect. What time on Wednesday are you hoping for? (reply_latency~5.9s after caller)
47.0s [inbound] I'm open. What time do you have?
50.1s [outbound] Sure. Let me check. (reply_latency~3.2s after caller)
62.9s [outbound] I have 09:10 11:12 1, 2, 3, or 4PM. (reply_latency~15.9s after caller)
64.3s [outbound] Which works best for you? (reply_latency~17.3s after caller)
69.4s [outbound] Okay.
74.9s [inbound] 9.
78.7s [outbound] You're all set for 9AM next Wednesday. (reply_latency~3.8s after caller)
80.2s [outbound] Will you need anything else? (reply_latency~5.3s after caller)
85.6s [inbound] Do you know how much you guys cost?
89.3s [outbound] Sure. Let me check on that. (reply_latency~3.7s after caller)
94.5s [outbound] I don't have pricing details on hand. (reply_latency~8.9s after caller)
98.4s [outbound] But would you like me to transfer you to someone who can help with pricing or take
98.9s [outbound] your info so they can get back to you? (reply_latency~13.3s after caller)
101.7s [inbound] Sure. You could take my info.
106.8s [outbound] Okay. What's the best name and phone number for them to reach you? (reply_latency~5.0s after caller)
113.7s [inbound] Anthony Johnson. (571) 477-6175.
116.9s [outbound] Got it. 1 moment. (reply_latency~3.3s after caller)
122.3s [outbound] Thanks, Anthony. I've got your name and number. (reply_latency~8.7s after caller)
124.3s [outbound] Do you have an email you wanna give them as well? (reply_latency~10.6s after caller)
128.7s [inbound] Anthony@example.com.
130.5s [outbound] Thanks. (reply_latency~1.8s after caller)
138.5s [outbound] Okay. I've got that as well. Would you like me to have someone call you back about pricing? (reply_latency~9.8s after caller)
141.1s [inbound] Sure.
142.3s [outbound] K. (reply_latency~1.1s after caller)
148.0s [outbound] Sure. Someone will give you a callback. (reply_latency~6.9s after caller)
150.1s [outbound] Is there anything else I can do for you? (reply_latency~8.9s after caller)
151.9s [inbound] No. That's it.
155.5s [outbound] Great. Thanks for calling. Take care. (reply_latency~3.5s after caller)
```

**Notes on perceived latency:**

- FIND backend **~1.8 s**; caller heard slots ~**13 s** after “let me check” (delegation + long TTS list).
- BOOK backend **~3.5 s**; BOOK started ~**68.5 s** while final “9.” transcription landed ~**74.9 s** (STT lag / prior “Okay” turn).
- Pricing segment: **no** `LIVE_FUNCTION_CALL` until intake/callback tools later.

---

## Conversation arc (short)

1. Book → day → Wednesday → open on time.  
2. FIND → offered 9, 10, 11, 12, 1, 2, 3, 4 PM.  
3. Caller chose **9** → BOOK → **9 AM next Wednesday** confirmed.  
4. Pricing → no tool → callback / intake → save_intake ×2 + create_callback_request → close.

---

## Comparison to earlier calls (same experiment)

| Call ID (approx time UTC) | Issue |
|---------------------------|--------|
| Earlier minimal runs | `pass_through: true` — no tools |
| `cmu57jl4…` (~07:28) | Pre-attach fix — silence (`openai_output_audio_frames=0`) |
| `cmu57r50…` (~07:34) | `save_intake` strict schema rejected by OpenAI |
| `cmu57yr4…` / `cmu589bb…` (~07:40–07:48) | FIND OK; BOOK ran but wrong formatter to model + `delegation_id` errors |
| **`cmu58huys…` (~07:54)** | **First clean path:** BOOK formatter fix + delegation protocol fix |

---

## Log grep patterns (production)

```bash
docker logs <web-container> 2>&1 | grep -F 'cmu58huys1m0u2z480s656y3j' | grep -E 'LIVE_FUNCTION_CALL|LIVE_TOOL_RESULT|openai_live_timing|LIVE_IN error'
```

---

## DB inspection commands

```bash
CALL_ID=cmu58huys1m0u2z480s656y3j NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/inspect-call-detail.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/analyze-call-timing.ts cmu58huys1m0u2z480s656y3j
WORKSPACE_ID=ws_1 CALL_ID=cmu58huys1m0u2z480s656y3j NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/trace-voice-v2-pstn-call.ts
```

---

## Bottom line

Booking on this call is **real** (Graph `event_id` + `voiceAppointment` + idempotency). FIND and BOOK **succeeded** with backend times **1.8 s** and **3.5 s**. Post-booking pricing was **not** wired (as expected); intake and callback tools **ran successfully**. Main operational costs: **~4.5 s session resolve** per call, and **long spoken slot lists** after FIND.

---

*Generated from production logs (Coolify web container) + Postgres (`voiceCall`, `voiceCallEvent`, `voiceV2OfferSet`, `voiceV2BookingIdempotency`, `voiceAppointment`).*
