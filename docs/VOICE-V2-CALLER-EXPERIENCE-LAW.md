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

---

## Appendix — full rule catalog

**Machine index:** `src/lib/voice-v2/caller-experience-law.ts` (`VOICE_V2_CALLER_EXPERIENCE_RULE_CATALOG`).  
**Authoritative prose:** caller-first architecture (P1–P19), after-hours contract, Step 1 intake, cloud handoff, Layer A prompt.

| ID | Requirement (summary) | Primary source | Enforcement |
|----|------------------------|----------------|-------------|
| **LAW-1** | Amy keeps talking; default DEFER/PRELOAD | Law §1 · caller-first §15 | Warmup 2B headless |
| **LAW-2** | Answer → greet; preload concurrent | P10 | `inbound.ts` + warmup headless |
| **LAW-3** | Booking intent conversational; fast reject save | P7 · `save-intake-fields.ts` | Runtime + law unit test |
| **LAW-4** | Full live transcript to model | P14 · after-hours §4 | Prompt + PSTN review |
| **LAW-5** | Collect without cold-context stall | P7b · P9 | Scheduling preference headless |
| **LAW-6** | MUST_BLOCK = FIND/BOOK only; observers non-blocking | Law §6 | Certified routes `void` audit |
| **LAW-7** | One Amy; no `n_live_booking` handoff | P5 · workflow | One-Amy headless |
| **P1** | L1+L2 CallContext; safe reconstruct | Architecture P1 | `test-voice-v2-call-context-2a.ts` (release) |
| **P2** | `stateVersion` optimistic concurrency | P2 | Call-context 2A gate |
| **P2b** | Class A vs B L2 writes | P2b | Runtime patch contract |
| **P2c** | `patchVoiceV2CallContext` CAS | P2c | Call-context 2A |
| **P3** | Token inspect; distributed single-flight refresh | P3 | Warmup + token-readiness |
| **P4** | No duplicate business knowledge blob | P4 | Compile/prompt review |
| **P5** | One Amy; runtime tool authorization | P5 | One-Amy headless |
| **P6** | Document Telnyx transport before ack hacks | P6 | `VOICE_V2_TELNYX_TRANSPORT.md` when present |
| **P7** | Zero tool calls to enter booking mode | P7 | Runtime + One-Amy + prompt |
| **P8** | `askedFields` Class B | P8 | Step 1 / whole-call memory suites |
| **P9** | `bookingPreference` in session | P9 | Scheduling preference headless |
| **P10** | Warmup never before answer/greet | P10 | Warmup 2B + static inbound guard |
| **P11** | Warmup abort on hangup | P11 | `call-warmup.ts` + 2B tests |
| **P12** | Queue isolation REALTIME vs BACKGROUND | P12 | Durable worker certs (release) |
| **P13** | FIND single-flight; BOOK idempotent | P13 | Certified Microsoft pipeline |
| **P14** | Full transcript default | P14 | Prompt / maturity headless |
| **P15** | Phased implementation order | P15 | Process — no skip to BOOK rewrite |
| **P16** | Enrollment snapshot on L2 miss | P16 | Call-context 2A |
| **P17** | Offer set durable + L2 ref | P17 | Certified boundary + BOOK |
| **P18** | Phase 2A acceptance gate | P18 | `test-voice-v2-call-context-2a.ts` |
| **P19** | Phase 2B pickup metrics gate | P19 | Warmup 2B headless |
| **AH-ONE-AMY** | One Amy, one transcript | After-hours §3 | One-Amy headless |
| **AH-SMALL-SURFACE** | Smallest live-call surface | After-hours §2 | Architecture review |
| **AH-TRUTH** | No fabricated booking/consent facts | After-hours truth boundaries | PSTN + BOOK gate |
| **AH-NO-REASK** | Remember asked/collected fields | After-hours §4+ | Step 1 + scheduling suites |
| **STEP1-DEFER-PERSIST** | Defer durable intake until BOOK path | `VOICE_V2_STEP_1_INTAKE.md` | Step 1 headless |
| **STEP1-BOOK-GATE** | BOOK blocked until intake gate satisfied | Step 1 | Step 1 headless |
| **METRIC-BOOKING-MODE-ENTRY-0** | Intent utterance → 0 booking-entry tools | Architecture certification table | One-Amy + PSTN |

### CI gate (mandatory)

```bash
npm run verify:voice-v2-caller-experience-law
```

Runs static guards plus: law unit test, one-Amy, Step 1 intake, scheduling preference, warmup Phase 2B, certified boundary. **GitHub `CI` workflow must run this on every push/PR to `master`.**

### Changing the law

1. Edit this document and the machine catalog in `caller-experience-law.ts`.  
2. Add or extend headless coverage in `verify-voice-v2-caller-experience-law.ts`.  
3. PSTN-affecting behavior → manual smoke per `docs/VOICE-V2-PRE-MANUAL-REGRESSION.md`.
