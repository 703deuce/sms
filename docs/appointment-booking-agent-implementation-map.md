# Appointment Booking Agent — Implementation Map

Internal map for the agent operating layer.
**Rule:** wrap live systems; do not rebuild booking, Telnyx, or calendar.

## Context layers (locked)

| Layer | Answers | Storage | Status |
|---|---|---|---|
| Shared company brain | What is true about this business? | `workspace.customFieldsConfig.businessBrain` + approved knowledge | **FULLY** |
| Appointment agent profile | How is Randy allowed to book? | Derived from `VoiceAgent.draftConfig` / wizard | **FULLY** |
| Active agent version | What is deployed right now? | `VoiceAgentVersion` + Telnyx assistant + trigger deployments | **FULLY** |
| Runtime call context | What is true for this call? | `runtime-clock` + dynvars — never stored as knowledge | **FULLY** |
| Tools | What can actually be performed? | Builtin voice tools + slot holds | **FULLY** |
| Execution trace | What did Randy do? | VoiceCall + ToolExecution + AutomationExecution | **FULLY** |
| Owner conversation | How can the owner understand/change Randy? | Agent Control API + owner chat | **FULLY** |

## Existing component → Agent ownership

| Existing component | Status | Action |
|---|---|---|
| `VoiceAgent` | **FULLY** | Reuse as Agent parent |
| `VoiceAgentVersion` | **FULLY** | Versions / rollback |
| Telnyx assistant-sync | **FULLY** | Voice deployment |
| TeXML DID routing | **FULLY** | Inbound answer |
| Appointment wizard | **FULLY** | Create Randy onboarding |
| `SolutionSetup` | **FULLY** | Inventory / wizard config |
| `AutomationFlow` + TriggerDeployment | **FULLY** | Primary workflow + pause/activate |
| Calendar + booking.ts | **FULLY** | Availability / appointments / same-day cutoff |
| AppointmentSlotHold | **FULLY** | Soft holds during confirmation |
| Missed Call Text-Back | **FULLY** | Structured companion handoff |
| WebRTC test + assertions | **FULLY** | Test suite + trace assertions |
| My Agents `/systems` | **FULLY** | Deep-link `/agents/[id]` |
| Separate `Agent` DB table | None | **Do not create** |

## Capability completion checklist

| Capability | Status |
|---|---|
| Agent ownership view-model wrapping VoiceAgent | **FULLY** |
| Shared brain load + persist + approve website imports | **FULLY** |
| Appointment profile + booking policy extraction | **FULLY** |
| Agent detail UI (all tabs) | **FULLY** |
| Execution-trace builder | **FULLY** |
| Control API (read + mutate with confirm) | **FULLY** |
| Owner chat (read + draft proposals/workflows) | **FULLY** |
| Change proposals → confirm → VoiceService sync | **FULLY** |
| Workflow Architect (NL → validated draft) | **FULLY** |
| Promote architect draft → live AutomationFlow | **FULLY** |
| Activate / rollback with trigger deployments | **FULLY** |
| Pause / resume with pauseFlowTriggers | **FULLY** |
| Duplicate agent draft | **FULLY** |
| Slot holds (model + tools + conflict checks) | **FULLY** |
| Same-day cutoff enforcement | **FULLY** |
| Assertion-complete test suite | **FULLY** |
| Website-import review/approve gate | **FULLY** |
| Structured Randy → MCTB handoff | **FULLY** |
| Health (including transfer destinations) | **FULLY** |
| Results metrics (book/reschedule/cancel/SMS/email) | **FULLY** |

## Default identity

- Name: **Randy**
- Display: **Randy — Appointment Booking Agent**
- Role: `appointment_booking`
- Channel: `voice`
- Execution: `conversational_with_deterministic_tools`
