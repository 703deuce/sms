# Owner Amy Runtime

Production-grade bounded LLM agent for business owners to supervise, test, and safely change the Appointment Booking Agent.

## Audit Table

| Component | Current implementation | File path | Production-ready? | Gap |
|-----------|------------------------|-----------|-------------------|-----|
| Owner Amy LLM loop | Bounded 8-iteration tool loop with explicit provider chain | `intelligence/owner-llm-loop.ts` | When `OWNER_AMY_PROVIDER` configured | Monitor iteration limits |
| System prompt | 13 modular prompt sections compiled per request | `intelligence/prompt-modules.ts` | Yes | Version via `prompt-versioning.ts` |
| Tool registry | 40+ tools with risk levels and metadata | `intelligence/owner-tool-executor.ts` | Yes | Section filters on settings |
| Tool schemas | `AgentToolDefinition` + OpenAI function schemas | `intelligence/owner-tool-executor.ts` | Yes | — |
| Tool executor | `ToolResult` wrapper → Control API | `intelligence/owner-tool-executor.ts` | Yes | — |
| Conversation persistence | `agentOperating.ownerAmy.conversations` | `intelligence/owner-conversation.ts` | Yes | Dedicated table at scale |
| Context loader | `OwnerRuntimeContext` envelope only | `intelligence/owner-runtime.ts` | Yes | No bulk injection |
| Confirmation handling | `ActionConfirmation` records | `intelligence/owner-confirmation.ts` | Yes | UI passes `confirmationId` |
| Specialist delegation | Real `diagnose_execution` + workflow draft | `intelligence/diagnostic-runtime.ts` | Yes | Workflow Architect template-based |
| Async job handling | `ToolResult` queued status | `intelligence/tool-result.ts` | Yes | Dedicated job status command |
| Provider fallback | Explicit `OWNER_AMY_*` env vars | `intelligence/owner-model-config.ts` | When keys set | Set env in production |
| Agent tests | Acceptance + layer tests | `intelligence/acceptance-tests.ts` | Yes | Live LLM tests behind flag |

## Configuration

```bash
OWNER_AMY_PROVIDER=deepseek          # default
OWNER_AMY_MODEL=deepseek-chat        # default
OWNER_AMY_FALLBACK_PROVIDER=openai   # optional
OWNER_AMY_FALLBACK_MODEL=gpt-4o-mini # optional
```

Separate configuration exists for Caller Amy, Workflow Architect, and Diagnostic runtimes via `CALLER_AMY_*`, `WORKFLOW_ARCHITECT_*`, and `DIAGNOSTIC_*` prefixes.

## Runtime Modes

- **LLM Agent** — primary production path when provider is configured
- **Limited fallback** — deterministic keyword routing when no LLM provider is available (visibly labeled in UI)

## Confirmation Gate

The LLM cannot self-confirm. Production actions require:

1. Tool creates proposal → `ActionConfirmation` record issued
2. Owner sends explicit approval message or clicks UI button
3. Backend validates and consumes confirmation before mutation

## Debug Record

Each response includes `_runtime` metadata:

- model, prompt version, prompt hash
- enabled tools, last tool calls
- provider fallback, context size, loop count
- specialists actually executed (not preflight hints)
