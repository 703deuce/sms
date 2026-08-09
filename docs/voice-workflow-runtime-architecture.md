# Transovo Voice Workflow Runtime Architecture

**LiveKit Agents SDK:** `@livekit/agents` **1.6.2**  
**Status:** Foundational engine implemented — booking is workflow **data**, not hard-coded state machine.

---

## Architecture before

```
Gemma → amy-tools.ts → toolsForTask(hard-coded) → domain-actions → workflow-engine
```

- `CHECKING_AVAILABILITY`, `SELECTING_SLOT`, etc. were coded as Amy's permanent state machine
- Tool visibility used task allowlists in `task-guard.ts`
- PR #117 direction (`toolsForTaskWithChain`) pre-registered appointment stages in code

## Architecture after

```
Amber / owner config
        ↓
WorkflowDefinition (versioned data)
        ↓
workflow-runtime/validator
        ↓
compileTurnCapabilityEnvelope()  ← replaces toolsForTaskWithChain
        ↓
capability-registry → LiveKit tool definitions (amy-tools.ts)
        ↓
domain-actions + workflow-engine (authoritative business ops)
        ↓
LiveKit AgentSession + Gemma
```

**Amy contains conversational intelligence. The workflow definition contains business behavior.**

---

## KEEP / ADAPT / REPLACE / REMOVE

| Component | Verdict | Notes |
|-----------|---------|-------|
| LiveKit `AgentSession` pipeline | **KEEP** | `voice-runtime/src/main.ts` |
| Domain services (Calendly, fields, CRM) | **KEEP** | `workflow-engine/`, `field-runtime/`, `agent-tool-gateway/` |
| `domain-actions/booking-actions.ts` | **ADAPT** | Now uses `authorizeCapabilityInvocation` |
| `realtime-session/` hot state | **KEEP** | Both Telnyx + LiveKit |
| `amy-livekit-prompt.ts` permanent rules | **KEEP** | Task instructions now workflow-compiled |
| `task-guard.ts` task IDs | **ADAPT** | Legacy bridge; tool visibility from compiler |
| `toolsForTaskWithChain()` | **REPLACE** | → `compileTurnCapabilityEnvelope()` |
| Hard-coded booking state machine in Amy | **REMOVE** | → `definitions/appointment-booking` data |
| Telnyx `runtime_turn` on LiveKit path | **REMOVE** (already) | — |
| LiveKit `AgentTask` / `TaskGroup` | **ADAPT (next)** | Compiler maps nodes → tasks; not wired yet |

---

## Workflow schema

See `src/lib/voice/workflow-runtime/schema.ts`:

- Generic node types: `collect_fields`, `action`, `choice`, `confirmation`, `completion`, …
- Nodes declare `capability`, `requiresUserInput`, `transitions`
- Versioned `WorkflowDefinition` — immutable per call once pinned

## Capability registry

See `src/lib/voice/capability-registry/registry.ts`:

- Permanent catalog (`calendar.check_availability`, `message.save`, …)
- Workflows **reference** capability IDs
- Maps to model-facing tool names

## Same-turn tool chaining (generalized)

`compileTurnCapabilityEnvelope()` traverses the workflow graph until the next **caller-interaction boundary**:

| Scenario | Envelope includes | Stops before |
|----------|-------------------|--------------|
| Collecting (1 field left) | `record_current_field`, `check_availability` | `select_slot` (choice) |
| Presenting slots | `select_slot` | `confirm_booking` |
| Awaiting confirmation | `confirm_booking` | — |

**Not** hard-coded `record → check → select → confirm`. The **graph** defines reachability.

## Workflow definitions (data)

| ID | Version | Purpose |
|----|---------|---------|
| `appointment_booking` | 1 | Fields → availability → slot → confirm |
| `message_taking` | 1 | Name, phone, message → save |
| `message_taking` | 2 | + address, preferred_time_of_day (config-only) |

Swap active workflow: `setActiveWorkflowForAgent()` or `VOICE_ACTIVE_WORKFLOW=message_taking:1`

## LiveKit primitives (next phase)

Installed SDK supports:

- `AgentTask` / `AgentTask.create()` — focused objectives with typed results
- `workflows.TaskGroup` — ordered tasks + regression via `out_of_scope`
- `Toolset` — grouped tools, dynamic `updateTools`
- `Agent.updateTools()` / `updateInstructions()` — already used in `syncAmyAgentFromContext`

**Next:** Map `collect_fields` / `action` nodes → `GenericCollectFieldsTask` / `CapabilityActionTask` via LiveKit adapter.

## Tests

```bash
npm run test:workflow-runtime-compiler
npm run test:voice-livekit-booking-orchestration
```

## Remaining hardcoding (honest)

1. **Legacy state bridge** — `legacyStateToNodeId()` maps old `COLLECTING_FIELDS` → workflow nodes until all calls use `currentNodeId` directly
2. **LiveKit TaskGroup** — not yet wired; compiler produces tool envelopes on existing Agent
3. **Amber publish pipeline** — workflow versions in memory; DB persistence for Amber activation TBD
4. **Condition/emergency branch** — schema supports it; example workflow not yet added
5. **`record_fields` multi-field tool** — schema ready; single `record_current_field` still primary

## Acceptance criteria progress

| Criterion | Status |
|-----------|--------|
| F. Narrow workflow-derived tool surface | ✅ Envelope compiler |
| G. Same-turn chained tools | ✅ Graph traversal |
| H. Premature tools server-blocked | ✅ `authorizeCapabilityInvocation` |
| D/E. Booking → message without deploy | ✅ `VOICE_ACTIVE_WORKFLOW` + definitions |
| C. Arbitrary fields config-only | ✅ message v2 proof |
| A/B. PSTN E2E | ⏳ Needs deploy + call test |
| M. Amber produces valid workflow | ⏳ Schema + validator ready; Amber integration next |

---

## Implementation order (completed vs next)

1. ✅ Audit LiveKit SDK 1.6.2
2. ✅ KEEP/ADAPT/REPLACE plan (this doc)
3. ✅ WorkflowDefinition schema + validator
4. ✅ Capability registry
5. ✅ `compileTurnCapabilityEnvelope`
6. ✅ Wire `amy-tools.ts` to compiler
7. ✅ Booking + message workflow data
8. ⏳ LiveKit TaskGroup adapter
9. ⏳ Amber publish → DB workflow versions
10. ⏳ PSTN acceptance tests
