# New-App AI Receptionist V3 — completion status

**Branch:** `cursor/ar-v3-greenfield-f350`  
**Production app:** `new-app` → https://transovo.ai  
**Runtime target:** Telnyx → LiveKit SIP → Python GPT-Live V3 worker → `new-app` `/api/internal/voice-runtime`

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Draft / save / publish / pause / resume / discard | **Implemented** | `VoiceAgent` + `VoiceAgentVersion`; `AgentProvider` uses APIs |
| Receptionist APIs | **Implemented** | `new-app/app/api/receptionist/*` |
| Worker internal API (new-app) | **Partial** | Session resolve + basic tools; scheduling/transfer tools **not ported** |
| All 10 UI routes on real data | **Partial** | Overview, calls, call detail wired; knowledge/analytics/test still mix fixtures in components |
| LiveKit provisioning | **Pending** | `phone-assignment` updates routing JSON; no LiveKit API reconcile in new-app yet |
| Calendar tool backend | **Pending** | Requires port of `src/lib/voice-v3` scheduling stack into new-app |
| PSTN live acceptance | **Pending** | Documented below |

## Routes

| Route | Backend | Persistence |
|-------|---------|-------------|
| `/app/receptionist` | `GET /api/receptionist/overview` | `VoiceCall`, `VoiceKnowledgeGap`, `VoiceCalendarConnection` |
| `/app/receptionist/calls` | `GET /api/receptionist/calls` | `voice_calls` |
| `/app/receptionist/calls/[id]` | server `getReceptionistCall` | `voice_calls`, transcripts, recordings |
| `/app/receptionist/agent` | `AgentProvider` → draft API | `voice_agents.draftConfig` |
| `/app/receptionist/knowledge` | partial APIs `knowledge/faqs`, `gaps` | `voice_knowledge_*` — UI still loads demo FAQs until wired |
| `/app/receptionist/appointments` | draft via AgentProvider | draft JSON |
| `/app/receptionist/call-handling` | draft via AgentProvider | draft + `workspace_call_routing` |
| `/app/receptionist/test` | **Pending** | LiveKit browser test not wired |
| `/app/receptionist/analytics` | API exists; page may still use fixtures | `voice_calls` aggregates |
| `/app/receptionist/activate` | publish API via AgentProvider | versions |

## Key paths

- Domain: `new-app/lib/server/receptionist/**`
- Client API: `new-app/lib/receptionist-api.ts`
- Worker bridge: `new-app/app/api/internal/voice-runtime/route.ts`
- Python worker (unchanged): `voice-runtime-python/transovo_voice/voice_v3/`

## Environment (production)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma |
| `TRANSOVO_INTERNAL_API_KEY` | Worker → new-app internal API |
| `TRANSOVO_BACKEND_URL` | Worker base URL (https://transovo.ai) |
| `OPENAI_API_KEY` | GPT-Live worker |
| LiveKit SIP / Telnyx | Existing platform secrets |

## Tests

```bash
cd new-app
DATABASE_URL=... RECEPTIONIST_TEST_BASE_URL=http://127.0.0.1:3001 node scripts/test-receptionist-complete.mjs
```

## Live checks remaining

1. Point `TRANSOVO_BACKEND_URL` at transovo.ai and confirm worker `GET /api/internal/voice-runtime`.
2. Publish receptionist; verify `VoiceAgentVersion` row and routing policy `receptionistAgentId`.
3. Inbound PSTN to assigned DID → LiveKit room → session resolve → first audio.
4. Calendar find/book against connected `VoiceCalendarConnection` (after scheduling port).
5. Recording + transcript post-call pipeline (after port from monolith).

## Honest gaps

- Full Voice V3 tool catalog and Microsoft/Google/Calendly adapters are **not** duplicated into new-app yet; worker scheduling tools return `TOOL_NOT_PORTED` until ported.
- Knowledge and analytics UI components may still import `lib/data` fixtures — APIs are ready for glue pass.
- LiveKit dispatch/trunk idempotent reconcile not implemented in new-app (monolith provisioning still authoritative until cutover).
