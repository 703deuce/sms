# Voice V2 — Caller experience non-negotiables (permanent)

**Status:** **LOCKED product law** — applies to every Voice V2 change, forever, independent of provider freeze (Microsoft, Calendly, etc.).

**Full architecture:** `docs/VOICE_V2_CALLER_FIRST_ARCHITECTURE.md`  
**Provider back-end freeze (Microsoft FIND/BOOK only):** `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

---

## Two layers (do not confuse)

| Layer | What it is | How we protect it |
|-------|------------|-------------------|
| **Front half — caller experience** | Greeting → conversation → intake → scheduling talk → only then tools that must block | **This document** + `.cursor/rules/voice-v2-caller-experience-first.mdc` |
| **Back half — booking truth** | FIND availability, BOOK provider CREATE, offer set integrity | Frozen Microsoft box + PSTN re-cert on that box only |

Shipping a Microsoft fix **never** relaxes front-half rules. Shipping intake or workflow work **never** rewrites frozen Microsoft FIND/BOOK without explicit PSTN re-cert.

---

## Customer experience first — always

1. **Amy keeps talking.** Nothing required for a conversational reply may block TTS on the critical path except the two truth actions below.
2. **Answer → greet immediately.** Warmup, config compile, CallContext create, token prefetch, audit, CRM, and Postgres bookkeeping run **concurrent or deferred** — never `await` before answer/first greeting (P10).
3. **Booking intent is conversational.** Utterances like “I need to book” / “schedule an appointment” get an immediate natural ack. **No** Transovo HTTP tool **solely** to enter booking mode (P7). No fake `service_reason` saves for intent phrases.
4. **Full live transcript stays in the agent.** Default: entire call conversation remains available to the model for the session (P14). Structured state is for **action authority**; transcript is for **memory and recovery** — not a substitute for blocking the caller.
5. **Collect without stalling.** Intake fields, scheduling preferences, corrections, and `askedFields` may be remembered from speech first; persist and reconcile on the **next legitimate** save/FIND/BOOK — not by freezing the caller on cold context load.
6. **Default latency class is defer.** Audit, metadata, linkage, analytics, post-call reconcile, intake Postgres mirror → `DEFER_AFTER_RESPONSE` or `DEFER_AFTER_CALL` unless explicitly classified otherwise in caller-first architecture §15.

---

## Only two synchronous caller-visible waits (MUST_BLOCK claims)

Block the **claim**, not all speech:

| Action | Caller may wait because |
|--------|-------------------------|
| **FIND** (`voice_v2_find_availability`) | Stating real openings requires provider truth |
| **BOOK** (`voice_v2_book_offered_slot` or strategy equivalent) | Saying “you’re booked” requires provider CREATE success |

Everything else — including first-time CallContext build, config load, intake validation, workflow transitions, and observer hooks — must **not** hold the line silent while the caller waits for an ack.

Ack/hold **before** FIND may use documented Telnyx transport (filler, speak-then-tool) per P6 — not an undeclared blocking save.

---

## Prohibited regressions (any PR)

- Requiring `voice_v2_save_intake_fields` (or any webhook) **only** because the caller expressed booking intent
- `await ensureVoiceV2CallContext` / full agent config compile on the **first** conversational turn when warmup could have run at answer
- Replacing transcript memory with summary-only mid-call without an explicit approved compaction design
- Moving observer work (linkage, CRM, analytics) **into** FIND/BOOK HTTP handlers synchronously
- Reintroducing General → Live Booking handoff or second scheduling agent on PSTN one-Amy path
- “Fixing” latency by skipping FIND/BOOK or faking confirmation — fix deferral and preload instead

---

## Certification expectation (whole call)

Microsoft PSTN cert proves **booking truth**. **Whole-pipeline** acceptance additionally requires:

- `BOOKING_MODE_ENTRY_TOOL_CALLS === 0` on utterance-only booking intent (P7)
- No caller-visible stall from cold intake/context on that turn
- Intake and scheduling memory match transcript (no gratuitous re-ask)
- FIND/BOOK still meet `KNOWN_GOOD_BASELINE` regression rubric

Until automated gates exist, treat any PSTN call trace that shows `save_intake` before first spoken ack on pure booking intent as **FAIL** against this document — even when BOOK succeeds.

---

## Governing sentence

**Caller experience is frozen in principle; Microsoft Graph is frozen in code.** Never trade the first for the second.
