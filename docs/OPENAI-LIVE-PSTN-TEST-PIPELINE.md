# OpenAI Live (GPT-Live-1) — isolated PSTN test pipeline

**Purpose:** Tune **when Amy is allowed to speak** on GPT-Live before wiring booking delegation. Not Microsoft FIND/BOOK, not Voice V2 tool orchestration.

**Runtime switch:** `VOICE_AI_TRANSPORT=openai_live`, repo `.voice_ai_transport`, or `/app/.voice_ai_transport`. See `flags.ts`.

**Config source:** `src/lib/voice/telnyx/openai-realtime-bridge/live-config.ts` (`OPENAI_LIVE_FRONTEND_INSTRUCTIONS`, `OPENAI_LIVE_GREETING_LINE`).

**Test-only server update (no master deploy):** `./scripts/prod-voice-bridge-hotpatch.sh --config-only`

---

## Why Live is different from Realtime

GPT-Live **continuously** decides many times per second whether to speak, listen, pause, interrupt, or acknowledge. It is **not** rigid user-turn → assistant-turn.

The public Live session API does **not** expose Realtime-style VAD knobs (`threshold`, `silence_duration_ms`, `semantic_vad` eagerness, etc.). Shape tone, pace, and **when to talk** through **`session.start` instructions** only. Do not invent VAD parameters for Live in the bridge.

Live stays **full-duplex** (good for barge-in, corrections, hesitation). The business dialogue should **feel turn-based**: Amy asks → **stops** → caller answers → Amy responds briefly.

---

## Frontend prompt design (current baseline)

- **Small and strict** — not the old giant Realtime/V2 system prompt.
- **Turn-based receptionist policy** — one question per turn; **wait indefinitely** after a question; **never fill silence**.
- **Minimal acknowledgments** — no mm-hmm / yeah while caller speaks; no “I’m still here”, “take your time”, “no rush”, “whenever you’re ready”.
- **Yield immediately** if caller speaks over Amy (prefer interrupting Amy over talking over the customer).

**Do not put in the Live frontend (yet):**

- Booking state machine, required fields, Microsoft/Graph, availability logic
- Wording like: maintain flow, keep engaged, don’t leave awkward silence, reassure the caller, keep conversation moving, make natural acknowledgments

Those phrases push Live toward **KEEP TALKING**.

**Delegation / backend (later):** required fields, FIND/BOOK, validation — `delegation.responses.instructions` once speech behavior passes tests. Current isolated bridge has **no tools**.

---

## Technical defaults (boring on purpose)

| Setting | Value |
|---------|--------|
| Model | `gpt-live-1` |
| Audio | `audio/pcmu` @ 8000 Hz (Telnyx μ-law pass-through) |
| Voice | `marin` (or env `OPENAI_LIVE_VOICE`) — fix one voice while tuning behavior |

---

## Greeting

Use a **short** scripted greeting via `OPENAI_LIVE_GREETING_LINE`, then silence:

> Thanks for calling. This is Amy. How can I help you?

Avoid long virtual-receptionist monologues before the first question.

---

## Primary manual test (do this before booking copy)

With `openai_live` active:

1. Let Amy greet you.
2. **Do not answer for ~10 seconds** → she should say **nothing**.
3. Answer her question.
4. Let her ask the next question.
5. Stay silent again → she should say **nothing**.
6. Start speaking while she is talking → she should **yield immediately**.

If that passes, add booking-specific **frontend** snippets (still not the full state machine).

---

## Long silence / “Are you still there?”

Do **not** ask Live to decide when silence is “too long.”

**Future app rule (not in prompt yet):** after Amy asks a question, start a server timer (e.g. 12s); if no caller audio, inject one instruction: briefly check if the caller is still on the line — **once**.

---

## Extended matrix (after primary test)

| # | Scenario |
|---|----------|
| 1 | Music / TV / dog / cough — no response |
| 2 | Someone else talks nearby — wait |
| 3 | Mid-sentence pause 1–2s — keep listening |
| 4 | Interrupt + self-correct (“Tuesday—no, Wednesday”) |
| 5 | Several facts in one breath — remember, don’t re-ask |

---

## Cursor rules

1. Edit **`OPENAI_LIVE_FRONTEND_INSTRUCTIONS`** in `live-config.ts` for Live speech behavior — not `instructions.ts` (Realtime/V2) unless switching transport.
2. No Realtime VAD env vars for Live.
3. Hot-patch test container: `--config-only` for prompt/greeting only.
