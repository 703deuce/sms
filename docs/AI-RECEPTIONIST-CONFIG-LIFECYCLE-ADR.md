# ADR: AI Receptionist configuration lifecycle (Save → Test → Publish)

## Status

Accepted — implemented incrementally starting Oct 2026.

## Context

The appointment receptionist wizard save endpoint had grown into a publish pipeline: hooks, KB crawl, workflow compile, and live Telnyx sync could run on **Save Draft**, including for **ACTIVE** agents (`syncLiveWizardDraftToProvider` + HTTP 422).

That coupling caused slow saves, Bad Gateway timeouts, confusing “saved but not live” states, and field ownership bugs across wizard steps.

## Decision

### 1. Three operations, three contracts

| Operation | Customer action | Server responsibility |
|-----------|-----------------|----------------------|
| **Save configuration** | Save Draft / Save & Continue | Validate, merge step fields, persist authoritative wizard JSON, bump revision — **no live side effects** |
| **Test** | Test in browser | Compile draft revision for isolated test (existing V3 test compiler); **does not change production** |
| **Publish** | Activate | Hooks, compile, workflow, Telnyx/LiveKit publish, ACTIVE — **existing runtime path preserved** |

### 2. Authoritative editable configuration

- **Source of truth for editing:** `VoiceAgent.draftConfig.advanced.appointmentReceptionistWizard` plus `wizardConfigRevision`.
- **Save Draft** patches this snapshot only (no `buildWizardAgentConfig` on the hot path).
- **Activate** runs `buildWizardAgentConfig` + hooks + publish (unchanged runtime).
- **SolutionSetup.configJson.wizard** remains a **mirror** for inventory/linking, not a competing editor (`compileWorkflow: false` on draft save).

### 3. Draft vs published

- **Save Draft never** calls `syncLiveWizardDraftToProvider` or updates published Telnyx state.
- Live callers continue using **published** `VoiceAgentVersion` until **Activate** succeeds.
- Successful DB save returns **200** — no `liveSyncPending` on draft save.

### 4. Field ownership (canonical wizard step)

| Domain | Primary step |
|--------|----------------|
| Capabilities | Goals |
| Phone, recording, connection greeting | Phone |
| Business knowledge, hours, business name | Information |
| Booking strategy & behavior, types, collect fields | Appointments |
| Transfers, callbacks, spam, escalation | Call Handling |
| AI identity, greeting, voice, speaking style | Voice |

Operational pages may display the same fields but must save with the correct `wizardStepId` merge.

### 5. What we are **not** changing

- LiveKit Python worker, booking tools, phone ingress, published version model, activation/recovery transactions.

## Consequences

- **Pros:** Fast predictable saves; clear product semantics; easier to add async KB jobs and tracked publish later.
- **Cons:** Draft `draftConfig` may lag compiled runtime until Activate; test step must compile from wizard snapshot (already supported).
- **Follow-ups:** Background KB processing; explicit `prepare_test` API; tracked publish job with retry; optimistic revision checks on concurrent editors.

## Implementation map

- `wizard-config-lifecycle.ts` — revision + patch snapshot
- `wizard-draft-persist.ts` — lightweight save
- `route.ts` — draft early return; activate-only hooks/sync
- `save-setup.ts` — `compileWorkflow: false` on draft save
- `merge-wizard-state-on-save.ts` — ownership cleanup
