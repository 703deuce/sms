# Telnyx AI Voice — After-implementation matrix

**Date:** 2026-08-02  
**Branch:** `cursor/telnyx-ai-voice-completion-b56f`

## Preserved (unchanged live paths)

- Publish → `POST/PATCH /ai/assistants` via `syncTelnyxAssistant`
- Outbound dial + AMD + `ai_assistant_start`
- Softphone → AI forward, tools webhook, cold/warm transfer
- Knowledge RAG (`/ai/embeddings` + storage)
- Recordings, post-call usage/insights heuristics, mock mode

## End-to-end wiring (setting → DB → service → Telnyx → webhook → UI → test)

| Capability | Client | DB | API/UI | Webhook/runtime | Status |
|---|---|---|---|---|---|
| Normalized AI entities | — | 18 Prisma models + SQL | — | — | Done |
| Centralized AI client | `telnyx/ai-client.ts` | — | — | — | Done |
| Capability registry | `capability-registry.ts` | — | `/voice/ai-platform` | — | Done (live) |
| Assistant enrich | `updateAssistant` | Memory/MCP/InsightGroup/Obs | publish + `enrich_remote` | dynamic-variables URL | Done |
| DID assignment | — | `VoiceAgentPhoneNumber` | `/voice/numbers` + builder | inbound resolve | Done |
| Dynamic variables | start/dial injection | `VoiceCall.dynamicVariables` | builder | `/api/telnyx/voice/dynamic-variables` | Done |
| Calendly book from voice | Transovo integrations | appointments | tools | — | Done |
| Versions sync/promote | versions.* | `VoiceRemoteAssistantVersion` | builder + AI platform | — | Done |
| Canary | canary.* | `VoiceCanaryDeploy` | builder + AI platform | — | Done |
| Tests / suites / runs | tests.* | Test/Suite/Run | seed + run + poll | — | Done |
| Scheduled events | scheduled_events.* | `VoiceScheduledEvent` | AI platform SMS | gated phone_call | Done |
| Memory | privacy_settings | `VoiceMemoryConfig` | builder + platform | enrich on publish | Done |
| Insights / groups | conversations/insights* | Insight* models | create/sync/attach | `/api/telnyx/voice/insights` | Done |
| MCP (approved only) | mcp_servers.* | `VoiceMcpServer` | register/approve/reject | enrich attaches approved | Done |
| Telnyx integrations catalog | integrations.* | — | GET view | — | Done |
| Conversations + transcripts | conversations.* | AiConversation* + Transcript | sync UI | transcription events | Done |
| Transfer destinations | transfer tool | `VoiceTransferDestination` | builder + API | sync into tools on publish | Done |
| DTMF | `sendDtmf` | tool executions | builtin + API | charset validated | Done |
| Widget | chatAssistant | `VoiceWidgetConfig` | embed + public chat API | domain/rate gates | Done |
| Chat preview | chatAssistant | — | AI platform console | — | Done |
| Concurrency / spend | — | `VoiceConcurrencyAllocation` | AI platform | `assertAiCallAdmission` | Done |
| Emergency stop | — | `VoiceAgent.emergencyDisabled` | builder + platform | start path checks | Done |
| Failure diagnostics | — | `VoiceFailureDiagnostic` | AI platform list | admission + start failures | Done |
| Clone (local + Telnyx) | cloneAssistant | VoiceAgent | AI platform | — | Done |
| Multi-party AI | start on conference | `multiPartyEnabled` | flags UI | queue overflow gate | Done |
| Observability | enabled_features | `VoiceObservabilityConfig` | builder + enrich | — | Done |

## Intentionally deferred / gated

| Capability | Gate |
|---|---|
| Unrestricted outbound AI campaigns / Missions | `outboundAiEnabled=false` by default; phone_call scheduled events require consent |
| Arbitrary customer MCP servers | `approved=false` until review; only approved IDs attached to assistants |
| Bulk purchased-list dialing | Not exposed |
| Langfuse customer login | Observability config stored; diagnostics stay in Transovo |

## Environment variables

Existing: `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_CONNECTION_ID`, `APP_URL`, storage/RAG vars, voice rate cards.

AI Assistants need `TELNYX_API_KEY`; Call Control still needs `TELNYX_CONNECTION_ID`.

## Webhook / public routes

| Route | Events / purpose |
|---|---|
| `/api/telnyx/voice` | Call Control + AI lifecycle + transcription/conversation persistence |
| `/api/telnyx/voice/tools` | Assistant webhook tools |
| `/api/telnyx/voice/dynamic-variables` | Dynamic variable resolution at conversation start |
| `/api/telnyx/voice/insights` | Insight group webhook ingest |
| `/api/public/voice/widget/chat` | Embeddable chat (allowlist + rate limit) |
| `/embed/voice/[agentId]` | Widget UI |

## Database

- Prisma models in `prisma/schema.prisma`
- Apply: `supabase/voice-ai-platform-fields.sql` (or `prisma db push` in Coolify deploy)

## Workers

No new job types for sync actions (request-path). Existing: `voice_webhook_process`, `voice_post_call`, `voice_tool_execute`, `voice_recording_ingest`, etc.

## Permissions / UI

- App nav: Voice → AI platform (`/voice/ai-platform`)
- Agent builder section: **AI Platform**
- Session auth on `/api/voice/ai`; public widget + Telnyx webhooks only on listed routes

## Tests

- Contract: `node scripts/test-voice-ai-platform.mjs`
- Live Telnyx acceptance still requires account credentials + DID (env-gated)

## Production checklist

1. Coolify must run SQL/`prisma db push` for new tables before platform UI writes
2. Confirm canary `rules` schema for account plan
3. Seed + run `transovo-default` suite against a published assistant
4. Point insight group `webhook_url` at `/api/telnyx/voice/insights`
5. Validate multi-party with `multiPartyEnabled` on a conference overflow path
