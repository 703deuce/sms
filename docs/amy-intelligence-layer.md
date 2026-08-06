# Amy intelligence layer

This document describes the specialized agent intelligence layer for Amy (Appointment Booking Agent). The existing AutomationFlow system remains the execution layer; this layer adds bounded runtimes, prompts, tools, context policy, delegation, and acceptance tests.

## Runtime audit (2026-08-06)

| Runtime | Current prompt | Current model | Current tools | Current context | Current writes | Gap |
|---------|----------------|---------------|---------------|-----------------|----------------|-----|
| Caller Amy | `intelligence/caller-prompt.ts` | `telnyx:anthropic/claude-haiku-4-5` | 15 voice tools | 10 selective sources | `live_tools` | Live path via Telnyx; backend controls tool execution |
| Owner Amy | `intelligence/owner-runtime.ts` | `internal:deterministic_bounded_loop` | 34 typed tools | 18 layered sources | `proposal_only`, `draft_only` | Deterministic handlers — LLM optional for complex NL |
| Workflow Architect | `intelligence/workflow-architect-runtime.ts` | `internal:template_constraint_validator` | 4 architect tools | 8 sources | `draft_only` | Regex/template mapping — extend for complex multi-branch NL |
| Diagnostic specialist | `intelligence/diagnostic-runtime.ts` | `internal:structured_trace_analyzer` | 5 read tools | 5 trace sources | none | Evidence-only; no speculation |

## Architecture

```
Owner request
    → request-router (deterministic intent)
    → owner-runtime (bounded loop, capability check)
    → delegate? → workflow-architect-runtime | diagnostic-runtime
    → typed Control API tools
    → AutomationFlow (execution layer, unchanged)
```

## Key modules

| Module | Path | Purpose |
|--------|------|---------|
| Runtime registry | `runtime-registry.ts` | First-class `AgentRuntimeDefinition` per runtime |
| Capability catalog | `intelligence/capability-catalog.ts` | Structured `AgentCapability` + UI shortcuts |
| Tool descriptions | `intelligence/tool-descriptions.ts` | Agent-readable metadata per tool |
| Prompt modules | `intelligence/prompt-modules.ts` | Composable sections per runtime |
| Request router | `intelligence/request-router.ts` | Deterministic intent classification |
| Context policy | `intelligence/context-policy.ts` | Always / on-demand / never loading rules |
| Delegation | `intelligence/delegation.ts` | Specialist handoff thresholds |
| Owner runtime | `intelligence/owner-runtime.ts` | Bounded planning loop |
| Workflow architect | `intelligence/workflow-architect-runtime.ts` | `WorkflowArchitectResult` + validators |
| Diagnostic | `intelligence/diagnostic-runtime.ts` | `DiagnosticResult` from traces |
| Caller prompt | `intelligence/caller-prompt.ts` | Modular caller prompt + custom fields |
| Prompt versioning | `intelligence/prompt-versioning.ts` | Version, hash, deployment metadata |
| Acceptance tests | `intelligence/acceptance-tests.ts` | Tool-call assertions per runtime |

## Admin debug page

`/admin/agent-runtimes` shows runtime definitions, prompt hashes, tool sets, and acceptance test results.

## Control API

`get_intelligence_summary` returns audit table, capabilities, shortcuts, prompt versions, and acceptance suite results.

## What Amy can do (Talk UI)

Seven capability shortcuts in Talk to Amy map directly to `AMY_CAPABILITY_SHORTCUTS` in the capability catalog.

## Acceptance tests

Run: `npx tsx scripts/test-appointment-booking-agent-layer.ts`

Covers Owner Amy routing, Workflow Architect validation, Caller Amy trace assertions, and Diagnostic evidence rules.
