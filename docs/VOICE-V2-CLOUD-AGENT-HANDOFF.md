# Voice V2 — context handoff for new Cloud Agent

You are taking over an existing Voice V2 implementation. You do **not** have prior conversation context; treat this document as current source of truth.

**Related:** Coolify deploy workflow → `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md` · SSH alias `coolify-server` · push `master` triggers deploy · task is not done until build + production verify.

**Production snapshot (2026-09-16):** GitHub `master` @ `3ed1e46f1dfd1942ae3a395a18512967789b2377` deployed to Coolify apps `ds8s3hjin60qs6g7s0iqkixs` (web) and `tgjridm6vrmrgljkfrr0rpjn` (scheduler). `/api/health` `commitSha` matches. Re-verify on every session.

---

## Current goal

Finish a **minimal production-ready one-Amy PSTN booking flow**.

Architecture decision (locked):

- **ONE Amy** for the entire call
- No conversational handoff General → Booking
- Booking is a **capability** of the same Amy, not a second agent/node
- Keep the live-call surface as small as possible — if a component can be removed and Amy still completes the call correctly, it should not be on the live path

---

## Core architecture rules

- one Amy · one continuous conversation · one transcript
- no second scheduling LLM · no semantic regex routing · no General → Booking node handoff
- caller experience first · nonessential work asynchronous
- only block when external truth is required for the next truthful spoken response
- use speaking time as compute time where possible
- structured state authoritative for actions · transcript is conversational memory
- never re-ask known information · latest explicit caller correction wins
- smallest possible live-call surface
- fix observed real bugs only; do not pre-build extra architecture

---

## What already works (PSTN-proven)

1. **One Amy** — no booking handoff; one thread  
2. **Booking intent** — e.g. “I need to book an appointment.” → “Absolutely. What day works best for you?” (~839 ms PSTN, zero tools, no fake intake, no handoff)  
3. **Intake** — name + service together (e.g. Anthony Johnson + leak in kitchen)  
4. **FIND** — `voice_v2_find_availability`, Graph calendarView, offer-set flow  
5. **BOOK** — `voice_v2_book_offered_slot`, canonical offer_set_id + slot_id, one Graph POST, `BOOKING_CONFIRMED`, Amy confirms after provider success  
6. **Microsoft** — Graph availability + CREATE; timezone serializer fixed — **frozen** unless absolutely necessary  
7. **Shared call state** — Phase 2A CallContext (L1/L2, versioning, session identity, lifecycle, pinned config) — **do not redesign**  
8. **Warmup** — background warmup, L2 ready before tools — **do not redesign**

---

## Current tool set

Reuse only:

- `voice_v2_save_intake_fields`
- `voice_v2_find_availability`
- `voice_v2_book_offered_slot`

Do not add tools unless the real flow truly requires one.

---

## Prompt layers

- **Layer A** — static core (`src/lib/voice-v2/one-amy/amy-core-static-prompt.ts`)
- **Layer B** — wizard/business injection (existing)
- **Layer C** — runtime/session context
- **Layer D** — tool definitions

Do not invent a new prompt architecture.

---

## Most recent real PSTN result (before `3ed1e46`)

Successful end-to-end booking after caller repeated “tomorrow.”

**Wrong behavior observed:**

- After “tomorrow”, `voice_v2_save_intake_fields` ran with empty `fields` + scheduling metadata on save tool
- Amy re-asked day despite “tomorrow” already said
- FIND/BOOK path eventually succeeded after caller said “tomorrow” again

---

## Latest fix (`3ed1e46` — verify deployed)

Intended behavior:

1. Date-only utterances are **not** intake saves  
2. `scheduling_preference` / `booking_intent_active` removed from save tool schema  
3. Date preference in `bookingPreference` / CallContext (L2)  
4. After missing intake collected → **FIND** for remembered day without re-ask  
5. Corrections: “Actually Wednesday.” → Wednesday wins  

Headless: `scripts/test-voice-v2-scheduling-preference-headless.ts`

**Always verify** `origin/master`, Coolify queue, running image tag, and `/api/health` `commitSha` — do not assume deploy state.

---

## Important requirement: generic intake memory (including custom wizard fields)

Memory is **not** only name/phone/email/service/date.

Wizard **custom** intake variables (e.g. `mothers_name`) must behave like built-ins:

- If the caller already provided a value for any **enabled configured** field → **known** → do not ask again unless unclear, validation failed, or caller corrected  
- Multiple fields in one utterance → capture all  
- Latest explicit correction wins  

Mental model: wizard schema → dynamic enabled fields → caller values → known state → never re-ask known fields.

Use existing intake schema + CallContext; **no parallel custom-field system**.

**Repo reality (audit):** Voice V2 intake today compiles **five built-in keys** (`name`, `email`, `phone`, `address`, `service_reason`) in `src/lib/voice-v2/intake/wizard-config.ts`. Arbitrary wizard rows live in receptionist `callerFields` / `fieldManifest` but are **not** yet wired into V2 save/validate/readiness — `validateIntakeFieldPayload` ignores unknown keys. Extending schema compile + tool JSON + validation for enabled custom keys is the expected **next minimal implementation** when PSTN confirms scheduling fix.

---

## Design principle

Before adding anything: *“Can Amy still complete the call correctly without this?”* If yes, do not add it. Prefer simplify/remove over new routers, agents, state machines, queues, or sync persistence.

---

## Off the live critical path

Do not make the caller wait on CRM, analytics, audit, transcript persistence, VoiceCall linkage, appointmentBooked bookkeeping, nonessential DB writes, post-call reconciliation, metadata enrichment.

Truth boundaries for booking: **FIND** before speaking slots · **BOOK success** before “you’re booked”.

---

## Frozen — do not modify casually

- FIND / BOOK business logic, offer-set semantics  
- Microsoft calendarView + Graph CREATE + timezone serializer  
- Phase 2A L1/L2 CallContext architecture  
- Warmup architecture  
- One-Amy workflow graph  

Stop and explain before changing any of the above. See also `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`.

---

## Cloud Agent: SSH + Coolify

See `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`.

After every `master` push: correlate `git rev-parse HEAD` → Coolify `application_deployment_queues` → new container image tag → `/api/health` → runtime logs. Fix build/runtime from server logs; do not stop at “pushed to GitHub.”

---

## Workflow from now on

1. Inspect `origin/master` and deployed commit  
2. Confirm whether the fix under test is live  
3. Inspect: dynamic intake/custom fields, known-field tracking, `bookingPreference`, one-Amy prompt/tool schema  
4. Determine if generic never-re-ask works for **all** enabled fields  
5. If not → smallest change using existing schema/state  
6. Smallest relevant headless tests  
7. One coherent commit to `master`  
8. Watch Coolify build/deploy on server  
9. On green → **STOP** and report ready for PSTN test  

---

## Acceptance behavior

| Scenario | Expected |
|----------|----------|
| Name given once | No re-ask for name |
| Name + issue in one line | Both remembered |
| “Tomorrow.” | Remembered; FIND after intake without day re-ask |
| “Tomorrow.” then “Actually Wednesday.” | Wednesday wins |
| Custom field `mothers_name` = Patricia | Never ask “What is your mother's name?” later |
| Multiple custom fields in one utterance | All recognized enabled fields become known |

---

## Code map (intake / state)

| Concern | Location |
|---------|----------|
| Wizard intake config (built-in keys) | `advanced.voiceV2Intake` · `src/lib/voice-v2/intake/wizard-config.ts` |
| Compile enabled fields | `src/lib/voice-v2/intake/compile-schema.ts` |
| Known values | `VoiceV2CallContext.intakeState` · `src/lib/voice-v2/intake/types.ts` |
| Missing / satisfied | `getIntakeReadiness()` · `src/lib/voice-v2/intake/readiness.ts` |
| Save tool + scheduling fast path | `src/lib/voice-v2/intake/save-intake-fields.ts` · `scheduling-preference.ts` |
| Telnyx tool schema | `src/lib/voice-v2/telnyx-tool-definition.ts` |
| L2 record + `bookingPreference` | `src/lib/voice-v2/session/call-context-store.ts` · `session/types.ts` |
| Live prompt intake block | `src/lib/voice-v2/intake/live-intake-instructions.ts` |
| Legacy custom caller rows (wizard) | `receptionistAdvanced.callerFields` · `field-manifest.ts` |

---

## First action checklist (every new session)

Report:

1. Current `master` commit  
2. Whether target fix commit is deployed (Coolify + `/api/health`)  
3. Coolify deployment status (apps 1 + 2 for this repo)  
4. Where custom wizard fields are defined vs what V2 intake compiles  
5. Where known values live in CallContext  
6. Whether never-re-ask is generic or hardcoded (built-ins only today)  
7. Smallest change required, if any  

Then implement only what is still missing; push once; monitor Coolify; stop for PSTN when green.
