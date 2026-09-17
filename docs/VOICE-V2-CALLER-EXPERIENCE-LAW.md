# Voice V2 — Caller experience law (binding)

**Status:** **LAW** — not guidance. Violations are **bugs**. CI and verify scripts **FAIL** the build.

**Machine anchor:** `src/lib/voice-v2/caller-experience-law.ts`  
**Architecture detail:** `docs/VOICE_V2_CALLER_FIRST_ARCHITECTURE.md`  
**Microsoft FIND/BOOK freeze (separate):** `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

## Enforcement (mandatory)

Every change touching Voice V2 must pass:

```bash
npm run verify:voice-v2-caller-experience-law
```

This runs static guards + `scripts/test-voice-v2-caller-experience-law.ts`. **No merge without PASS.**

Runtime: `voice_v2_save_intake_fields` **rejects** booking-intent-only payloads with `BOOKING_INTENT_CONVERSATION_ONLY` **before** cold `ensureVoiceV2CallContext` (no multi-second block on “I need to book”).

---

## Two layers (do not confuse)

| Layer | What it is | How it is protected |
|-------|------------|---------------------|
| **Front half — caller experience (this law)** | Greeting → conversation → intake → scheduling → only then blocking tools | Verify script + runtime P7 guard + `.cursor/rules/voice-v2-caller-experience-first.mdc` |
| **Back half — booking truth** | FIND, BOOK, Graph, offer set | `verify-microsoft-365-certified-pipeline-frozen.ts` + PSTN re-cert |

Microsoft work **never** relaxes this law. Intake/workflow work **never** rewrites frozen Microsoft FIND/BOOK without PSTN re-cert.

---

## Law 1 — Amy keeps talking

Nothing required for a conversational reply may block TTS except **Law 6** (FIND/BOOK claims). Default operation class: **DEFER** or **PRELOAD** (`VOICE_V2_CALLER_FIRST_ARCHITECTURE.md` §15).

## Law 2 — Answer then greet; preload in parallel

Warmup, config compile, CallContext create, token prefetch, audit, CRM, Postgres mirrors: **concurrent or deferred** — never `await` before answer/first greeting (P10).

## Law 3 — Booking intent is conversational (P7)

Utterances like “I need to book” / “schedule an appointment” / lone `service_reason: "appointment"` when only intent:

- **Spoken ack immediately** from the model (prompt + transcript).
- **No** `voice_v2_save_intake_fields` round-trip to “enter booking mode.”
- Server **rejects** intent-only save tools with `BOOKING_INTENT_CONVERSATION_ONLY` (fast path, no cold context).

## Law 4 — Full live transcript in the agent (P14)

The active call conversation stays available to the model. Structured state gates actions; transcript is memory — no mid-call summary-only replacement without an approved compaction design.

## Law 5 — Collect without stalling

Intake, scheduling preference, corrections, `askedFields`: remember from speech; reconcile on the next legitimate save/FIND/BOOK — not by blocking the caller on first cold context load.

## Law 6 — Only FIND and BOOK block claims (MUST_BLOCK)

| Tool | May block because |
|------|-------------------|
| `voice_v2_find_availability` | Stating real openings |
| `voice_v2_book_offered_slot` (or strategy equivalent) | “You’re booked” after provider success |

No other webhook may hold the line silent for an ack. Observers (linkage, CRM, analytics) **never** `await` inside FIND/BOOK handlers.

## Law 7 — One Amy on PSTN

No General → Live Booking handoff; no second scheduling agent on the one-Amy PSTN path.

---

## Prohibited (always)

- Intent-only `save_intake` that triggers cold `ensureVoiceV2CallContext`
- Fake `service_reason` values whose only meaning is booking intent
- Skipping FIND/BOOK or faking confirmation to “fix” latency
- Synchronous observer work on FIND/BOOK hot paths

---

## Governing sentence

**This law is not optional.** Caller experience is enforced in code and CI; Microsoft Graph is frozen in the certified box. Never trade Law 1–7 for provider convenience.
