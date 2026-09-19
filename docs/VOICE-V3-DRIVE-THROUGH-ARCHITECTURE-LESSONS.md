# Voice V3 — Drive-Through Architecture Lessons (LiveKit pattern, no LiveKit runtime)

**Authority:** Complements `docs/VOICE-V3-INTAKE-OBJECTIVE-REPORT.md`, Survey/BehavioralTask collection pattern, and production tool contracts.

**Governing stack (unchanged):** Caller ↔ GPT-Live/Amy → Astra → Transovo tools/state. GPT-Live owns conversation. Astra selects tools. Transovo stores authoritative state and enforces preconditions.

LiveKit’s drive-through agent is a strong reference for **free-form conversation + partially known structured state + missing information + corrections + multiple actions from one utterance**. We borrow **responsibility patterns only** — we do not install or route through LiveKit.

---

## What drive-through does (and we mirror)

| Layer | Drive-through | Voice V3 |
|--------|----------------|----------|
| Conversation | Model + menu instructions | Amy + business instructions |
| Tool contracts | Strong “do not call until…” descriptions | `astra-tool-contracts.ts` + strict schemas |
| Partial utterances | Ask for drink; no order mutation yet | Amy clarifies; no BOOK until preconditions pass |
| Authoritative write | Executor validates IDs/sizes → `OrderState` | `book_appointment` validates offer/slot/intake → CallContext + Graph |
| One utterance | Two `orderRegularItem` calls | `update_intake` + `find_availability` when appropriate |
| Corrections | `listOrderItems` → `removeOrderItem(id)` | `find_appointment` → `cancel_appointment(appointment_id)` |

There is **no Transovo planner** that chooses Amy’s next sentence. Tool descriptions + objective context + deterministic executors replace that.

---

## Ten architecture rules (locked)

1. **Persistent facts** — name, service reason, configured intake, email *candidate* when clearly spoken → save incrementally via `update_intake` → CallContext.
2. **Temporary operation arguments** — “Tuesday afternoon”, “the second one”, incomplete slot choice → may live in **conversation/Astra context** until sufficient to call `find_availability`, `book_appointment`, etc. Do **not** persist every half-finished scheduling phrase as permanent business state.
3. **Model conversational readiness** — missing BOOK intake → Amy may naturally ask (like “what size?” before `orderRegularItem`). Transovo must **not** emit `NEXT_QUESTION` or intake-triggered conversational `response.create`.
4. **Code authoritative readiness** — even if Astra calls BOOK early, executor returns `MISSING_REQUIRED_INFORMATION`, stale offer set, etc. **Model readiness + deterministic precondition** (both required).
5. **One utterance → zero, one, or many tools** — not 1:1 caller span to tool. When `parallel_tool_calls` is enabled, multiple independent tools from one delegation are valid. When off, tools may serialize across delegations; architecture still allows multiple intents per utterance over time.
6. **Corrections need authoritative IDs** — cancel/reschedule/remove: read (`find_appointment`, list) before mutate when ID unknown. Tool descriptions must say so.
7. **Dynamic tool constraints** — enums from AgentConfig/business data (transfer destinations, configured enum intake fields, service ids where applicable). Prefer constrained action space over free-form strings.
8. **Specialized intake only where domain requires** — ordinary fields: collected/missing. Email-over-voice: candidate/normalized/verified + revision. Scheduling: generation + OfferSet. Do not give every field every lifecycle.
9. **Objective = facts** — INTAKE OBJECTIVE describes known/missing; it does not script Amy.
10. **Certification = full chain** — caller language → delegation → Astra tool selection → arguments → Transovo validation → mutation/read → tool result → continuation → Amy behavior (not isolated “tool executed” unit tests).

---

## Intake Objective simplification (amendment)

Previous design listed five statuses for every field. **Amended:**

| Field kind | Objective display | Completion rule |
|------------|-------------------|-----------------|
| Standard (`standard`) | `missing` \| `collected` | Usable value in CallContext |
| Voice email (`voice_email` + verification) | `missing` \| `candidate` \| `verified` | `verified` when verification required; else `collected` |
| Optional specialized (phone/address/date) | Same as standard unless config enables verification |

Do not expose CANDIDATE/VERIFIED in objective text for fields that do not use verification.

---

## BOOK as “orderComboMeal”

Semantic: Astra believes slot + intake are sufficient → `book_appointment(offer_set_id, slot_id)`.

Deterministic executor checks independently:

- Offer set current for scheduling generation
- Slot in offer set
- `getMissingFieldsForOperation("book_appointment", …)`
- Calendar connected, idempotency, provider path

FIND is analogous to searching the menu — may run with **empty** booking intake when policy allows.

---

## Certification matrix (target)

Structure tests like drive-through integration tests:

| Scenario class | Example |
|----------------|---------|
| Missing component | No email → no BOOK; Amy may ask; no corrupt state |
| Complete → tool | All intake + slot → BOOK |
| Multi-intent utterance | Name + email + Tuesday → intake + FIND (when policy allows) |
| Correction | Wrong appointment → find → cancel/reschedule with real id |
| Invalid data | Bad email rejected; partial success on multi-field intake |
| Tool failure | Stale offer → FIND again; no fake success |
| Cross-turn memory | Drink size in turn 2 completes combo started in turn 1 (scheduling preference analog) |

Scripts: `test-voice-v3-astra-intake-cert.ts`, `test-voice-v3-astra-tool-selection.ts`, closed-loop multiturn, future PSTN conversational cert.

---

## Related docs

- `docs/VOICE-V3-INTAKE-OBJECTIVE-REPORT.md` — implementation report
- `docs/VOICE-V3-PRODUCTION-AGENT-COMPLETION-REPORT.md` — tool registry
- `.cursor/rules/voice-v3-agent-architecture.mdc` — mandatory before Voice V3 changes
