<!-- pragma: allowlist secret -->
# Smart Routing AI Assistant — Implementation Report

## Objective

Add an AI management layer for Smart Routing that helps business owners **build, change, explain, analyze, and improve** routing via natural language — without participating in live calls.

## Architecture

```
Natural language request
  → AI structured proposal (DraftConfig)
  → validateDraftConfig() [authoritative]
  → human-readable preview
  → customer approval
  → updateFlowDraft() + publishFlow()
  → deterministic Smart Routing runtime
```

AI operates **above** telephony/provider layers. No Telnyx, LiveKit, Twilio, SIP, or webhook calls from AI code paths.

## Existing components reused

| Area | Path |
|------|------|
| Draft types | `src/lib/smart-routing/types.ts` |
| Validator | `src/lib/smart-routing/flow-validator.ts` — `validateDraftConfig()` |
| Compiler | `src/lib/smart-routing/flow-compiler.ts` |
| Publish | `src/lib/smart-routing/flow-service.ts` — `updateFlowDraft`, `publishFlow`, `rollbackFlow` |
| Templates | `src/lib/smart-routing/templates.ts` |
| Workspace context | `src/lib/smart-routing/workspace-settings.ts`, `context-builder.ts` |
| LLM transport | `src/lib/ai/llm-tools.ts` |
| Audit trail | `agent_configuration_changes` with `source=smart_routing_ai` |

## New AI layer

| File | Role |
|------|------|
| `src/lib/smart-routing/ai/types.ts` | Structured proposal schema |
| `src/lib/smart-routing/ai/capabilities.ts` | Capability registry |
| `src/lib/smart-routing/ai/model-config.ts` | `SMART_ROUTING_AI_*` env configuration |
| `src/lib/smart-routing/ai/context-builder.ts` | Workspace/flow/destination context |
| `src/lib/smart-routing/ai/tools.ts` | Bounded read tools |
| `src/lib/smart-routing/ai/llm-loop.ts` | LLM agent loop |
| `src/lib/smart-routing/ai/prompt.ts` | System prompt |
| `src/lib/smart-routing/ai/service.ts` | Propose, apply, reject, undo |
| `src/lib/smart-routing/ai/draft-helpers.ts` | Deterministic draft builders (tests + fallbacks) |
| `src/lib/smart-routing/ai/compare.ts` | Config diff for preview |
| `src/lib/smart-routing/ai/config-summary.ts` | Plain-language summaries |
| `src/lib/smart-routing/ai/analytics.ts` | Aggregated analytics for AI |
| `src/lib/smart-routing/ai/recommendations.ts` | Optimization recommendations |

## Database

- `SmartRoutingAiProposal` — proposal lifecycle and audit metadata
- `SmartRoutingAiRecommendation` — proactive insights
- Migration: `supabase/migrations/20260823_smart_routing_ai_assistant.sql`

## APIs

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/smart-routing/ai/propose` | POST | Create proposal / explain / analyze |
| `/api/smart-routing/ai/proposals` | GET | History + recommendations |
| `/api/smart-routing/ai/proposals/[id]` | GET | Single proposal |
| `/api/smart-routing/ai/proposals/[id]/apply` | POST | Apply after approval |
| `/api/smart-routing/ai/proposals/[id]/reject` | POST | Cancel proposal |
| `/api/smart-routing/ai/proposals/[id]/undo` | POST | Undo applied change |
| `/api/smart-routing/ai/recommendations/dismiss` | POST | Dismiss recommendation |

## UI

- `src/components/smart-routing/ai-assistant.tsx` — prominent assistant card
- `src/components/smart-routing/overview-view.tsx` — overview integration
- `src/components/smart-routing/builder-view.tsx` — Edit with AI in builder

## Safety

- Never auto-publish; `apply` requires `awaiting_approval` + valid validation
- Optimistic concurrency via `baseFlowUpdatedAt` on apply
- Workspace-scoped queries on all AI data access
- LLM failure returns safe error; published routing untouched
- No PIN exposure; Bob/missing destination clarification
- Two-number invariants in prompt and existing destination policies

## Model configuration

Environment variables:

- `SMART_ROUTING_AI_PROVIDER`
- `SMART_ROUTING_AI_MODEL`
- `SMART_ROUTING_AI_FALLBACK_PROVIDER`
- `SMART_ROUTING_AI_FALLBACK_MODEL`
- `SMART_ROUTING_AI_MAX_TOKENS`
- `SMART_ROUTING_AI_MAX_ITERATIONS`
- `SMART_ROUTING_AI_TIMEOUT_MS`
- `SMART_ROUTING_AI_MIN_ANALYTICS_SAMPLE`

## Tests

```bash
npm run test:smart-routing-ai-assistant
```

Covers: build, modify, temporary routing, analytics facts, compare, provider independence (no telephony imports).

## Partial / follow-up

- Full LLM path requires configured provider keys in environment
- Automatic temporary routing restoration relies on `restoreFlowTemporaryRoutingIfExpired` on propose/apply — consider scheduled job for passive expiry
- Greeting generation (write/rewrite/TTS) is supported via existing builder; dedicated AI greeting API not added in V1
- Live PSTN smoke tests remain human-operated per AGENTS.md
