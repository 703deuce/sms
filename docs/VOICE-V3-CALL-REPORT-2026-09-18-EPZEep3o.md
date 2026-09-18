# Voice V3 PSTN call report — 2026-09-18 (evening UTC)

Post-mortem from production runtime logs (Coolify web container) and the built-in `VOICE V3 CALL` trace. Analysis performed against logs pulled from the live server; booking success is based on explicit `BOOKING_CONFIRMED` / `MICROSOFT_EVENT_CREATED` events, not on caller perception alone.

---

## Calls in this window

| # | Live session | Voice call id | Wall time (UTC) | Duration |
|---|--------------|---------------|-----------------|----------|
| **A** (short) | `live_u7_EPZE5p3oMS9dOT82TZbC5Py07bL7D2K3` | `v3:Rdou2cfi_MReJSLruvOgcAiVtaamsTSsIPvFeXX9H7zG7OUOM3clPA` | 20:11:58 → 20:12:27 | ~**29 s** |
| **B** (booking) | `live_u7_EPZEep3oMvdlwvov7vSaBi9XTlszvjMG` | `v3:TyVGOywJ-kYvNupHypfeogOC1HmTY_8_ivv1G0zZfCRqTnyepbauDg` | 20:12:34 → 20:15:34 | ~**3 min** |

The ~10 second call followed by the long call that “said it booked” matches **Call A** then **Call B**.

Production deploy during this window: commit **`45d96bc4`** (Microsoft calendar id `primary` fix). FIND and BOOK on **Call B** completed successfully against Microsoft Graph.

**Log source:** Coolify container `ds8s3hjin60qs6g7s0iqkixs-195941593201` (example name; suffix may vary per deploy).

---

## Did Call B really book?

**Yes.** The backend confirms a real Microsoft calendar write.

| Evidence | Detail |
|----------|--------|
| `ASYNC_ACTION_SUCCEEDED` | `operation_type: 'BOOK_APPOINTMENT'`, `status: 'SUCCEEDED'` |
| `MICROSOFT_EVENT_CREATED` | `provider: 'microsoft'`, `duration_ms: 1293` |
| `BOOKING_CONFIRMED` | Same attempt, `duration_ms: 1293` |
| Runtime → Live snapshot | `BOOKING CONFIRMED BY MICROSOFT` — **Start (local): `2026-09-21T16:00:00-07:00`**, timezone `America/Los_Angeles`, service `service-visit` |
| Booking attempt id | `bka_cmu7ee71p586i1x1w1o5r2i0v` |
| Slot | `offer_set_62ece837d4a8` / `slot_1`, scheduling generation **2** |

Amy’s spoken confirmation matched authoritative runtime state: the appointment was created in Microsoft, not simulated in the UI.

**What was booked:** **Monday, September 21, 2026, 4:00 PM Pacific** (60-minute service visit). This was scheduling generation **2**, not the first “tomorrow” search (see FIND section below).

---

## What worked vs. what did not (Call B)

### Worked

1. **PSTN → Live accept** — roughly 3.4 s from accept start to session live.
2. **Greeting** — requested at session start; greeting audio completed ~1.5 s after that segment began.
3. **Intake** — all required fields eventually captured: `name`, `email`, `phone`, `service_reason`, `mother_s_name`.
4. **FIND (generation 2)** — Microsoft busy lookup ~497 ms, **1 slot**, total FIND pipeline ~671 ms.
5. **BOOK** — Microsoft create ~1.3 s, then `BOOKING_CONFIRMED`.
6. **Astra meaning apply** — logged **1–7 ms** per applied turn (parsing is not the latency bottleneck).

### Rough or confusing (call still completed)

1. **Phantom first “turn”** immediately after greeting (`empty_signal`) — see “Greeting / silent caller” section.
2. **FIND generation 1** returned **0 slots** for Friday Sep 19, ~4–5 PM Pacific (valid Graph response, empty offer set).
3. **Planner overlap after gen 2 FIND:** logs showed **`slot_count: 1`** and `availability_status: 'ready'`, but also **`blocker_code: 'NO_AVAILABILITY'`** and a one-shot `INFORM_TEMPORARY_FAILURE` — likely stale recovery from gen 1, not a failed book.
4. **Hangup noise:** multiple OpenAI `responses_websocket` errors and `Session closed before the queued response could start` **after** booking confirmed (~20:15:22 UTC). Did not prevent the book.

---

## Timing: Call B end-to-end (UTC)

**t = 0** at PSTN / `live.incoming` (**20:12:33.965 UTC**).

| Δ from start | Event |
|--------------|--------|
| **0.0 s** | PSTN / `live.incoming` |
| **+4.5 s** | Live session started, greeting requested |
| **+5.5 s** | `emit_caller_meaning` → **`empty_signal`** (no caller fields) |
| **+5.5 s** | `SEMANTIC_EXTRACTION_FAILED` → recovery / clarify path |
| **+19.2 s** | First real **caller turn committed** (93 chars transcript) |
| **+23.7 s** | Turn 1 meaning applied; **FIND gen 1** dispatched |
| **+24.5 s** | FIND gen 1 complete: **0 slots** (Sep 19 ~4 PM PT window) |
| **+43.3 s** | FIND gen 2 complete: **1 slot** (Sep 21 ~4 PM PT window) |
| **+166.4 s** | **BOOK** dispatched |
| **+168.5 s** | **`BOOKING_CONFIRMED` (Microsoft)** |
| **+179.7 s** | Session closed |

**Book segment:** ~**2.1 s** from booking attempt creation to `BOOKING_CONFIRMED`.

---

## Timing: per caller turn (intake pauses)

Committed turns (cumulative transcript length in logs):

| Turn | Committed (UTC) | Δ from previous turn | Transcript chars | Notes |
|------|-----------------|----------------------|------------------|--------|
| 1 | 20:12:53 | — | 93 | Meaning + FIND gen 1 ~4.5 s after commit |
| 2 | 20:13:12 | ~19 s | 173 | Mostly speech + Live response; FIND gen 2 completes ~43 s call time |
| 3 | 20:13:27 | ~15 s | 181 | |
| 4 | 20:13:46 | ~19 s | 213 | |
| 5 | 20:14:02 | ~16 s | 263 | |
| 6 | 20:14:21 | ~19 s | 271 | |
| 7 | 20:14:22 | ~1 s | 279 | Tight overlap with turn 8 |
| 8 | 20:14:23 | ~1 s | 289 | |
| 9 | 20:14:44 | ~21 s | 365 | |
| 10 | 20:14:45 | ~1 s | 371 | |
| 12 | 20:15:12 | — | 461 | Late intake (e.g. mother’s name area) |
| 13 | 20:15:31 | ~19 s | 497 | BOOK ~9 s after this commit |

**Typical micro-steps for one intake cycle:**

1. **Caller speaks** — Live VAD / `caller.transcript.activity` (variable, often many seconds).
2. **Turn commit** — `CALLER_TURN_COMMITTED`.
3. **Live delegates** — `emit_caller_meaning` → Astra (**1–7 ms** apply in logs).
4. **`semantic_retry` / `delegation_drained`** — extra seconds on some turns (7–12) when Live did not complete delegation cleanly on first pass.
5. **Planner speaks** — `response.create` + TTS (**often 2–8+ s** per `astra.response.started` → `completed`).
6. **Calendar** (when relevant) — FIND **~0.5–0.8 s**; BOOK **~1.3 s**.

Perceived slowness after name / mother’s name is dominated by **turn-end detection, Live speech, and delegation/retry**, not Microsoft Graph or Astra parsing.

---

## FIND breakdown (Call B)

| Gen | Window (UTC) | Local intent (approx.) | Microsoft busy | Slots | Total FIND |
|-----|----------------|------------------------|----------------|-------|------------|
| **1** | `2026-09-19T23:00` → `2026-09-20T00:00` | Fri Sep 19, ~4–5 PM PT | ~605 ms, 0 busy intervals | **0** | ~775 ms |
| **2** | `2026-09-21T23:00` → `2026-09-22T00:00` | Mon Sep 21, ~4–5 PM PT | ~497 ms | **1** | ~671 ms |

Generation 1 “no slots” explains availability discussion before the booked **Monday 4 PM** slot (generation 2).

---

## Greeting / “it responded when I didn’t say anything”

Same pattern on **both** Call A and Call B.

### Call B (~5.5 s after connect)

- Greeting audio completes ~**+6.0 s** on the relative `VOICE V3 CALL` trace.
- **`astra.response.started` again at ~+8.2 s** — before **`caller.speech.started` at ~+18.2 s**.
- At **20:12:39.490 UTC**, Live invokes **`emit_caller_meaning`** with **`empty_signal`** (0 captured fields, goal `UNKNOWN`).
- Runtime: **`SEMANTIC_EXTRACTION_FAILED`**, next action `CLARIFY_INTENT`, `response.create` with reason `semantic_extraction_failed`.

Interpretation supported by logs (not acoustic proof):

1. Meaning extraction ran **before a valid caller turn**, likely tied to early Live/delegation behavior after greeting.
2. Possible **echo, line noise, or model-initiated tool call** with payload rejected as empty (`item_arguments_bytes: 514` on the failed extraction).
3. User experience: Amy may speak **~10 s before** the first logged `caller.speech.started`.

### Call A (~29 s)

- **20:12:05.479 UTC** — same **`empty_signal`** ~7 s after session accept.
- Session closed **20:12:27** without a successful book — consistent with “I asked a question and it wouldn’t respond” (recovery/competing responses, early hangup).

---

## SSH / runtime log references

Useful grep anchors on the production container:

- Session: `live_u7_EPZEep3oMvdlwvov7vSaBi9XTlszvjMG`
- Call id: `v3:TyVGOywJ-kYvNupHypfeogOC1HmTY_8_ivv1G0zZfCRqTnyepbauDg`
- Booking: `bka_cmu7ee71p586i1x1w1o5r2i0v`
- Tail summary block: `VOICE V3 CALL live_u7_EPZEep3oMvdlwvov7vSaBi9XTlszvjMG`

Example:

```bash
docker logs --since 2h <container> 2>&1 | grep 'live_u7_EPZEep3oMvdlwvov7vSaBi9XTlszvjMG'
```

---

## Summary table

| Question | Answer |
|----------|--------|
| **Did it really book?** | **Yes** — `BOOKING_CONFIRMED` + `MICROSOFT_EVENT_CREATED`, **Mon Sep 21, 2026, 4:00 PM PT**, attempt `bka_cmu7ee71p586i1x1w1o5r2i0v`. |
| **Why did it feel slow?** | Often **15–20 s** between committed turns in logs; Astra apply **&lt;10 ms**; **Live TTS + delegation / semantic_retry** dominate. |
| **Why speak when I was silent?** | **`empty_signal` right after greeting** on both calls; extra Live response **~8 s** before real **`caller.speech.started` ~18 s** on Call B. |
| **Why did the short call fail?** | Same early **`empty_signal`** / `SEMANTIC_EXTRACTION_FAILED`; hung up before a clean intake/book loop. |

---

## Recommended follow-up fixes (engineering)

Not implemented in the report-only pass; track as product/eng work:

1. **Greeting guard** — Do not run `emit_caller_meaning` / semantic pipeline until `caller.speech.started` (or minimum silence after `greeting.audio.completed`).
2. **Empty delegation handling** — Defer or silently ignore empty meaning without triggering `semantic_extraction_failed` speak.
3. **Recovery hygiene** — Clear stale `NO_AVAILABILITY` when a later FIND generation returns slots.
4. **Hangup** — Avoid duplicate `response.create` after `BOOKING_CONFIRMED` to reduce OpenAI websocket errors at teardown.

---

*Generated from production log analysis. Timestamps are UTC unless noted. Local booking time uses workspace/agent timezone `America/Los_Angeles`.*
