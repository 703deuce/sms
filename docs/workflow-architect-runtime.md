# Appointment Workflow Architect Runtime

Specialist LLM agent that creates schema-constrained workflow drafts for the existing AutomationFlow engine.

## System Inventory

| Item | Current implementation | File/table | Real or stubbed | Notes |
|------|------------------------|------------|-----------------|---------|
| AutomationFlow model | Prisma `AutomationFlow` + `definition` JSON | `prisma/schema.prisma` | Real | Executor uses `publishedDefinition` |
| Node registry (architect) | `APPOINTMENT_WORKFLOW_BLOCKS` (45+ blocks) | `workflow-blocks.ts` | Real | Design-time DSL |
| Node registry (executor) | `AUTOMATION_BLOCKS` | `automations/catalog.ts` | Real | Runtime AutomationFlow |
| Edge representation | `WorkflowDraftEdge` / `AutomationCanvasEdge` | `workflow-validator.ts`, `automations/types.ts` | Real | Two layers |
| Trigger registry | `extractTriggersFromDefinition` | `automations/trigger-deployments.ts` | Real | Telnyx deployment |
| Tool/action nodes | Architect tools + `runNodeAction` | `workflow-blocks.ts`, `automations/actions.ts` | Real | Caller Amy via Telnyx |
| Validators | Structural + semantic | `workflow-validator.ts`, `workflow-semantic-validator.ts` | Real | Both required |
| Workflow templates | Validated recipes + NL templates | `workflow-architect.ts`, `voice/flow/templates.ts` | Real | Template fallback |
| Flow executor | `advanceAutomationExecution` | `automations/runner.ts` | Real | Not architect DSL |
| Draft promotion | `promoteWorkflowDraft` | `workflow-promote.ts` | Real | Stores `architectDraft` metadata |
| Versioning | `AutomationFlow.version` + `VoiceAgentVersion` | `prisma/schema.prisma` | Real | Separate paths |
| Tests/simulations | `APPOINTMENT_BOOKING_TEST_SCENARIOS` | `test-suite.ts`, `simulation.ts` | Real | Architect assigns required tests |
| Architect runtime | LLM loop + template fallback | `workflow-architect-llm-loop.ts` | Real | `creationMode` tracked |

## Configuration

```bash
WORKFLOW_ARCHITECT_PROVIDER=deepseek          # default
WORKFLOW_ARCHITECT_MODEL=deepseek-chat        # default
WORKFLOW_ARCHITECT_FALLBACK_PROVIDER=openai   # optional
WORKFLOW_ARCHITECT_FALLBACK_MODEL=gpt-4o-mini # optional
```

## Creation Modes

| Mode | When | Metadata |
|------|------|----------|
| `llm_architect` | LLM configured and `submit_workflow_draft` succeeded | `architectInvocation` record with requestId, model, toolCalls |
| `validated_template` | Exact recipe match, LLM unavailable | No `architectInvocation` |
| `manual_editor` | UI editor changes | Not set by architect |

Owner Amy must only tag `executed:appointment_workflow_architect` when `creationMode === "llm_architect"` and `architectInvocation` exists.

## Flow

```
Owner request
  → Owner Amy: request_workflow_draft
  → runWorkflowArchitect()
    → [primary] runWorkflowArchitectLlmLoop()
    → [fallback] validated template recipe
  → validateWorkflowDraft() + validateWorkflowSemantics()
  → persist draft (never activate)
  → Owner Amy explains diff + required tests
  → owner approves → promote_workflow_draft
```

## Validated Template Recipes (fallback)

- After-hours emergency transfer (`buildAfterHoursEmergencyTransferDraft`)
- Unsuccessful booking follow-up SMS (`buildUnsuccessfulBookingFollowupDraft`)
- Standard booking flow (`architectWorkflowFromRequest`)

Complex arbitrary NL requires the LLM Architect — templates do not pretend to understand it.
