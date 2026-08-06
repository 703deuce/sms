# Appointment Booking Agent (Amy) — Implementation Map

**Rule:** wrap live systems (`VoiceAgent`); do not create a parallel Agent table.  
**Upgrade rule:** extend the existing operating layer — no second agent/workflow/booking system.

## Unify lifecycle (wizard = Amy’s deployment engine)

| Change | Status |
|---|---|
| Field ownership map + migration report (Brain / Amy / deploy / temp) | **FULLY** (`field-ownership.ts` + `migrationReport()`) |
| Wizard save syncs company facts → Company Brain (no Amy duration copy) | **FULLY** |
| Single deploy path remains appointment-receptionist activate | **FULLY** (`deploy.ts`) |
| Typed setup commands (`get_setup_readiness`, voice/fields proposals) | **FULLY** (`setup-commands.ts`) |
| Runtime registry (Caller / Owner / Architect / Diagnostic) | **FULLY** (`runtime-registry.ts`) |
| Telnyx deployment drift vs expected AgentVersion | **FULLY** (`deployment-drift.ts` + Health) |
| Amy page: Home / Talk / Work / Build & Test / Settings | **FULLY** (mockup IA) |
| Settings: booking + greeting + fields → proposal → Put change live | **FULLY** |
| Talk completes setup interview + custom fields conversationally | **FULLY** |
| Guided setup = same wizard, labeled as Amy’s engine | **FULLY** (linked from Settings) |
| Company Brain permanent nav | **FULLY** (Your Team → Company Brain) |

**Rule:** Keep wizard machinery. Company Brain owns company facts. Amy AgentVersion owns appointment behavior. Deployed Telnyx stays the live caller path — confirm/publish after every change. Dual-read Phase 3: new writes prefer Brain + Amy draft; old wizard fields remain read fallback until verified.

| Path | Status |
|---|---|
| Wizard Activate → Telnyx publish + TeXML DID + primary AutomationFlow ACTIVE | **FULLY** (fail-closed on publish error) |
| Live turns = Telnyx assistant + booking tools (not AutomationFlow nodes) | **FULLY** |
| AutomationFlow = inbound enroll + post-call / around-call | **FULLY** |
| Slot holds + book gates (incl. same-day cutoff) | **FULLY** |
| Availability offers respect same-day cutoff (Google/MS/internal) | **FULLY** |
| Owner NL change → proposal → “yes / Put change live” → VoiceService sync + Telnyx republish | **FULLY** (live agents publish by default; voice + collection fields too) |
| Workflow Architect drafts → promote to primary flow | **FULLY** (optional; first hire uses compiled template) |
| Health compares expected version hash vs live Telnyx instructions | **FULLY** |

**How to change Amy after go-live:** Talk or Settings → typed proposal → confirm with **Put change live** or say “yes, put it live”. That updates booking policy / voice / fields, syncs calendar service gates, and republishes the Telnyx assistant.

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
