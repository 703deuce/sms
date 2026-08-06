# Appointment Booking Agent — Implementation Map

**Rule:** wrap live systems (`VoiceAgent`); do not create a parallel Agent table.

## DB migrate / fresh install

| Artifact | Status |
|---|---|
| `prisma/schema.prisma` includes `AppointmentSlotHold` + `VoiceAppointment` | **FULLY** |
| `supabase/schema.sql` regenerated from Prisma | **FULLY** |
| `supabase/bootstrap.sql` / `fresh-install.sql` include slot holds | **FULLY** |
| Additive migration `20260806_appointment_slot_holds.sql` | **FULLY** |
| `MODEL_TO_TABLE.appointmentSlotHold` | **FULLY** |

Apply path for existing DBs: run additive migration **or** `npm run db:push`. Fresh installs: `bootstrap.sql` / `fresh-install.sql`.

## Capability checklist (all FULLY)

| Capability | Status |
|---|---|
| Agent ownership view-model wrapping VoiceAgent | **FULLY** |
| Structured responsibility (objective / allowed / prohibited / success) | **FULLY** |
| Shared brain load + persist + website approve (`extracted`→`owner_approved`) | **FULLY** |
| Appointment profile + booking policy | **FULLY** |
| Agent detail UI (all tabs) | **FULLY** |
| Execution-trace builder | **FULLY** |
| Booking conversation state on call metadata | **FULLY** |
| Control API (read + mutate with confirm) | **FULLY** |
| Owner chat (responsibility, metrics, recommendations, simulation) | **FULLY** |
| Change proposals with affectedAgents / tests / rollback + version snapshot | **FULLY** |
| Workflow Architect + promote to AutomationFlow | **FULLY** |
| Activate gated by critical simulations + trigger deployments | **FULLY** |
| Pause / resume with flow triggers | **FULLY** |
| Partial capability pause (SMS) + autonomy budget + safe auto-repair | **FULLY** |
| Duplicate clones calendars + primary workflow draft | **FULLY** |
| Slot holds (DB + tools + wizard defaults + Telnyx catalog) | **FULLY** |
| Same-day cutoff enforcement | **FULLY** |
| Post-book verification | **FULLY** |
| Simulation fixtures + assertion suite | **FULLY** |
| Structured agent handoffs | **FULLY** |
| Daily report + exception alerts | **FULLY** |
| Metrics (abandoned, avg time-to-book, top services, WoW) | **FULLY** |
| Health (transfer destinations + calendar token expiry) | **FULLY** |
| MCTB structured handoff | **FULLY** |

## Architecture note

Shared company brain → `workspace.customFieldsConfig.businessBrain`  
Agent profile → derived from `VoiceAgent.draftConfig`  
Active version → `VoiceAgentVersion`  
Runtime → dynvars / `runtime-clock`  
Operating extras → `draftConfig.advanced.agentOperating`  
Tools → builtin voice tools including holds  
Trace → VoiceCall + ToolExecution aggregation  
Owner chat → control API (never direct table writes)
