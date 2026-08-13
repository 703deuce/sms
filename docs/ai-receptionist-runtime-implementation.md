# AI Receptionist — Generic LiveKit Runtime Implementation

**Status:** Implementation spec (audit + phased plan)  
**Audience:** Cursor / engineers building the customer-configurable receptionist  
**Branch context:** UI shell exists (`/voice/agents/*`); runtime wiring is incomplete

---

## Architectural rule (non-negotiable)

The customer does **not** edit code to make an agent.

```
UI draft → validate → save AgentConfig → compile runtime snapshot → publish AgentVersion
→ test uses that exact version → activate pins version to phone routing
→ inbound call: phone assignment → active version → Generic ReceptionistAgent factory → AgentSession
```

**Do not:**
- Generate TypeScript/Python agent classes per customer
- Create a new deployed worker per customer
- Extend the real-estate Front Desk product agent as the general SaaS agent

**Do:**
- One **generic `ReceptionistAgent`** (LiveKit `Agent` + `AgentSession`)
- Thousands of customers = thousands of **published configurations**, same worker code

```
Generic ReceptionistAgent + John's Plumbing config = Amy for John's Plumbing
Same engine           + Smith Dental config     = Receptionist for Smith Dental
```

LiveKit model: `AgentSession` is the interaction container; `Agent` holds instructions/tools; `AgentTask` / `TaskGroup` are **focused temporary objectives** (field collection, booking sub-flow), not separate visible agents to the caller.

---

## LiveKit examples to read first (architecture references)

Repo: `/agent/repos/agents` (Python SDK; patterns apply to TypeScript `@livekit/agents` in sms)

| Example | Path | Use for |
|---------|------|---------|
| Survey + TaskGroup | `examples/survey/agent.py` | Ordered multi-step collection with regression |
| Hotel receptionist | `examples/hotel_receptionist/` | Front-desk booking, DB-backed tools, policies |
| Medical triage | `examples/playground.yaml` (medical front-desk) | Intake + handoff patterns |
| Warm transfer | `examples/warm-transfer/` | SIP transfer patterns |
| Telephony | `examples/telephony/` | SIP lifecycle, DTMF |
| TaskGroup SDK | `livekit-agents/livekit/agents/beta/workflows/task_group.py` | Task orchestration |

**sms production runtime:** `voice-runtime/src/inbound-session-pipeline.ts` — composition root for inbound LiveKit calls.

---

## Implementation audit — what exists today

### Reuse unchanged (do not rebuild)

| Module | Path | Role |
|--------|------|------|
| Inbound pipeline | `voice-runtime/src/inbound-session-pipeline.ts` | SIP → tenant → version → factory → `AgentSession` |
| Realtime pipeline | `voice-runtime/src/pipeline.ts`, `frontdesk-realtime-turn-handling.ts` | OpenAI Realtime + hybrid TTS |
| Booking tools | `voice-runtime/src/frontdesk/booking-tools.ts` | Calendly slots, schedule/reschedule/cancel |
| Transfer | `voice-runtime/src/frontdesk/transfer-tool.ts` | Telnyx CC + LiveKit SIP xfer |
| Knowledge tool | `voice-runtime/src/frontdesk/knowledge-tool.ts` | FAQ / KB |
| End call | `voice-runtime/src/frontdesk/end-frontdesk-call.ts` | Safe hangup |
| Email gate | `voice-runtime/src/frontdesk/email-collection-task.ts` | Pre-booking email |
| Telephony provision | `src/lib/telephony/provisioning/*` | DID → trunk → dispatch metadata |
| Version publish | `src/lib/voice/agent-service.ts` | `build_for_test`, `publish`, version pinning |
| Phone assignment | `src/lib/voice/agent-phone.ts`, `VoiceAgentPhoneNumber` | DID → agent |
| Call persistence | VoiceCall rows, transcript pipeline | Existing |
| Telemetry | `voice-runtime/src/hybrid-streaming-telemetry.ts`, etc. | Latency / tool traces |

### Generalize (extract from RE, apply to generic)

| Current (RE-specific) | Target (generic) | Notes |
|----------------------|------------------|-------|
| `intake-sequence-collection-task.ts` | `GenericFieldCollectionTask` | Single `AgentTask` for multi-field intake; data-driven field manifest |
| `intake-lifecycle.ts`, `re-tools.ts` | Capability-driven tool registration | No `set_intent(buyer/seller)` |
| `compile-front-desk.ts` | `compile-receptionist-config.ts` | UI config → runtime snapshot |
| `intake-memory.ts` heuristics | Optional post-call backfill | Not on critical path |
| `pick-frontdesk-agent.ts` RE +100 bias | Profile-based pick without RE preference | |

### Keep isolated (real-estate template only)

| Path | Reason |
|------|--------|
| `src/lib/voice/real-estate/*` | Buyer/seller/showing intents, RE fields |
| `voice-runtime/src/frontdesk/real-estate/*` | RE agent factory, `re-tools`, CRM sync |
| `src/app/(app)/realtor/*` | Product UI shell |

Future: RE as **preconfigured template** that fills wizard + advanced with RE defaults — not the default runtime.

### DB models — already sufficient (extend JSON, avoid duplicate tables)

| Model | Prisma | Use |
|-------|--------|-----|
| `VoiceAgent` | `draftConfig`, `publishedVersionId`, `phoneNumberId`, `status` | Agent row |
| `VoiceAgentVersion` | immutable `config` | Published/test snapshots |
| `VoiceAgentPhoneNumber` | DID assignment | Routing |
| `VoiceTransferDestination` | Transfer targets | Advanced / capabilities |
| `VoiceAgentKnowledgeBase` | KB links | Knowledge capability |
| `VoiceAgentTool` | Custom tools | Optional later |

**Suggested compiled snapshot field** inside version `config`:

```typescript
advanced: {
  livekitProfile: "frontdesk_realtime",  // required for LiveKit inbound
  receptionistCompiled: {
    // immutable runtime snapshot — see Compile Output below
  }
}
```

Optional new tables only if query needs exceed JSON (e.g. `AgentFieldDefinition` rows for CRM reporting). Start with compiled blob + wizard state in `draftConfig`.

---

## Current UI → what actually persists (gap)

| Page | Route | Saves today | Missing for working agent |
|------|-------|-------------|---------------------------|
| Agents list | `/voice/agents` | — | Phone assignment UX on activate |
| About | `/voice/agents/new`, `[id]/about` | `identity`, `instructions`, `callHandling.startupGreeting`, `inboundRules.answerWhen`, `voiceLanguage` (partial) | `timezone`, compile → `livekitProfile`, business-hours rules |
| Capabilities | `[id]/capabilities` | `advanced.receptionistWizard.capabilities`, weak `enabledBuiltinTools` | Field manifest compile, calendar link for booking, transfer destinations |
| Advanced | `[id]/advanced` | **UI only — not persisted** | All sections must map to compile input |
| Voice & Test | `[id]/voice-test` | `voiceLanguage.voiceId` | LiveKit test session (not Telnyx WebRTC), realtime voice mapping |

**Critical gap:** Wizard agents use `templateId: "receptionist"` **without** `livekitProfile: "frontdesk_realtime"` → browser test hits **Telnyx assistant**; inbound LiveKit SIP uses different code path.

---

## Target compile pipeline

```
ReceptionistWizardState + AdvancedSettings
        ↓ validate (capabilities vs prerequisites)
compileReceptionistConfig(draft) → ReceptionistCompiledSnapshot
        ↓ merge into VoiceAgentConfig.draftConfig
        ↓ save draft
build_for_test / publish → VoiceAgentVersion.config (immutable)
        ↓
runtime loads version.config.advanced.receptionistCompiled
        ↓
createGenericReceptionistAgent(snapshot) → voice.Agent<ReceptionistUserData>
```

### `compileReceptionistConfig()` must produce

| Section | Content |
|---------|---------|
| `livekitProfile` | `frontdesk_realtime` (default production) |
| `instructions` | Protected system constitution + customer business block + greeting |
| `capabilities` | Enabled set: answer_questions, take_messages, collect_info, book, transfer, sms |
| `fieldManifest` | `AgentFieldDefinition[]` — id, label, question, type, required, whenToAsk, confirm, validation |
| `intentRules` | Optional call types from Advanced (default: single "general" intent) |
| `decisionRules` | IF/THEN from Advanced (safe defaults if empty) |
| `bookingPolicy` | Slots offered, min notice, buffer, required fields before book |
| `transferPolicy` | Destinations, warm/direct, fallback |
| `knowledgePolicy` | Approved-only, uncertainty behavior |
| `actionPermissions` | Tool allowlist |
| `fallbackPolicy` | Misunderstanding, booking fail, transfer fail |
| `notifications` | Post-call summary triggers |
| `conversationBehavior` | Response length, interrupt, fillers (maps to realtime turn config) |
| `voice` | Realtime voice id, language, greeting protected flag |
| `routing` | answerWhen: all_calls \| after_hours \| no_answer \| overflow |

### Protected system constitution (Transovo-owned, not customer-editable)

- Tool enforcement (no claim booking without tool success)
- Safety / compliance baseline
- Call lifecycle (hangup, playout-safe goodbye)
- Runtime invariants from `buildFrontDeskInstructions` / booking recovery

Customer content injects into **controlled sections** only.

---

## Runtime architecture

### Factory selection (`inbound-session-pipeline.ts`)

```typescript
if (snapshot.vertical === "real_estate" && snapshot.realEstateCompiled) {
  createRealEstateFrontDeskAgent(...) // template only
} else if (snapshot.receptionistCompiled) {
  createGenericReceptionistAgent({ snapshot, sessionContext })
} else if (isFrontDeskProfile(config)) {
  createFrontDeskBookingAgent(...) // legacy generic booking-only
}
```

### `createGenericReceptionistAgent`

- **One** `voice.Agent<ReceptionistUserData>` for the whole call
- **Instructions:** from compiled snapshot (not RE prompts)
- **Tools:** built from capabilities (disabled = not registered)
  - `answer_questions` → `get_business_answer` / knowledge tool
  - `take_messages` → structured message persist
  - `collect_info` → field manifest + optional `FieldCollectionTaskGroup`
  - `book_appointments` → `buildFrontDeskBookingTools()` subset
  - `transfer_calls` → `transfer_to_human`
  - `send_sms` → approved SMS action
- **Tasks:** use `AgentTask` / `TaskGroup` only for:
  - Multi-field collection when manifest has >0 required fields
  - Email collection before book (reuse `email-collection-task.ts`)
- **Do not** spawn qualification/booking/confirmation as separate agents unless true permission handoff required

### Field collection

- Runtime owns **required field set** from manifest
- LLM converses; server validates before transfer/book actions
- Reuse patterns from `intake-sequence-collection-task.ts` but drive fields from `fieldManifest`, not RE `fields.ts`
- `schedule_appointment`, `transfer_to_human` **fail closed** until required fields present

### Realtime

- Default: **OpenAI Realtime** (`frontdesk_realtime` profile)
- Page 3 voice picker → supported Realtime voices only (hide provider details)
- Preserve: turn detection, interruption fixes, telemetry from `frontdesk-realtime-turn-handling.ts`

---

## Builder flow (UI — already routed)

```
Agents list → Create → About → Capabilities → (optional Advanced) → Voice & Test → Activate
```

**Rules:**
- Pages 1–3 **without Advanced** must produce a deployable agent (answer + messages + collect minimum)
- Advanced enriches same config; does not switch runtime
- Editing existing agent: sidebar jumps to same pages; **no forced wizard replay**
- Draft edits do not affect live calls until publish

### Sidebar menu (only these under AI Receptionist)

1. Agents → `/voice/agents`
2. About your receptionist → `/voice/agents/[id]/about`
3. What should your agent do? → `/voice/agents/[id]/capabilities`
4. Advanced → `/voice/agents/[id]/advanced`
5. Voice & Test → `/voice/agents/[id]/voice-test`

---

## Test & deploy

### Test (Page 3)

Must use **same compiled version** as production:

1. `save()` draft → `compileReceptionistConfig()` → PATCH draft
2. `build_for_test` → `VoiceAgentVersion` with compiled snapshot
3. Test session = **LiveKit room** (or shared worker test dispatch), **not** Telnyx `anonymous_login` unless legacy fallback

Surface human-readable events: Name collected, Message captured, Transfer attempted, Appointment booked, SMS sent + transcript.

Reuse: `AgentBrowserCall` UX; replace backend with LiveKit test token path.

### Activate

1. Validate enabled capabilities (booking → calendar linked; transfer → destination exists)
2. `publishVoiceAgent()` → immutable version, `status: ACTIVE`
3. Assign DID via existing `assignNumberToAgent` / wizard phone step (add if missing)
4. Inbound: `resolveAgentByCalledNumber` → pinned version → factory

---

## Phased implementation (smallest coherent refactor)

### Phase 1 — Compile + LiveKit path (MVP)

- [ ] `src/lib/voice/receptionist/compile.ts` — `compileReceptionistConfig()`
- [ ] `src/lib/voice/receptionist/types.ts` — `ReceptionistCompiledSnapshot`, `AgentFieldDefinition`
- [ ] Wire `use-receptionist-agent-state.save()` → compile before PATCH
- [ ] Wizard create sets `livekitProfile: frontdesk_realtime` + `receptionistCompiled`
- [ ] `createGenericReceptionistAgent()` in voice-runtime
- [ ] Pipeline branch on `receptionistCompiled` (before RE branch)
- [ ] Capabilities → tool allowlist (not prompt-only)
- [ ] Field manifest → `GenericFieldCollectionTask` (generalize intake-sequence pattern)
- [ ] Remove RE bias in `pick-frontdesk-agent.ts` for generic agents

**MVP acceptance:** Pages 1–2–3, answer + messages + collect, test via LiveKit, activate on DID, inbound call works.

### Phase 2 — Advanced persistence + policies

- [ ] Wire `agent-advanced-settings.tsx` to draft sections
- [ ] Compile intents, rules, booking/transfer/knowledge/fallback/notifications
- [ ] Advanced UI changes → same compile → same factory

### Phase 3 — Test parity + observability

- [ ] LiveKit browser test endpoint (replace Telnyx-only test for `frontdesk_realtime`)
- [ ] Test result panel (field collected, tool events)
- [ ] Ensure draft edit does not mutate active version mid-call

### Phase 4 — Polish

- [ ] Phone picker on activate
- [ ] `answerWhen` routing rules (business hours / overflow)
- [ ] Knowledge upload UI → `VoiceAgentKnowledgeBase` links
- [ ] Custom field editor on capabilities page

---

## Acceptance tests (automated + manual)

1. User completes Pages 1–3 (no Advanced): answer + messages + collect → test → activate → call DID → working agent with business info.
2. FAQ-only receptionist: knowledge enabled, no book/transfer tools exposed.
3. Custom required fields collected without hardcoded field names.
4. Transfer enabled: follows rules; failed transfer → configured fallback.
5. Booking enabled: refuses until required fields; real availability; books and confirms.
6. Advanced modifies same agent/runtime (not a different engine).
7. Test and production use same compiled factory/version.
8. Editing draft does not change active calls until publish.
9. Two workspaces, different configs, simultaneous calls, same worker.
10. Normal business receptionist requires zero RE-specific code.

Existing gate: `scripts/test-livekit-architecture-gate.ts` — extend with generic receptionist fixtures.

---

## Files to create (Phase 1)

```
src/lib/voice/receptionist/
  types.ts              # ReceptionistDraftConfig, CompiledSnapshot, FieldDefinition
  compile.ts            # compileReceptionistConfig()
  validate.ts           # capability prerequisites
  defaults.ts           # safe Advanced defaults

voice-runtime/src/frontdesk/receptionist/
  generic-receptionist-agent.ts   # createGenericReceptionistAgent()
  field-collection-task.ts        # data-driven AgentTask (from RE pattern)
  userdata.ts                       # ReceptionistUserData
  instructions.ts                   # build from snapshot
```

## Files to modify (Phase 1)

```
src/lib/receptionist-wizard/build-config.ts     # delegate to compile
src/components/receptionist/use-receptionist-agent-state.ts  # compile on save
voice-runtime/src/inbound-session-pipeline.ts   # factory branch
src/lib/voice/agent-service.ts                 # compile on build/publish
src/lib/voice/frontdesk/pick-frontdesk-agent.ts # remove RE bias for generic
```

## Files to NOT modify for generic path

- `voice-runtime/src/frontdesk/real-estate/*` (except shared utilities)
- Telnyx Caller Amy workflow engine (legacy)

---

## Cursor implementation prompt (copy-paste)

Use this when starting implementation work:

> Rebuild AI Receptionist as a **configuration-driven generic LiveKit agent**. Read `docs/ai-receptionist-runtime-implementation.md` first. Do not extend RE Front Desk as the product agent. Implement Phase 1: `compileReceptionistConfig`, `createGenericReceptionistAgent`, wire UI save → compile → `livekitProfile: frontdesk_realtime`, field manifest collection, capability→tool mapping. Reuse `inbound-session-pipeline`, `booking-tools`, `transfer-tool`, `publishVoiceAgent`, telephony provisioning. Test must use compiled version on LiveKit path. Customer fills UI only — no per-customer code generation.

---

## Related docs

- `AGENTS.md` — build/test commands
- `voice-runtime/AGENTS.md` (if present) — worker deploy
- PR #163 — UI shell (wizard pages + sidebar)
