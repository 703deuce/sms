# Appointment Booking Agent — Implementation Map

Internal map produced before building the agent operating layer.
**Rule:** wrap live systems; do not rebuild booking, Telnyx, or calendar.

## Context layers (locked)

| Layer | Answers | Storage |
|---|---|---|
| Shared company brain | What is true about this business? | `WorkspaceBusinessProfile` (+ knowledge sources) |
| Appointment agent profile | How is Randy allowed to book? | Derived from `VoiceAgent.draftConfig` / wizard + `AppointmentAgentProfile` overlay |
| Active agent version | What is deployed right now? | `VoiceAgentVersion` + Telnyx assistant |
| Runtime call context | What is true for this call? | Generated via `runtime-clock` + dynvars — never stored as knowledge |
| Tools | What can actually be performed? | Existing builtin voice tools |
| Execution trace | What did Randy do? | Aggregated from VoiceCall + ToolExecution + AutomationExecution |
| Owner conversation | How can the owner understand/change Randy? | Agent Control API + owner chat (separate from caller prompts) |

## Existing component → Agent ownership

| Existing component | Status | Action | Owns |
|---|---|---|---|
| `VoiceAgent` | Live | **Reuse as Agent parent** | Identity, status, Telnyx IDs, health fields |
| `VoiceAgentVersion` | Live | **Reuse** | Versions / rollback snapshots |
| Telnyx `assistant-sync` | Live | **Reuse** | Voice assistant deployment |
| TeXML DID routing | Live | **Reuse** | Inbound answer path |
| Appointment wizard | Live | **Wrap** as Create Randy onboarding | Setup |
| `SolutionSetup` | Live | **Reuse** link | Inventory / wizard config |
| `AutomationFlow` + TriggerDeployment | Live | **Reuse** | Primary workflow |
| Calendar connections + booking.ts | Live | **Reuse** | Availability / appointments |
| `resolve_datetime` | Live | **Reuse** (tighten ambiguity later) | Time normalization |
| Transfer / escalate_human | Live | **Reuse** | Handoff |
| Booking confirmation SMS | Live | **Reuse** | Post-book SMS |
| VoiceCall / Transcript / ToolExecution | Live | **Wrap** into execution trace | Activity / diagnostics |
| WebRTC test + VoiceTestRun | Live | **Wrap** + real assertions | Test tab |
| Outcome registry shells | Partial | **Replace** with agent detail tabs for this type | Product UI |
| My Agents `/systems` | Live | **Link** appointment agents → `/agents/[id]` | Inventory |
| Separate `Agent` DB table | None | **Do not create** parallel entity | VoiceAgent is the agent |

## Default temporary identity

- Name: **Randy**
- Display: **Randy — Appointment Booking Agent**
- Role: `appointment_booking`
- Channel: `voice`
- Execution: `conversational_with_deterministic_tools`

## Build sequence for this PR (Steps 1–7 slice)

1. ✅ Repository audit (this doc)
2. Agent ownership view-model wrapping VoiceAgent
3. Shared brain + appointment profile extraction
4. Agent detail UI (Overview, Talk, Setup, Workflows, Test, Activity, Results, Health, Versions)
5. Unified execution-trace builder
6. Control API (read commands + pause/resume)
7. Owner chat read-only (tool-backed answers)

Deferred to follow-up PRs: Workflow Architect, change proposals → activate, slot holds table, assertion-complete test suite, duplication flow.
