# Voice V2 — Last PSTN call report

**Generated:** 2026-09-16 (UTC)  
**Source:** Telnyx Conversations/Messages API + `scripts/forensic-pstn-call-phase-2b.ts` + `scripts/dump-pstn-call-report.ts`  
**Raw artifacts:** `/opt/cursor/artifacts/last-pstn-call-forensic.json`, `/opt/cursor/artifacts/last-pstn-call-latency-dump.txt`

This is the **most recent** conversation on the **571 / wizard Voice Agent** Telnyx assistant (`assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6`), not an after-hours/warm-transfer test unless you placed a different call later.

---

## Call identity

| Field | Value |
|--------|--------|
| **When** | 2026-09-16 **16:31:26** – **16:33:23** UTC (~**1 min 56 s**) |
| **Telnyx conversation** | `4f6d5e74-d504-4968-a2ed-9d2fd6e9b8e2` |
| **Call control ID** | `v3:Zsh4dvlCxUFTIVpolGdUKivNOqbdyD2vE7KsSRHGVJHAcxF9tqa_EQ` |
| **Prisma VoiceCall** | `cmu4bkx2r4n5u2d6k2l4t2f0d` |
| **Workspace** | `cmtghl8et0r5v1i5f0r417372` |
| **Wizard agent (audit)** | `cmshz2lc25c622c4i58303501` |
| **Telnyx assistant** | `assistant-3decb330-61ca-4a28-bbc0-7d51bcc961d6` (571 VOICE_AGENT path) |
| **Business spoken** | Harbor Drain Pros (closing line) |

**Voice (Amy):** Published on the wizard agent above — typically **`ava-warm-us` / “Astra”** → Telnyx **`Telnyx.NaturalHD.astra`** unless you changed the Voice step after publish. This report does not include a live agent-config dump; check wizard **Voice** for the exact `voiceId` on that agent.

**Path:** PSTN → TeXML / inbound **VOICE_AGENT** → Telnyx AI Assistant (Voice V2 shared tools), **not** LiveKit.

---

## High-level outcome

| Area | Result |
|------|--------|
| **Live Microsoft booking** | **Success** — Graph calendar event created, `BOOKING_CONFIRMED` for **4:00 PM today** |
| **Find availability** | **Success** — 4 slots returned (1–4 PM window) |
| **Intake / email gate** | **Worked as designed** — first `book_offered_slot` blocked on missing email; after save, second book succeeded |
| **Caller experience / latency** | **Good** on captured turns — ~**2.7–2.8 s** caller-stop → Amy audio; ~**845 ms** to first tool decision; ~**1.07 s** avg tool round-trip |
| **Close / finalize** | **Partial** — `voice_v2_finalize_caller_request` returned **`NOT_READY`** (missing `name`, `phone`, `mother_s_name` for record); Amy still closed politely |
| **Phase 2B startup telemetry** | **Not present** in DB/events for this call (warmup / first-greeting ms = UNKNOWN) |
| **voiceToolExecution rows** | **0** in forensic pull (tool trace via Telnyx message bodies + booking audit only) |

---

## What worked

1. **`voice_v2_find_availability`** — `AVAILABILITY_FOUND`, Graph `calendarView` **~267 ms**, offer set `v2offer_cmu4bjmp5640m6f0h4r500n3u`, **4 slots**.
2. **Email-before-book gate** — `book_offered_slot` (`book-2`) correctly returned **`MISSING_REQUIRED_FIELDS`** / `missing_fields: ["email"]`; Amy asked for email without crashing.
3. **`voice_v2_save_intake_fields`** — email `anthony@example.com` saved; runtime allowed **`voice_v2_book_offered_slot`** next (`booking_continue_required: true`).
4. **`voice_v2_book_offered_slot`** (`book-4`) — **`BOOKING_CONFIRMED`**, Graph create **~425 ms** (revalidation view **~222 ms**); backend **~3.1 s** total per audit (`TOTAL_BACKEND_MS: 3117`).
5. **Conversational flow** — offered 1–4 PM; caller chose 4 PM; confirmation and goodbye were coherent.
6. **Response speed (logged segment)** — see latency section below; no duplicate FIND in this transcript slice.

---

## What did not work (or gaps)

1. **`voice_v2_finalize_caller_request`** — **`NOT_READY`** / `CALLER_REQUEST_NOT_READY` because **`missing_for_record`: `name`, `phone`, `mother_s_name`**. Booking had already succeeded; finalize is stricter than “book complete.” Amy ignored the blocker verbally and ended the call anyway (acceptable UX, but **record/request pipeline incomplete**).
2. **First `book_offered_slot` attempt** — **Expected failure** (no email yet), not a regression.
3. **Telnyx transcript gap** — Messages API timeline in this export **starts at +60.5 s** with user *“As soon as possible.”* The **first ~60 s** of the call (greeting / earlier intake) is **not** in the chronological dump (likely earlier turns not in this message list or different logging boundary).
4. **Phase 2B metrics** — `PSTN_INGRESS_TO_ANSWER_MS`, warmup, `FIRST_REAL_TOOL_AT` from voice events: **UNKNOWN / empty** (`VOICE_CALL_EVENTS: []` in forensic JSON).
5. **Tool webhook ingress count** — **0** in forensic (ingress may still have occurred; not linked in `voiceToolExecution` / `providerWebhookEvent` for this report).
6. **After-hours / warm transfer / urgency** — **Not exercised** on this call (standard Microsoft live-booking conversation).

---

## Tool calls (order)

| # | Tool | Invocation | Result | Notes |
|---|------|------------|--------|--------|
| 1 | `voice_v2_find_availability` | `avail-1` | `AVAILABILITY_FOUND` | Date 2026-09-16, window 08:00–18:00 |
| 2 | `voice_v2_book_offered_slot` | `book-2` | `MISSING_REQUIRED_FIELDS` | Missing **email** (~1.99 s Telnyx→Transovo on tool path) |
| 3 | `voice_v2_save_intake_fields` | `book-3` | `INTAKE_SAVED` | `email` only |
| 4 | `voice_v2_book_offered_slot` | `book-4` | `BOOKING_CONFIRMED` | Graph 201 / event id in tool payload |
| 5 | `voice_v2_finalize_caller_request` | `close-1` | `NOT_READY` | Missing name, phone, custom `mother_s_name` |

Session `called_tools` (Telnyx metadata):  
`voice_v2_find_availability`, `voice_v2_book_offered_slot`, `voice_v2_save_intake_fields`, `voice_v2_finalize_caller_request`.

---

## Latency & response speed

**Method:** Telnyx message `created_at` deltas (`dump-pstn-call-report.ts`).  
**Caveat:** “USER” time is **message committed**, not exact end-of-utterance audio.

### Per-turn: caller stop → Amy first audio (forensic)

| Turn | Caller said | Stop → Amy audio |
|------|-------------|------------------|
| 1 | “As soon as possible.” | **2786 ms** |
| 2 | “Four PM.” | **2733 ms** |
| 3 | “Anthony at example dot com.” | **2738 ms** |
| 4 | “No. That's it.” | **2750 ms** |

### Aggregates (captured segment)

| Metric | Value |
|--------|--------|
| **YOU → AMY (first reaction)** | avg **845 ms**, max **864 ms** (to tool decision, not always to speech) |
| **Tool round-trip** (tool call → tool result) | avg **1.07 s**, **n = 5** |
| **Tool → Amy speak (TTS)** | ~**834–856 ms** typical |
| **Book backend (confirmed attempt)** | **3117 ms** total (`OFFER_RESOLUTION` 184, `REVALIDATION` 476, `TOKEN` 127, `GRAPH_CREATE` 559 ms) |

### Chronological transcript (offset from conversation start)

See full text in `last-pstn-call-latency-dump.txt`. Summary:

- **+60.5 s** — User: scheduling preference (“As soon as possible.”)
- **+63.3 s** — Amy offers 1–4 PM
- **+74.7 s** — Amy asks for email (after failed book)
- **+101.5 s** — Amy: “Got it — I’m getting that set now.” then books
- **+105.2 s** — Amy: booked 4 PM today
- **+111.0 s** — Amy goodbye (after finalize NOT_READY)

---

## Booking audit (server)

```json
{
  "callId": "v3:Zsh4dvlCxUFTIVpolGdUKivNOqbdyD2vE7KsSRHGVJHAcxF9tqa_EQ",
  "agentId": "cmshz2lc25c622c4i58303501",
  "toolType": "voice_v2_book_offered_slot",
  "resultStatus": "BOOKING_CONFIRMED",
  "offer_set_id": "v2offer_cmu4bjmp5640m6f0h4r500n3u",
  "selected_slot_id": "slot_28e20cb00a8ad26f",
  "timing_ms": {
    "OFFER_RESOLUTION_MS": 184,
    "REVALIDATION_MS": 476,
    "TOKEN_MS": 127,
    "GRAPH_CREATE_MS": 559,
    "TOTAL_BACKEND_MS": 3117
  }
}
```

---

## How to refresh this report

```bash
# Latest 571-assistant conversation (or pass CONV_ID explicitly)
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/dump-pstn-call-report.ts <conversation_id>

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  CONV_ID=<conversation_id> npx tsx scripts/forensic-pstn-call-phase-2b.ts
```

To target a **different** call, use the `conversation_id` from Telnyx or `CALL_ID` / `CONV_ID` from the voice call detail UI.

---

## Verdict for manual follow-up

- **Core booking loop:** **PASS** for this call (find → email gate → book).
- **Finalize / full intake record:** **FAIL soft** — configure or collect `name`, `phone`, and `mother_s_name` (or relax finalize rules) if you want `finalize_caller_request` to succeed after booking.
- **Observability:** Improve **Phase 2B** and **voiceToolExecution** linkage if you need startup and per-tool ingress in this report automatically.
