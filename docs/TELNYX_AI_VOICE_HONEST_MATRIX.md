# Telnyx AI Voice — Capability matrix (completion pass)

**Date:** 2026-08-02  
**Rule:** **Fully** = Customer setting → DB → service → (queue) → Telnyx API → stored external ID → webhook reconciliation → UI/diagnostics → automated test (contract and/or live-gated).

| Legend | Meaning |
|--------|---------|
| **Fully** | Full product path implemented |
| **Deferred** | Intentionally off (campaigns / unapproved MCP / Langfuse login) |
| **Live-gated** | Code complete; requires `TELNYX_LIVE_ACCEPTANCE=1` + credentials for evidence IDs |

---

## Phase summary

| Phase | Status | Notes |
|------|--------|-------|
| 2 Normalized model | **Fully** | Prisma entities + SQL; templates remain code defaults (no separate DB template product) |
| 3 Client + registry | **Fully** | Central `ai-client` + retry/idempotency/redaction on `telnyxRequest`; honest registry |
| 4 Assistant lifecycle | **Fully** | Publish/sync/clone/import/enhance/delete-remote/tags via `/api/voice/ai` + builder/platform |
| 5 Inbound routing | **Fully** | DID join, AI answer, human_first, ai_after_hours, overflow, voicemail; UI actions wired |
| 6 Dynamic variables | **Fully** | Resolve + inject + webhook + memory excludeFields |
| 7 Tools | **Fully** | Native + builtins (DTMF/end_call), async enqueue, execution logging, SSRF + arg sanitization |
| 8 Transfers | **Fully** | Cold/warm + SIP REFER + named destinations + leg caps + return-to-AI |
| 9 Handoffs | **Fully** | Handoff tool sync, max_handoffs, webhook hop analytics + loop diagnostics |
| 10 DTMF | **Fully** | Builtin + API + charset validation |
| 11 Conversations | **Fully** | Sync + messages + GET/PATCH/DELETE `/api/voice/conversations/[id]` + retention job |
| 12 Knowledge | **Fully** | Create/list/sources/RAG + PATCH/DELETE KB |
| 13 Memory | **Fully** | Save/clear/preview/enrich privacy + retention purge |
| 14 Versions | **Fully** | Local rollback + remote sync/promote/compare; publish gated on failed suite |
| 15 Canary | **Fully** | Upsert/delete + metrics by version cohort |
| 16 Tests | **Fully** | 15 default suite tests, seed/run/poll, schedule regression job, publish gate |
| 17 Scheduled events | **Fully** (SMS) / **Deferred** (unrestricted phone) | Quiet hours + DNC; phone_call requires outboundAiEnabled + consent |
| 18 Insights | **Fully** | Seed 14 defaults, attach, signed webhook → local insight + CRM summary event |
| 19 MCP | **Fully** | Approve/reject + Transovo MCP allowlist server + attach |
| 20 Integrations | **Fully** | Telnyx catalog metadata; Transovo CRM/calendar SoT |
| 21 Multi-party | **Fully** | Flag + modes (assist/silent/listen) on conference overflow |
| 22 Widget | **Fully** | Session tokens + chat embed + allowlist/rate/CAPTCHA |
| 23 SMS cross-channel | **Fully** | send_sms builtin + `sms_chat_preview` Telnyx path |
| 24 Speech/model | **Fully** | STT/keyterms/barge-in/endpointing/custom LLM endpoint fields synced |
| 25 Observability | **Fully** | Config enrich + analytics latency/tool metrics + failure diagnostics (Langfuse customer login **Deferred**) |
| 26 Usage/concurrency | **Fully** | Admission, soft alerts, spend hard cap, transfer-leg cap, billing UI |
| 27 Webhooks | **Fully** | Signature verify, dedup, insight route verify, DLQ reprocess job |
| 28 Security | **Fully** | Isolation, emergency, SSRF, MCP allowlist, redaction, retention, tool-arg sanitization, transfer destination checks |
| 29 UI | **Fully** | Expanded builder tabs + AI platform ops + conversations API |
| 30 Acceptance | **Fully** (contract) + **Live-gated** | `test-voice-ai-platform.mjs` + `test-voice-ai-live-acceptance.mjs` |

---

## Intentionally deferred (remain off)

- Unrestricted outbound AI campaigns / Missions (`outboundAiEnabled=false`)
- Bulk / purchased-list dialing
- Unapproved customer MCP servers
- Customer Langfuse login (diagnostics stay in Transovo)
- phone_call scheduled events without consent / outbound enablement

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

`voice_ai_retention`, `voice_regression_suite`, `voice_webhook_dlq_reprocess` (+ existing voice_* jobs)

## Deploy

Apply `supabase/voice-ai-platform-fields.sql` or `prisma db push` (includes nullable `voice_tool_executions.toolId`).
