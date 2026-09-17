# VOICE_V2_KNOWN_GOOD_BASELINE (locked)

**Status:** Production-certified after PSTN rollback (~2026-09-15).  
**Do not weaken this baseline when adding intake, linkage, or CRM.**

## Two layers (whole call vs Microsoft back half)

| Layer | Locked how | Document |
|-------|------------|----------|
| **Caller experience (greeting → conversation → intake → scheduling talk)** | **LAW** — CI verify + runtime P7 reject; non-blocking by default; full transcript; only FIND/BOOK block claims | `docs/VOICE-V2-CALLER-EXPERIENCE-LAW.md` · `npm run verify:voice-v2-caller-experience-law` |
| **Microsoft booking truth (FIND/BOOK/Graph)** | **Git + file freeze** at `06125f5f` / `pipelines/microsoft-365-certified/` | This file · `scripts/verify-microsoft-365-certified-pipeline-frozen.ts` |

“This baseline” means the **Microsoft back half** unless a doc explicitly certifies the whole PSTN journey. Never satisfy Microsoft freeze by regressing caller-experience rules.

## Git anchor

| Field | Value |
|--------|--------|
| **Commit** | `06125f5fb6be3850e9e93314901067d1a4c2fa32` |
| **Subject** | `fix(microsoft): serialize Graph events as local wall + Windows timezone` |
| **Includes** | V2 FIND + BOOK primitives, offer-set store, PSTN traces, Graph datetime fix |
| **Explicitly excludes** | Step 0.5 synchronous call linkage on FIND/BOOK (`e2c3e94a`, `b9641a5c` — reverted) |

Certify locally: `npx tsx scripts/certify-voice-v2-known-good-baseline.ts`

## PSTN proof reference (12:03 UTC call)

| Gate | Result |
|------|--------|
| FIND `WEBHOOK_TOTAL_MS` | **~1,969** (~2 s) |
| Pre-Microsoft stall | **~3 ms** (validation marks) |
| Token / Graph / compute | **~125 / 375 / 135 ms** |
| Amy receives slots | **PASS** (tool JSON + spoken list) |
| BOOK | **BOOKING_CONFIRMED**, Graph **201** on `/me/events` |
| Timezone | **1:00 PM Pacific** → correct UTC on `VoiceAppointment` |
| `voice_ai_booking_turn` | **0** |
| Second scheduling LLM | **0** |

Offer: `v2offer_cmu2mi5831b0o066m2k1a4w5l` · Appointment: `cmu2miixz4k103o4b2x2z0k6d`

## Frozen surface (do not modify without baseline re-certification)

**Architecture:** `docs/VOICE-V2-CERTIFIED-PIPELINE-ISOLATION-RULE.md` — Microsoft is a sealed vertical slice; dumb selector only above it.

Known-good **Microsoft PSTN** implementation (copy of `06125f5f` FIND/BOOK):

- `src/lib/voice-v2/pipelines/microsoft-365-certified/find-availability.ts`
- `src/lib/voice-v2/pipelines/microsoft-365-certified/book-offered-slot.ts`
- `src/app/api/telnyx/voice-v2/find-availability/route.ts` (calls certified module only)
- `src/app/api/telnyx/voice-v2/book-offered-slot/route.ts` (calls certified module only)
- `scripts/verify-microsoft-365-certified-pipeline-frozen.ts`

Shared Telnyx response/tool definitions (`telnyx-response.ts`, `telnyx-tool-definition.ts`) are outside the booking box. Legacy `src/lib/voice-v2/find-availability.ts` / `book-offered-slot.ts` are **not** the certified Microsoft path.

Telnyx: shared tools `transovo-voice-v2-find-availability`, `transovo-voice-v2-book-offered-slot`, `transovo-voice-v2-save-intake-fields` — schema and webhook URLs per `scripts/publish-voice-v2-telnyx-tool.ts` / `scripts/enable-amy-voice-v2-pstn-test-mode.ts`.

## Step 1 additive extensions (allowed without re-baselining FIND)

These are **thin** intake layers; FIND path must remain unchanged.

| Area | File | Change |
|------|------|--------|
| Pre-book gate | `book-offered-slot.ts` | After slot revalidation, before `insertMicrosoftEvent`: `evaluateBookingIntakeGate` → `MISSING_REQUIRED_FIELDS` (0 Graph creates) |
| Event notes | `book-offered-slot.ts` | Optional `formatIntakeEventNotes` in event `description` only |
| Book Telnyx copy | `telnyx-book-response.ts` | `MISSING_REQUIRED_FIELDS` speakable response |
| Intake tool | `src/lib/voice-v2/intake/*`, `save-intake-fields/route.ts` | In-memory save + deferred persist — **not** on FIND |

Certify Step 1 headless: `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-step1-intake-headless.ts`

## Regression rubric (every V2 change)

| Check | Target |
|--------|--------|
| FIND backend (PSTN or direct) | **~1–3 s** typical; investigate if **> 4 s** without Graph outage |
| Amy receives real slots | Tool result includes `offer_set_id` + slots; Amy speaks them |
| BOOK | Exactly **one** Microsoft event per successful book |
| Date / time / timezone | Matches business local wall + `America/Los_Angeles` (or workspace TZ) |
| Amy confirms book | **Only after** `BOOKING_CONFIRMED` / Graph success |
| Legacy `voice_ai_booking_turn` on V2 path | **0** |
| Second scheduling LLM | **0** |

## Bookkeeping gap (intentional at this baseline)

Not required for caller success; **must not** be fixed by blocking FIND/BOOK again:

- `VoiceAppointment.callId` may be **null**
- `VoiceCall.appointmentBooked` may be **false**
- `VoiceCall.telnyxConversationId` may be **null**

## Future linkage / CRM / audit — observer only

```
Caller → FIND → slots → BOOK → Microsoft 201 → Amy says booked
                              └── async (retry/idempotent):
                                    link VoiceAppointment → VoiceCall
                                    set appointmentBooked
                                    persist telnyxConversationId
                                    audit / analytics
```

**Rule:** No `await` on observer work in FIND/BOOK HTTP handlers.  
**Default latency class:** `DEFER_AFTER_BOOKING` or `DEFER_AFTER_RESPONSE` (see intake Step 1 design).

Step 0.5 must **not** be reintroduced as synchronous machinery on the availability path.

## Step 1 intake (next)

Configurable intake fields: collect in conversation; persist **async** or post-turn.  
Never block FIND/BOOK on multi-table CRM writes or field validation round-trips.
