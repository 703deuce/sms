# Voice V3 PSTN call forensics — duplicate intake questions & booking verification

**Investigated:** 2026-09-21 (production, Coolify)  
**Live session suffix:** `JUSYBrzenWLq`  
**Production container:** `ds8s3hjin60qs6g7s0iqkixs-181932778883`  
**Deploy commit (from logs):** `e57e7e5b8335a2548daab506ca0dc9ebf96d326c`

**Note:** The Cloud Agent `DATABASE_URL` did **not** show this call (0 calls in last 12h). Forensics below come from **production Docker logs** (SSH `coolify-server`) and **Prisma queries inside the production web container**.

---

## Call identity

| Field | Value |
|--------|--------|
| **Live session** | `lk_transovo-call-…_JUSYBrzenWLq` (suffix `JUSYBrzenWLq`) |
| **Started (UTC)** | `2026-09-21T01:45:35Z` |
| **Workspace / agent** | `ws_1` — **WS1 Cert Plumbing Co**, agent `cmshz2lc25c622c4i58303501` |
| **Booking** | Microsoft 365, service `service-visit` |
| **Required intake keys** | `name`, `phone`, `email`, `service_reason`, `notes`, **`mother_s_name`** |

Full conversational text is **not** stored in the web container logs—only per-turn **character counts** on `commit_voice_v3_livekit_caller_utterance`. There is **no** new `voiceCall` row for this session in prod (latest `voiceCall` is still **2026-09-18**), so there is likely **no** `voiceTranscript` row in Postgres for this PSTN leg yet. That is a forensics/post-call gap for LiveKit V3, separate from what happened on the call.

---

## Did it actually book?

**Yes — Microsoft calendar commit succeeded.**

At **01:49:38–01:49:40 UTC** the logs show:

- `BOOKING_READY` → `BOOKING_REVALIDATION_PASSED` → `BOOKING_COMMIT_SENT` (`provider: microsoft`)
- `MICROSOFT_EVENT_CREATED`
- `BOOKING_CONFIRMED`
- `book_appointment` tool → **`status: 'confirmed'`**

**Booking attempt id:** `bka_cmual7tho3r3a1h5p111n215l`  
**Offer set / slot:** `offer_set_16b691a35f6d`, **`slot_1`** (from the find that presented `slot_1`, `slot_4`, `slot_7`).

`voiceAppointment` in prod was **not** updated by this call (latest rows are still **Sep 17**). So the **calendar event is the real proof** right now; check **anthony@transovo.ai** Microsoft calendar around the slot you chose (find window was **2026-09-21 12:00–16:00** America/New_York for a 60‑minute service).

---

## Why it asked for phone twice

Backend intake updates (authoritative), in order:

1. **01:47:49** — `book_appointment` **failed** with `MISSING_REQUIRED_INFORMATION` (intake not complete).
2. **01:48:01** — `update_intake` → **`name`**
3. **01:48:39** — `update_intake` → **`phone` + `notes`**
4. **01:48:55** — `update_intake` → **`email`**
5. **01:49:17** — `update_intake` → **`phone` only** (your **number change**)
6. **01:49:35** — `update_intake` → **`mother_s_name`** → intake objective **`COMPLETE`**
7. **01:49:38** — `book_appointment` **succeeded**

So:

- The **first** phone question (and “ask again”) happened because **Amy tried to book at 01:47:49 before any `phone` was saved**. You may have said the number out loud earlier, but **`update_intake` had not run for `phone` yet** until **01:48:39**.
- The **second** phone pass matches your **correction**: the system recorded a **second** `phone` update at **01:49:17**, about **21 seconds before** the successful book. Booking uses `ctx.intake.values.phone` at commit time (`build-create-booking-request.ts`), so the **corrected number should be what went to Microsoft**, not the first one.

Conversational “I already gave you that” did not stop Amy from asking again until tools caught up—**state was empty for book until the updates above**.

---

## Why it asked for mother’s name twice

Logs show **only one** successful `update_intake` for **`mother_s_name`** (at **01:49:35**, which completed intake). There is **no** second backend write for that field.

So the duplicate question was **conversational** (Amy re-asked before/without relying on a completed tool update), not “stored twice” in intake.

---

## Root cause (short)

1. **Premature `book_appointment`** after slot pick but **before** required intake (name/phone/email/mother) → hard `MISSING_REQUIRED_INFORMATION` → more questions.
2. **Gap between speech and `update_intake`** → you can answer in voice while the server still has no `phone` / `mother_s_name`.
3. **Amy re-asks in natural language** even when you push back (“you already have it”) until the matching tool update lands.

---

## What to verify on your side

1. **Microsoft calendar** — event from ~**01:49:40 UTC** on **Sep 21, 2026**, booking attempt `bka_cmual7tho3r3a1h5p111n215l`; confirm **attendee phone/body** matches your **corrected** number (after the change), not the first one.
2. If you want a **full transcript in the app**, we need a **VoiceCall + post-call transcript** wired for LiveKit V3 sessions (this call did not get that row).

---

## Likely fixes (certification / follow-up)

- Return **explicit `missing_required_fields`** on failed book (and block book in prompts until intake complete).
- **Immediately** call `update_intake` when phone/name/mother are spoken (Astra contract + Amy behavior).
- **Persist** LiveKit V3 sessions to `voiceCall`, booking to `voiceAppointment`, and post-call transcript so the next debug does not depend on Docker log scraping.

---

## Intake timeline (log-derived)

| Time (UTC) | Event |
|------------|--------|
| 01:45:35 | Session created, intake keys include `mother_s_name` |
| 01:46:46 | `update_intake` → `service_reason` |
| 01:47:xx | `find_availability` → 7 slots, presented `slot_1`, `slot_4`, `slot_7` |
| 01:47:49 | `book_appointment` **FAILED** — `MISSING_REQUIRED_INFORMATION` |
| 01:48:01 | `update_intake` → `name` |
| 01:48:39 | `update_intake` → `phone`, `notes` |
| 01:48:55 | `update_intake` → `email` |
| 01:49:17 | `update_intake` → `phone` (correction) |
| 01:49:35 | `update_intake` → `mother_s_name`; objective **COMPLETE** |
| 01:49:38–40 | `book_appointment` **SUCCESS**; Microsoft event created |

---

## Data / observability gaps found on this call

- No `voiceCall` record for LiveKit session `JUSYBrzenWLq` in production Postgres.
- No new `voiceAppointment` row for this booking (V3 Microsoft path confirmed in logs only).
- No full transcript in DB for this session from the web app logs window.
