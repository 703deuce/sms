# Appointment Booking Agent (Amy) — Implementation Map

**Rule:** wrap live systems (`VoiceAgent`); do not create a parallel Agent table.  
**Upgrade rule:** extend the existing operating layer — no second agent/workflow/booking system.

## Hire & train journey (customer-facing)

| Step | Route / surface | Status |
|---|---|---|
| Post-payment / signup → Build your team | `/hire` (Stripe success + signup) | **FULLY** |
| Chooser: Amy (recommended) + Tom only | `HIREABLE_AGENTS` catalog | **FULLY** |
| Company Brain first (website / conversation / manual) | `/hire/brain`, `/company-brain`, `/api/company-brain` | **FULLY** |
| Amy hire locks booking job (no “do you book?”) | Wizard `?hire=amy` Assignment step | **FULLY** |
| Custom collection fields UI | Appointments / Booking rules step | **FULLY** |
| Activate → Amy home `/agents/[id]` | Hire-mode wizard redirect | **FULLY** |
| Agent type vs instance (catalog) | `src/lib/agents/catalog.ts` | **FULLY** |

**Rule:** Never ask the customer to redefine what a specialized agent fundamentally is. Ask only for business resources, services, collection fields, policies, voice, then test and activate.

| Artifact | Status |
|---|---|
| Data-driven `AgentIdentity` (name, pronouns, roleLabel, customerFacingName) | **FULLY** |
| Default name Amy (no hard-coded Randy / he / him / his in product copy) | **FULLY** |
| Wizard defaults + spoken prompt use configurable `agentName` | **FULLY** |

## Navigation / home

| Artifact | Status |
|---|---|
| Primary inventory `/agents` (“Your Team”) | **FULLY** |
| `/systems` compatibility redirect → `/agents` | **FULLY** |
| Agent home dashboard (ops cards, blockers, recommendations) | **FULLY** |
| Tabs: Memory, Attention, Autonomy (+ existing) | **FULLY** |
| Employee-style activity timeline from structured events | **FULLY** |

## Readiness / safety

| Artifact | Status |
|---|---|
| Live readiness gate with exact blockers | **FULLY** |
| Slot-hold schema health check (table/columns/probe) | **FULLY** |
| Slot holds in AgentHealth | **FULLY** |
| Enforceable autonomy modes (Conservative / Balanced / Autonomous) | **FULLY** |
| Emergency policy catalog (pause smallest capability) | **FULLY** |
| Setup edits via `propose_setup_change` (versioned proposals) | **FULLY** |
| Teach classification → proposal / workflow draft | **FULLY** |

## Memory / Attention

| Artifact | Status |
|---|---|
| Typed memory view (shared + agent-specific + learning queue) | **FULLY** |
| Attention inbox from readiness + proposals + failures + drafts | **FULLY** |
| Learning queue storage on `agentOperating.learningQueue` | **PARTIAL** (read/UI; auto-populate from patterns still thin) |

## Owner chat trust

| Artifact | Status |
|---|---|
| Evidence links on failure / health / teach answers | **FULLY** |
| Visible working status while searching | **FULLY** |
| Teach + same-day cutoff natural language | **FULLY** |

## DB migrate / fresh install

| Artifact | Status |
|---|---|
| `prisma/schema.prisma` includes `AppointmentSlotHold` + `VoiceAppointment` | **FULLY** |
| `supabase/schema.sql` / bootstrap / fresh-install | **FULLY** |
| Additive migration `20260806_appointment_slot_holds.sql` | **FULLY** |
| Runtime schema verification in health/readiness | **FULLY** |

## Core operating layer (reused, not rebuilt)

| Capability | Status |
|---|---|
| Agent ownership view-model wrapping VoiceAgent | **FULLY** |
| Shared brain + website fact approval | **FULLY** |
| Appointment profile + booking policy | **FULLY** |
| Execution-trace builder | **FULLY** |
| Control API + owner chat | **FULLY** |
| Change proposals + version snapshots | **FULLY** |
| Workflow Architect + promote | **FULLY** |
| Activate gated by simulations | **FULLY** |
| Pause / resume / rollback / duplicate | **FULLY** |
| Slot holds + same-day cutoff + post-book verify | **FULLY** |
| MCTB structured handoff (separate from Amy identity) | **FULLY** |
| Daily report + exception alerts | **FULLY** (generation; delivery channel config still workspace-dependent) |

## Still hardening toward 100% Amy V2

| Gap | Notes |
|---|---|
| Shadow mode | Spec’d; not yet a first-class runtime mode |
| Full 20-scenario live regression on every activate | Suite exists; live phone/WebRTC console still uses builder links |
| Cost / usage meters UI | Not yet surfaced on agent home |
| Mobile polish | Tabs scroll + stacked cards; workflow canvas still advanced |
| Auto learning-queue population from call patterns | Storage + UI ready; detectors partial |
| Version performance comparison charts | Versions show metadata; comparative metrics pending |

## Architecture note

Shared company brain → `workspace.customFieldsConfig.businessBrain`  
Agent profile → `VoiceAgent.draftConfig`  
Active version → `VoiceAgentVersion`  
Operating extras → `draftConfig.advanced.agentOperating`  
Identity extras → `agentOperating.identity`  
Primary customer URL → `/agents/[id]`  
Tools → builtin voice tools including holds  
Owner chat → control API (never direct table writes)
