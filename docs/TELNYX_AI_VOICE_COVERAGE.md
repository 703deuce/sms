# Telnyx AI Voice — Before-implementation coverage matrix

**Date:** 2026-08-02  
**Source of truth:** current Telnyx API docs + this repo audit  
**Principle:** preserve working Call Control + AI Assistant paths; fill gaps without rebuilding.

## Status legend

| Status | Meaning |
|--------|---------|
| Fully implemented | UI + DB + service + Telnyx + webhook/reconcile path |
| Partially implemented | Meaningful path with material holes |
| UI-only | Page/shell without backend wiring |
| Database-only | Schema without writers on the live path |
| API-client-only | HTTP helper without product surface |
| Implemented but unused | Code exists off the live path |
| Stubbed | Mock/empty placeholder |
| Unsupported | Not present |
| Intentionally deferred | Explicitly off (e.g. outbound campaigns) |

## Capability matrix (Phase 1)

| Capability | Status | Notes |
|---|---|---|
| AI Assistants create/update/publish | Fully implemented | `syncTelnyxAssistant` → `/ai/assistants` |
| Assistant IDs durable storage | Fully implemented | `VoiceAgent.telnyxAssistantId` |
| Outbound AI dial + AMD | Fully implemented | `dialOutboundCall` + answer → `ai_assistant_start` |
| Inbound AI answer + start | Partially implemented | Softphone forward works; DID→agent join was unwired |
| Number → agent assignment | Partially implemented | Builder sets `phoneNumberId`; `VoiceAgentPhoneNumber` unused |
| Call Control app provisioning | Partially implemented | Manual `TELNYX_CONNECTION_ID`; no auto number attach |
| Phone-number routing rules | Partially implemented | `VoiceRoutingRule` + hours/prefix; depends on assignment |
| Tools (webhook/builtin/native) | Fully implemented | retrieval, webhook, transfer, handoff, hangup + Transovo builtins |
| Transfers cold/warm | Fully implemented | `transfers.ts` + warm-consult jobs |
| Webhooks + signature verify | Fully implemented | `/api/telnyx/voice` + `ProviderWebhookEvent` |
| Knowledge / RAG | Fully implemented | bucket upload + retrieval tool (mock without storage) |
| Memory (Telnyx) | Unsupported | — |
| Conversations API (Telnyx) | Partially implemented | Local UI only; `telnyxConversationId` unused |
| Transcripts | Partially implemented | transcription started; AI persist incomplete |
| Recordings | Fully implemented | `record_start` + ingest + player |
| Insights | Partially implemented | Heuristic/OpenAI; Telnyx insights_settings empty |
| Local agent versions / rollback | Fully implemented | `VoiceAgentVersion` |
| Canaries | Unsupported | — |
| Automated Telnyx tests/suites | Unsupported | Local testing lab / mock only |
| Dynamic variables | Implemented but unused | Validated/stored; not sent to Telnyx start/dial |
| Campaign concurrency | Fully implemented | Per-campaign only |
| Global AI concurrency | Unsupported | — |
| Usage metering / billing UI | Fully implemented | Internal rates, not Telnyx Usage API |
| Observability / Langfuse | Partially implemented | Event store + health; no Langfuse surface |
| MCP servers | Unsupported | — |
| Scheduled events (Telnyx) | Unsupported / deferred outbound | Campaign schedule = Transovo pacing |
| Widgets / web voice | Unsupported | — |
| SMS cross-channel assistant | Partially implemented | SMS tools exist; shared memory/timeline incomplete |
| Calendly booking from voice | Partially implemented | Internal calendar only; native Calendly `appointment.book` not wired |
| Multi-participant AI | Unsupported | Softphone conference is human path |
| Outbound AI campaigns / Missions | Intentionally deferred | Keep disabled in customer product |

## What works live today (preserve)

1. Publish agent → Telnyx AI Assistant sync (voice, model, tools).
2. Outbound AI dial with AMD + start assistant on answer.
3. Inbound AI when softphone forwarding targets `ai_agent`.
4. Mid-call tools via `/api/telnyx/voice/tools`.
5. Cold/warm transfer, recording ingest, knowledge RAG, post-call usage/insights.
6. Mock path when Telnyx env is absent.

## Biggest gaps blocking “works now”

1. DID → `VoiceAgentPhoneNumber` never written (pure AI inbound broken).
2. Dynamic variables not passed into `ai_assistant_start` / dial.
3. Voice `book_appointment` does not use Calendly Scheduling API when connected.
4. AI transcripts not reliably persisted for insights.
5. `/voice/numbers` is a shell.
6. Telnyx Memory / Canaries / MCP / Conversations / Widgets absent.

## Implementation waves (this pass)

| Wave | Focus |
|------|--------|
| A | Wire assignment + dynamic variables + Calendly book tool + coverage doc |
| B | Dynamic-variables webhook + AI transcript persist + numbers UI |
| C | Centralized capability registry + versions/canaries/tests against live OpenAPI |
| D | Memory, MCP, insights groups, widgets, multi-party (Telnyx-native) |

### Wave A landed (2026-08-02)

| Gap | Fix |
|---|---|
| DID → agent join unwired | `syncVoiceAgentPhoneAssignment` on draft save + publish; inbound uses `resolveInboundAiAgent` (join + `phoneNumberId` fallback) |
| Dynamic vars unused | `resolveCallDynamicVariables` → passed into `ai_assistant_start` / dial |
| Voice book ≠ Calendly | `book_appointment` + `calendar_availability` builtins prefer Calendly when connected |
| `/voice/numbers` shell | Shows agent DID + inbound join sync status |

### Still open after Wave A

Memory, canaries, MCP, Telnyx Conversations, AI transcript persist, dynamic-variables webhook URL, Telnyx insight groups, widgets, global concurrency, outbound campaign enablement (deferred).
