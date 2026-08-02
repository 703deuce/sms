# Telnyx AI Voice — Capability matrix (completion pass)

**Date:** 2026-08-02 (updated)  
**Rule:** **Fully** = Customer setting → DB → service → (queue) → Telnyx API → stored external ID → webhook reconciliation → UI/diagnostics → automated test (contract and/or live-gated).

| Legend | Meaning |
|--------|---------|
| **Fully** | Full product path implemented |
| **Deferred** | Intentionally off (campaigns / unapproved MCP / Langfuse login) |
| **Live-gated** | Code complete; requires `TELNYX_LIVE_ACCEPTANCE=1` + credentials for evidence IDs |

---

## Product flow (required)

| Step | Status | Notes |
|------|--------|-------|
| Create agent + instructions / KB / voice / tools | **Fully** | Builder sections + draft autosave |
| **Build & test** (no phone required) | **Fully** | `buildVoiceAgentForTest` → Telnyx sync → status `TESTING` + MCP ensure |
| In-app talk before deploy | **Fully** | `AgentTestPanel` chat + mic + TTS via `chat_preview` |
| Assign DID + **Deploy to number** | **Fully** | `publishVoiceAgent` → `ACTIVE` + phone assignment; inbound requires number |

---

## Phase summary

| Phase | Status | Notes |
|------|--------|-------|
| 2 Normalized model | **Fully** | Prisma entities + SQL; templates remain code defaults |
| 3 Client + registry | **Fully** | Central `ai-client` + retry/idempotency/redaction |
| 4 Assistant lifecycle | **Fully** | Build/test vs deploy, clone/import/enhance/delete-remote/tags |
| 5 Inbound routing | **Fully** | DID join, AI answer, human_first, ai_after_hours, overflow, voicemail |
| 6 Dynamic variables | **Fully** | Resolve + inject + webhook + memory excludeFields |
| 7 Tools | **Fully** | Native + builtins, async enqueue + mid-call `addConversationMessage` inject |
| 8 Transfers | **Fully** | Cold/warm + SIP REFER + destinations + leg caps |
| 9 Handoffs | **Fully** | Handoff tool sync, max_handoffs, hop analytics, hangup after >3 hops |
| 10 DTMF | **Fully** | Builtin + API + charset validation |
| 11 Conversations | **Fully** | Sync + webhook → `VoiceAiConversationMessage` + CRUD + retention |
| 12 Knowledge | **Fully** | Create/list/sources/RAG + PATCH/DELETE KB |
| 13 Memory | **Fully** | Save/clear/preview/enrich privacy + retention purge |
| 14 Versions | **Fully** | Local rollback + remote sync/promote/compare UI |
| 15 Canary | **Fully** | Upsert/delete + version selector + start stamp for cohort metrics |
| 16 Tests | **Fully** | Suite seed/run + recurring re-enqueue + publish gate |
| 17 Scheduled events | **Fully** (SMS) / **Deferred** (unrestricted phone) | Quiet hours + DNC |
| 18 Insights | **Fully** | Seed defaults, attach, signed webhook → CRM |
| 19 MCP | **Fully** | Approve/reject + Transovo MCP ensure on build/deploy |
| 20 Integrations | **Fully** | Telnyx catalog metadata; Transovo CRM/calendar SoT |
| 21 Multi-party | **Fully** | Flag + modes on conference overflow |
| 22 Widget | **Fully** | Session required when `!testMode` + allowlist/rate/CAPTCHA |
| 23 SMS cross-channel | **Fully** | send_sms builtin + `sms_chat_preview` |
| 24 Speech/model | **Fully** | Builder barge-in/endpointing/noise + custom LLM fields synced |
| 25 Observability | **Fully** | Config enrich + analytics + failure diagnostics (Langfuse login **Deferred**) |
| 26 Usage/concurrency | **Fully** | Admission + trial/plan gates + spend hard cap + transfer-leg cap |
| 27 Webhooks | **Fully** | Signature verify, dedup, insight route, DLQ reprocess (daily tick) |
| 28 Security | **Fully** | Isolation, emergency, SSRF, MCP allowlist, redaction, retention |
| 29 UI | **Fully** | Build→test→deploy flow + expanded builder tabs |
| 30 Acceptance | **Fully** (contract) + **Live-gated** | Platform + live-gated smoke scripts |

---

## Intentionally deferred (remain off)

- Unrestricted outbound AI campaigns / Missions (`outboundAiEnabled=false`)
- Bulk / purchased-list dialing
- Unapproved customer MCP servers
- Customer Langfuse login (diagnostics stay in Transovo)
- phone_call scheduled events without consent / outbound enablement
- Browser WebRTC AI widget (chat + mic preview is in-app; phone AI is Call Control)

## Live validation still needed for traffic-dependent evidence

Run with `TELNYX_LIVE_ACCEPTANCE=1` and store `/tmp/voice-ai-live-evidence.json`:

1. Inbound DID → assistant start under real Call Control  
2. Dynamic-variables webhook payload variants  
3. Suite run against live tests API  
4. Canary percentage behavior on account plan  
5. Insight webhook → CRM under production traffic  
6. MCP tool invocation via Telnyx  
7. Multi-party conference AI  
8. Widget chat live  
9. SIP REFER on account that supports `actions/refer`  

---

## Key routes

| Route | Purpose |
|-------|---------|
| `/api/voice/ai` | Platform actions |
| `/api/voice/agents/[id]` | PATCH `build_for_test` / `deploy` |
| `/api/telnyx/voice` | Call Control + AI lifecycle |
| `/api/telnyx/voice/tools` | Tool webhooks |
| `/api/telnyx/voice/dynamic-variables` | Dynamic vars |
| `/api/telnyx/voice/insights` | Insight group webhooks |
| `/api/public/voice/mcp` | Transovo MCP allowlist server |
| `/api/public/voice/widget/session` | Short-lived widget tokens |
| `/api/public/voice/widget/chat` | Widget chat |
| `/embed/voice/[agentId]` | Embed UI |
| `/api/voice/conversations/[id]` | Conversation CRUD |
| `/api/voice/knowledge/[id]` | KB PATCH/DELETE |

## Jobs

`voice_ai_retention`, `voice_regression_suite` (recurring), `voice_webhook_dlq_reprocess` (+ existing voice_* jobs)

## Deploy

Apply `supabase/voice-ai-platform-fields.sql` or `prisma db push` (includes nullable `voice_tool_executions.toolId`).
Optional: `VOICE_PUBLISH_REQUIRE_SUITE=1`, `VOICE_MCP_SECRET`, `VOICE_WIDGET_SECRET`, `TELNYX_LIVE_ACCEPTANCE=1`.
