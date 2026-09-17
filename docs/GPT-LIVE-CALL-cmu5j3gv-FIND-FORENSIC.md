# FIND forensic — call `cmu5j3gv7522v5o4o29264l1e` (2026-09-17)

PSTN GPT-Live call with instrumentation hotpatch. Tool args were logged as **keys only** (`requested_date`, `time_window`) — not values — so this report combines logs, Amy transcript, and `VoiceV2OfferSet` DB rows when available.

## Tool sequence (logs)

| # | Tool | elapsed_ms | voice_v2_status |
|---|------|------------|-----------------|
| 1 | FIND | 713 (+712 ms first `LIVE_TOOL_CONTEXT_HYDRATE`) | **ERROR** |
| 2 | FIND | 1597 | **NO_AVAILABILITY** |
| 3 | FIND | 1885 | **AVAILABILITY_FOUND** |
| 4 | BOOK | 3465 | **BOOKING_CONFIRMED** |

Four delegations; three FINDs before BOOK. Caller selected **11 AM** after Amy offered **10 AM and 11 AM** — backend still ran FIND #3 in that episode (offer-set continuity gap).

## Conversational timeline (output transcript)

1. Greeting → small talk → Richmond/capital clarification.
2. Booking intent → day/time questions → morning preference.
3. Amy offers morning **10 next week** (day not fully pinned in transcript chunk).
4. Caller narrows → **Thursday** → **10 o’clock** → Amy: no openings at ten that Thursday.
5. Caller asks what mornings are available → Amy: **10 a.m. or 11 a.m. that morning** (sounds like same Thursday).
6. Caller picks **11** → Amy says **“Let me check…”** (unnecessary FIND) → **BOOKING_CONFIRMED** for **11 a.m. next Thursday**.

## Hypotheses for “10 not available” vs “10 and 11 offered”

**A — Lost date on FIND #2 (most likely)**  
FIND #2 may have used a **broader time window** without the same **requested_date** as FIND #1 (Thursday). `NO_AVAILABILITY` at a specific Thursday 10:00 does not imply no 10:00 on another day. If Amy still spoke as if it were Thursday, that is a **presentation bug** (model) plus **missing persisted scheduling preference** in delegation context.

**B — Different time_window normalization**  
FIND #1 may have been a **narrow window** (e.g. 10:00–10:30) while FIND #3 used **morning** (e.g. 08:00–12:00), surfacing 10 and 11. Compare `FIND_INPUT.normalized.time_window` after the logging patch ships.

**C — First FIND ERROR**  
First FIND **ERROR** (~713 ms, coincident with first hydrate) is often **cold context / connection / validation** on first tool touch — not necessarily “calendar said no.” Treat FIND #1 as **non-authoritative** for availability truth.

## Fixes shipped (this branch)

1. **`FIND_INPUT` / `FIND_RESULT` logs** — normalized date, time window, prior preference, offer_set_id, slots.
2. **In-memory `bookingSession`** on `LiveToolDispatchContext` — updated after FIND/BOOK.
3. **`session.update`** pushes `RUNTIME / SESSION STATE` JSON to delegation after each state change.
4. **Backend hard rule** — no re-FIND when selecting a slot from `current_offer_set`; preserve date when only period changes.
5. **Merge FIND args** with session preference when date/window omitted.
6. **Turn trace** — one `LIVE_TURN_SUMMARY` per caller→Amy turn (not per PCMU chunk).

## DB proof query

```sql
SELECT id, "voiceCallId", "slotsJson", "serviceName", timezone, "createdAt"
FROM voice_v2_offer_sets
WHERE "voiceCallId" = 'cmu5j3gv7522v5o4o29264l1e'
ORDER BY "createdAt" ASC;
```

Compare `slotsJson` and implied `requested_date` across rows for FIND #2 vs #3.
