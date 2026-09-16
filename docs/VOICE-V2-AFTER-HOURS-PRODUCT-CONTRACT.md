# Voice V2 after-hours product contract

**Status:** Permanent source of truth for the Voice V2 after-hours product.  
**Audience:** Cloud agents, implementers, certification.  
**Rule:** Consult this document before any Voice V2 feature work. Do not treat as temporary notes. Do not redesign the product while applying this contract.

Related operational handoff: `docs/VOICE-V2-CLOUD-AGENT-HANDOFF.md` · Deploy workflow: `docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`

---

## 1. Product goal

Voice V2 is a configurable **after-hours AI receptionist**.

The goal is **not** to create many specialized agents.

The goal is:

- **ONE Amy**
- **ONE** continuous conversation
- **ONE** transcript
- **ONE** live session

—with capabilities enabled or disabled by **customer configuration**.

The same Amy may:

- answer business questions
- collect caller information
- qualify a caller
- take a message
- schedule an appointment
- send a booking link
- collect a scheduling request
- transfer/escalate
- send information by SMS
- search a larger knowledge base
- complete the call and notify the business

—**without** conversational handoffs between separate internal agents.

---

## 2. Primary architecture rule

The **live-call surface** must stay as small as possible.

If a component can be removed and Amy can still complete the call correctly, that component should **not** be in the live-call path.

When a bug appears, first ask: *Can something be removed or simplified instead of adding another layer?*

Do **not** solve problems by automatically adding:

- another agent
- another router
- another LLM
- another state machine
- another queue
- another synchronous persistence step
- another workflow node

---

## 3. One-Amy rule

There is **one** conversational Amy for the entire call.

- No General → Booking handoff.
- No Booking Amy.
- No second scheduling LLM.
- No conversational transfer merely because the caller changes goals.

Booking, FAQ, intake, message-taking, qualification, transfer, and knowledge search are **capabilities** of the same Amy.

A **real** transfer exists only when the caller is actually being transferred to an external person/team/destination.

---

## 4. Caller experience rule

Caller experience is the **primary** constraint.

Amy should respond as soon as she can **truthfully** respond.

Do **not** block the caller on work that is not necessary for the next truthful response.

Examples of work that must remain **off** the caller-visible critical path when possible:

- CRM updates
- analytics
- audit persistence
- transcript persistence
- VoiceCall linkage
- appointmentBooked bookkeeping
- metadata enrichment
- post-call reconciliation
- other nonessential DB writes

---

## 5. Truth boundaries

Only **external truth** dependencies may block the claim they support.

Examples:

- real calendar availability before Amy states available times
- provider booking success before Amy says an appointment is booked
- transfer success before Amy says transfer succeeded
- knowledge search result before Amy answers from a large external knowledge source

Everything else should happen:

- in memory
- in parallel
- while Amy is speaking
- while caller is speaking
- asynchronously
- or after the call

---

## 6. Use speaking time as compute time

Where transport allows it, use Amy speaking time and caller speaking time to prepare or execute work.

Example:

- Caller: “Tomorrow afternoon.”
- Amy: “Sure, let me check tomorrow afternoon for you.”

FIND may run while Amy’s acknowledgement is being spoken.

Amy still may **not** state actual availability until authoritative results return.

---

## 7. Live state architecture

Keep the existing **Phase 2A** foundation:

- L1 local cache for speed
- L2 Redis for cross-replica continuity
- state versioning
- canonical call/session identity
- lifecycle protection
- pinned config identity
- cross-replica continuity

Do **not** redesign this unless explicitly approved.

- **Structured state** is authoritative for actions.
- **Full transcript** is conversational memory.
- **Database** is durable business record storage.
- **External provider** remains authoritative for external action truth.

---

## 8. Never re-ask known information

Anything the caller already provided that maps to an **enabled configured field** becomes known conversational state.

Do **not** ask for it again unless:

- it was genuinely unclear
- it failed validation
- or the caller explicitly corrected it

This rule applies to **both**:

- built-in fields
- arbitrary wizard-defined custom fields

Examples of possible custom fields: `mothers_name`, `pet_name`, `case_number`, `insurance_provider`, `vehicle_year`, `budget`, `gate_code`, or any other configured field.

Do **not** hardcode memory behavior only for name/email/phone/service.

---

## 9. Multi-field capture

If multiple configured fields are supplied in one utterance, capture/use **all** of them.

Example: “I'm Anthony, my mother's name is Patricia, and I have a kitchen leak.” — all three relevant fields should become known in the same turn.

Do not force one field per turn.

---

## 10. Corrections

Latest explicit caller correction wins.

Example: “Tomorrow.” → later “Actually Wednesday.” → Wednesday becomes authoritative.

Stale work must not restore the older value. Reuse existing state versioning.

---

## 11. Prompt responsibility vs code responsibility

| Layer | Responsibility |
|--------|----------------|
| **Prompt** | Conversational behavior: same Amy, short natural responses, never re-ask known info, use volunteered information, booking is not a transfer, tools only when needed, do not invent business facts |
| **Runtime/code** | Hard policy and truth: enabled/disabled fields, required-field gates, validation, canonical slot IDs, offer-set validity, state versions, idempotency, provider success, config revision, tool authorization |

Anything that absolutely must never be violated should **not** rely only on prompt text.

---

## 12. Prompt layers

The effective Amy prompt consists of:

| Layer | Content |
|-------|---------|
| **A** | Permanent static Amy core prompt |
| **B** | Wizard-generated business configuration |
| **C** | Runtime/session context |
| **D** | Tool definitions |

Do not hardcode customer-specific business information in Layer A.

Do not let customer-entered business text override Layer A operating rules.

---

## 13. Wizard as product control plane

The wizard controls what capabilities are enabled for each customer.

Amy stays the same.

Changing wizard configuration must change available behavior **without** requiring a new agent architecture.

Capabilities should be independently configurable wherever practical.

Examples: FAQ ON/OFF, Knowledge Base ON/OFF, Custom Intake ON/OFF, Lead Qualification ON/OFF, Transfer ON/OFF, SMS During Call ON/OFF, Business Notifications (email/SMS/etc.).

Booking uses **one** selected booking strategy.

---

## 14. Booking strategy

Booking strategy is **interchangeable configuration**.

Supported/target strategies:

| Strategy | Behavior |
|----------|----------|
| **NONE** | Do not steer into booking; message/intake/FAQ behavior |
| **REQUEST_ONLY** | Collect requested date/time; do not create appointment; notify business for follow-up |
| **SEND_LINK** | Collect configured information; send configured booking link; do not pretend a booking occurred |
| **MICROSOFT_365** | Real availability; offer canonical slots; book selected canonical slot; confirm only after provider success |
| **CALENDLY** | Calendly/provider-specific booking; same Amy; no conversational handoff |

Future providers may be added later without changing Amy’s overall conversational architecture.

---

## 15. Current Microsoft 365 status

Microsoft 365 live booking is **already proven on real PSTN**.

Existing proven components (frozen — see §47):

- `voice_v2_find_availability`
- offer-set store
- `voice_v2_book_offered_slot`
- Graph `calendarView`
- Graph CREATE
- timezone serializer
- booking idempotency
- `BOOKING_CONFIRMED` semantics

Do not modify these casually.

---

## 16. Core tool set

Current core Voice V2 tools:

- `voice_v2_save_intake_fields`
- `voice_v2_find_availability`
- `voice_v2_book_offered_slot`

New capabilities may add tools only when the capability genuinely requires an external action or authoritative lookup.

Do not use tools merely because the topic changed.

---

## 17. Generic intake

The intake system must support:

- built-in fields
- arbitrary wizard-defined custom fields
- enabled/disabled status
- `OPTIONAL` · `REQUIRED_FOR_RECORD` · `REQUIRED_BEFORE_BOOKING`
- generic known-field memory
- corrections
- multi-field capture

Only **REQUIRED_BEFORE_BOOKING** blocks final booking.

**REQUIRED_FOR_RECORD** must not block booking.

Disabled fields must not derail the call.

---

## 18. FAQ / business knowledge

Small frequently used business information should be injected directly through the wizard/business prompt (services, hours, service area, locations, pricing guidance, common policies, common FAQs).

Amy answers these directly when supported by supplied business context.

Do not invent unsupported business facts.

---

## 19. Large knowledge base / RAG

Target capability: website content, PDFs, documents, larger manuals, long knowledge sources.

Large documents should **not** be injected into every static prompt.

Knowledge search should only run when the caller asks something requiring information outside normal prompt context.

Do not invoke RAG on every turn.

Knowledge results must ground the answer.

---

## 20. Message-only / collect-only mode

A customer may choose no live booking.

Amy should then: collect configured information; answer configured FAQs if enabled; optionally qualify/triage; summarize the request; save structured captured values; notify the business; close naturally.

Do not steer caller toward booking if booking strategy is **NONE**.

---

## 21. Lead qualification

Wizard may define qualifying fields/questions (service, location, urgency, new/existing customer, budget, insurance, project type, other arbitrary custom fields).

Qualification should **reuse generic intake**.

Do not create a separate qualification memory system.

---

## 22. Appointment request mode

**REQUEST_ONLY** should support: preferred date, preferred time/daypart, caller information, service/reason, arbitrary configured fields.

Amy must make clear that the request was **collected**, not that an appointment was booked.

Business receives the request for follow-up.

---

## 23. Booking link mode

**SEND_LINK** should support: configured booking URL, appropriate caller information if required, SMS consent/eligibility rules where required, send link during call, record that link was sent.

Amy must not claim a booking occurred merely because a link was sent.

---

## 24. Calendly mode

Target: Calendly configuration in wizard; provider-specific availability/booking as supported; same Amy; same intake memory; same no-reask rules; provider truth before booking confirmation.

Adding Calendly must **not** change Microsoft behavior.

---

## 25. Reschedule

Target: configurable ON/OFF; find existing appointment where supported; collect new preference; provider-authoritative update; confirm only after provider success.

Do not build until prioritized.

---

## 26. Cancel

Target: configurable ON/OFF; identify relevant appointment; confirm intent where appropriate; provider-authoritative cancel; confirm only after provider success.

Do not build until prioritized.

---

## 27. SMS during call

Target uses: booking link, directions, form link, next-step link, other configured safe links/information.

SMS must respect required consent/compliance rules.

Do not make SMS a hidden prerequisite for unrelated call behavior.

---

## 28. Human transfer

Target: transfer enabled/disabled; destination configured; conditions configured; business-hours rules; caller-requested human fallback.

A transfer is a **real external action**, not an internal agent handoff.

Amy remains one assistant until the actual transfer occurs.

---

## 29. Warm transfer

Target: brief destination/recipient with caller context where supported; avoid making caller repeat everything.

Optional enhancement after basic transfer.

---

## 30. Waterfall transfer

Later: destination A → B → fallback.

Do not prioritize before core product is stable.

---

## 31. Urgency / escalation

Wizard should allow configured urgent conditions and destination/fallback behavior.

Do not let generic model guessing define emergency policy.

Hard escalation rules should be deterministic where consequential.

---

## 32. Business hours / after-hours rules

Wizard controls: normal hours, after-hours behavior, holidays, time-based transfer/booking/message rules.

Same Amy. No separate after-hours conversational agent required.

---

## 33. Spam / sales call filtering

Target: configurable handling of obvious spam/sales calls; do not waste business notifications on clearly unwanted traffic where policy allows.

Later/core+ priority.

---

## 34. Multilingual

Target: allowed languages; automatic language handling where supported; same configured business logic.

Core+ / later unless prioritized.

---

## 35. Call summary

Every completed useful call should produce a concise outcome summary with useful next action, not just prose.

---

## 36. Structured call outcome

Every call should have a structured outcome/status.

Examples: `FAQ_RESOLVED`, `MESSAGE_TAKEN`, `CALLBACK_REQUESTED`, `APPOINTMENT_REQUESTED`, `BOOKING_LINK_SENT`, `BOOKED`, `TRANSFERRED`, `TRANSFER_FAILED`, `ESCALATED`, `UNRESOLVED`, `SPAM`.

Do not force all calls into one booking-oriented status model.

---

## 37. Transcript

Full call transcript should remain available per product retention configuration.

Transcript is conversational history. Structured state remains authoritative for actions.

---

## 38. Recording

Target: configurable recording; required disclosure/compliance; playback from call history.

Do not let recording setup block normal call handling.

---

## 39. Call inbox / history

Transovo should preserve a business-facing call record: caller, date/time, duration, outcome, structured captured fields, summary, transcript, recording when enabled, booking/transfer/message result, relevant follow-up state.

This is the durable home for call information.

---

## 40. Business notifications

Customer chooses notification destinations (SMS, email, push, webhook, CRM/integration).

Transovo call history remains the canonical business-facing record.

Notifications should contain useful action information, not merely “You received a call.”

---

## 41. Callback preference

Wizard may configure best callback number, best callback time, preferred contact method.

These should reuse generic intake/custom fields.

---

## 42. Existing vs new customer

Target configurable qualification field/capability. May affect questions, routing, transfer, booking, notification.

Core+ capability.

---

## 43. Fallback behavior

Wizard must define what Amy does when she cannot complete the desired action (take message, request callback, transfer, send link, notify business, explain inability briefly).

Amy must not guess or loop indefinitely.

---

## 44. Failure does not reset conversation

If one action fails: preserve known caller information and valid scheduling preferences; do not restart intake; do not make caller repeat unrelated information; do not claim success; follow configured fallback.

---

## 45. Observability rule

Telemetry must **observe** the hot path, not become part of the hot path.

Do not add blocking telemetry dependencies to live conversation.

---

## 46. Latency rule

Measure **caller-perceived** latency: caller stops speaking → first Amy audio begins.

Do not rely only on server timestamps that do not reflect perceived silence.

---

## 47. Frozen components

Currently frozen unless explicitly approved:

- one-Amy workflow architecture
- Phase 2A L1/L2 state architecture
- warmup architecture
- Microsoft FIND business logic
- offer-set semantics
- Microsoft BOOK business logic
- Graph CREATE semantics
- timezone serializer

New capabilities should attach **around** these without rewriting them.

See also: `src/lib/voice-v2/KNOWN_GOOD_BASELINE.md`

---

## 48. No-regression rule

Adding a capability may expand what Amy can do.

It may **not** change the behavior of an already-certified capability unless the customer configuration **explicitly** selects the new behavior.

Examples:

- Adding **SEND_LINK**: Microsoft booking must still pass unchanged.
- Adding **CALENDLY**: Microsoft, SEND_LINK, message-only must still pass.
- Adding **knowledge base**: Microsoft booking (KB off), message-only, prompt FAQ must still pass.
- Adding **transfer**: booking must not transfer unless transfer conditions are met; collect-only must not transfer unless configured.

---

## 49. Configuration isolation rule

Disabled capabilities should effectively **not exist** for that call.

Enabling one capability must not silently enable another.

Examples: `bookingStrategy = NONE` → no live booking; `knowledgeBaseEnabled = false` → no knowledge search; `transferEnabled = false` → no transfer.

Driven by the **pinned** wizard/config snapshot for the call.

---

## 50. Capability regression matrix

Maintain this matrix in this document. Status values:

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | Not built |
| `IMPLEMENTED` | Code exists; not certified |
| `HEADLESS_CERTIFIED` | Automated/headless tests pass |
| `PSTN_CERTIFIED` | Real PSTN call proved behavior |

*Matrix updated from repo evidence as of contract creation; re-verify before relying on “existing” rows.*

| Capability | Status | Notes |
|------------|--------|--------|
| ONE_AMY | PSTN_CERTIFIED | One thread; no General→Booking handoff |
| WIZARD_8_PAGE_FUNCTIONAL | HEADLESS_CERTIFIED | `collectFields` → `receptionistAdvanced` + `voiceV2Intake` on save/recompile; **production UI sweep + PSTN pending** |
| NUMBER_ASSIGNMENT_FROM_WIZARD | IMPLEMENTED | MCTB TeXML lock surfaced in UI; takeover clears lock metadata on wizard save/activate; **PSTN pending** |
| PUBLISHED_CONFIG_DRIVES_PSTN | IMPLEMENTED | Activate → `publishVoiceAgent` + trigger Telnyx; **PSTN pending** |
| FULL_CONVERSATION_CONTINUITY | IMPLEMENTED | Same Telnyx thread + transcript; structured intake supplements; **PSTN pending** |
| GENERIC_CUSTOM_INTAKE | HEADLESS_CERTIFIED | Wizard bridge + `callerFields` + save/readiness; **PSTN pending** |
| MULTI_FIELD_CAPTURE | HEADLESS_CERTIFIED | `voice_v2_save_intake_fields` batch; **PSTN pending** |
| NO_REASK_KNOWN_FIELDS | HEADLESS_CERTIFIED | Intake instructions + readiness skip; **PSTN pending** |
| FIND_EXISTING_APPOINTMENT | HEADLESS_CERTIFIED | `voice_v2_find_existing_appointment`; **PSTN pending** |
| RESCHEDULE | IMPLEMENTED | Microsoft `updateMicrosoftEvent` (PATCH); reuses FIND + offer set; **PSTN pending** |
| CANCEL | IMPLEMENTED | Microsoft `cancelOrDeleteMicrosoftEvent` (/cancel); **PSTN pending** |
| MICROSOFT_365_BOOKING | PSTN_CERTIFIED | FIND/BOOK/Graph; frozen core |
| SCHEDULING_PREFERENCE_MEMORY | HEADLESS_CERTIFIED | `3ed1e46` — no date-only save; **PSTN recert pending** |
| FAQ_PROMPT_KNOWLEDGE | HEADLESS_CERTIFIED | Wizard `knowledgeItems` + `buildBusinessKnowledgePromptSection`; fast path — no RAG on hours/FAQs |
| LARGE_KNOWLEDGE_BASE_RAG | HEADLESS_CERTIFIED | `voice_v2_search_knowledge` + async KB ingest; composable with all `bookingStrategy` values; **PSTN pending** |
| PDF_KNOWLEDGE_UPLOAD | IMPLEMENTED | Wizard upload → `/api/voice/knowledge/:id/upload`; **production UI + PSTN pending** |
| KNOWLEDGE_SOURCE_REVISION | IMPLEMENTED | `advanced.knowledge` + `knowledgeBaseRevision` pinned per call |
| KNOWLEDGE_TENANT_ISOLATION | IMPLEMENTED | `resolveAgentKnowledgeBaseIds` workspace + published ID allow-list; **automated tenant test pending** |
| KNOWLEDGE_WIZARD_TOGGLE | HEADLESS_CERTIFIED | `knowledgeBaseEnabled` on information step; publish drives Telnyx tool eligibility |
| MESSAGE_ONLY | IMPLEMENTED | Wizard `bookingStrategy=NONE` + finalize tool; **PSTN pending** |
| LEAD_QUALIFICATION | HEADLESS_CERTIFIED | Composable `qualificationEnabled`; deterministic rules + intake fields; **PSTN pending** |
| QUALIFICATION_RULES | HEADLESS_CERTIFIED | Local evaluator; operators IN/NOT_IN/EQUALS/GTE/LTE/EXISTS/CONTAINS |
| QUALIFICATION_WIZARD_TOGGLE | HEADLESS_CERTIFIED | Appointments step; publish pins per call |
| QUALIFICATION_CUSTOM_FIELDS | HEADLESS_CERTIFIED | `collectFields.useForQualification` → intake keys |
| QUALIFICATION_GATE | HEADLESS_CERTIFIED | Blocks FIND/BOOK/send-link when required + not qualified |
| QUALIFICATION_REASON | IMPLEMENTED | `qualificationStatus` + reason metadata on workflow payload |
| REQUEST_ONLY_BOOKING | HEADLESS_CERTIFIED | `bookingStrategy=REQUEST_ONLY`; **PSTN pending** |
| SEND_BOOKING_LINK | HEADLESS_CERTIFIED | `bookingStrategy=SEND_LINK` + pinned `bookingLink`; **PSTN pending** |
| CALENDLY_BOOKING | HEADLESS_CERTIFIED | PSTN pending paid Calendly account |
| SMS_DURING_CALL | NOT_STARTED | Booking-link SMS only when `SEND_LINK`; no general caller SMS |
| TRANSFER | HEADLESS_CERTIFIED | `voice_v2_transfer_call`; trusted destinations; BASIC via Call Control; **PSTN pending** |
| WARM_TRANSFER | IMPLEMENTED | Briefing + DTMF accept path; Telnyx warm leg **PSTN pending** |
| WATERFALL_TRANSFER | HEADLESS_CERTIFIED | Sequential plan; mock/provider tests; **PSTN pending** |
| URGENCY_ESCALATION | HEADLESS_CERTIFIED | Deterministic rules on intake fields; **PSTN pending** |
| BUSINESS_HOURS_RULES | IMPLEMENTED | Wizard/advanced — verify/certify |
| SPAM_FILTERING | HEADLESS_CERTIFIED | Conservative vendor/sales classification; **PSTN pending** |
| MULTILINGUAL | NOT_STARTED | |
| CALL_SUMMARY | IMPLEMENTED | Partial — verify |
| STRUCTURED_OUTCOME | IMPLEMENTED | Partial — verify |
| TRANSCRIPT | IMPLEMENTED | Verify retention UX |
| RECORDING | IMPLEMENTED | Verify compliance path |
| CALL_INBOX_HISTORY | IMPLEMENTED | Partial — verify |
| BUSINESS_NOTIFICATIONS_EMAIL | IMPLEMENTED | Async; idempotent keys; callback/urgent copy |
| BUSINESS_NOTIFICATIONS_SMS | NOT_STARTED | Verify if partial exists |
| WEBHOOK | IMPLEMENTED | Verify existing integrations |
| CRM_SYNC | NOT_STARTED | Later / integration-specific |
| CALLBACK_PREFERENCE | HEADLESS_CERTIFIED | `voice_v2_create_callback_request`; not appointment time; **PSTN pending** |
| EXISTING_VS_NEW_CUSTOMER | IMPLEMENTED | `customer_status` generic field + `distinguishNewExisting` |
| FALLBACK_BEHAVIOR | HEADLESS_CERTIFIED | Unified fallback resolver + wizard `transferFallback` |
| AI_CALL_RECOVERY | IMPLEMENTED | Voice → existing SMS text agent continuation; see `docs/VOICE-V2-AI-CALL-RECOVERY.md`; **PSTN pending** |

---

## 51. Certification rule

A capability is **not** `PSTN_CERTIFIED` just because code exists.

Certification requires a **real call** proving expected behavior.

Every new capability must rerun the **relevant** previously certified combinations — not every possible test blindly; only regressions that could realistically be affected.

---

## 52. Build/deploy rule

Avoid repeated speculative deploys.

Preferred workflow:

1. one coherent implementation  
2. relevant headless tests  
3. one push  
4. watch Coolify directly (`docs/CURSOR-CLOUD-COOLIFY-DEPLOYMENT.md`)  
5. fix only real build/runtime failure  
6. confirm deployed SHA (`/api/health`)  
7. one real PSTN certification test  
8. update matrix/status in **this document**

---

## 53. Minimum product finish line

The first strong after-hours product is complete when these are **reliable**:

- one Amy  
- generic custom intake  
- FAQ/business prompt  
- optional large document knowledge base  
- bookingStrategy: NONE, REQUEST_ONLY, SEND_LINK, MICROSOFT_365, CALENDLY  
- lead qualification / urgency  
- SMS during call  
- configurable human transfer  
- fallback behavior  
- call summary  
- structured outcome  
- transcript  
- recording  
- call inbox/history  
- SMS/email business notifications  
- business-hours/after-hours rules  

Do **not** hold this finish line up for: dozens of calendar providers, deep CRM integrations, payments, outbound AI, review requests, website chat, advanced waterfall routing, or unrelated product modules.

---

## 54. Current development principle

Build the **smallest complete** implementation of each capability.

Do not pre-build hypothetical complexity.

After a real test exposes a specific missing requirement, add **only** that requirement.

**Never** break a previously certified capability while adding a new one.

---

*End of contract*
