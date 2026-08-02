# Telnyx AI Voice — Honest capability matrix

**Date:** 2026-08-02  
**Rule:** A capability is **Fully implemented** only when:  
Customer setting → DB → service → (queue) → Telnyx API → stored external ID → webhook reconciliation → UI/diagnostics → automated test → live acceptance.

| Legend | Meaning |
|--------|---------|
| **Fully** | Full path above is proven (mock or live) for the happy path |
| **Partial** | Meaningful wiring with material holes |
| **Client-only** | `ai-client` method exists; no product path |
| **DB-only** | Schema/flags without writers or enforcement |
| **Stubbed** | Placeholder / instructional only |
| **Unsupported** | Not present |
| **Deferred** | Intentionally off |

---

## Summary counts (phases 2–30)

| Status | Approx. share |
|--------|----------------|
| Fully | Few core telephony paths (publish sync, DID assign, cold/warm transfer mock-proven, booking tool, emergency stop, main webhook verify) |
| Partial | Majority of advanced Telnyx AI surfaces |
| Client-only / Unsupported / Deferred | Import/enhance, SIP REFER, STT config, Langfuse dashboard, live 38-scenario suite, outbound campaigns |

---

## Phase-by-phase matrix

### Phase 2 — Normalized model
| Entity | Status | Notes |
|--------|--------|-------|
| VoiceAgent / Version / Phone assignment | Partial→wired | Present + writers |
| Knowledge base / source / tool / tool execution | Partial | Builtin executions now log (toolId optional) |
| Routing rule / transfer destination / canary / memory / AI conversation | Partial | Present |
| Assistant template (DB) | Unsupported | Code templates only |
| VoiceAiConversationMessage | Partial | Written on `sync_conversations` |

### Phase 3 — Client + registry
| Item | Status |
|------|--------|
| Centralized `ai-client` | Partial (hand-written OpenAPI wrappers, no retry/idempotency on mutate) |
| Capability registry | Wired (honest statuses) |
| OpenAPI-generated typed SDK | Unsupported |

### Phase 4 — Assistant lifecycle
| Item | Status |
|------|--------|
| Create/update/publish sync | Partial (wired; live acceptance pending) |
| Clone | Partial |
| Delete remote / import / enhance / tags UI | Client-only / Partial |

### Phase 5 — Inbound routing
| Item | Status |
|------|--------|
| AI answer + DID join | Wired |
| human_first / ai_after_hours / overflow | Partial (runtime + UI actions; not all modes polished) |
| Full safeguard matrix | Partial |

### Phase 6 — Dynamic variables
| Item | Status |
|------|--------|
| Resolve + start/dial inject + webhook | Wired |
| Memory excludeFields / mode=none redaction | Wired |
| Full CRM/custom source pipeline + redacted diagnostics UI | Partial |

### Phase 7 — Tools
| Item | Status |
|------|--------|
| Native + Transovo builtins (incl. DTMF, end_call) | Wired |
| Async tool queue | Partial (enqueue path wired) |
| SIP REFER tool | Unsupported |

### Phase 8 — Transfers
| Item | Status |
|------|--------|
| Cold / warm / return-to-AI | Wired |
| Named destinations + transfer-leg cap | Wired |
| SIP REFER | Unsupported |

### Phase 9 — Handoffs
| Item | Status |
|------|--------|
| Handoff tool on publish | Partial |
| Loop prevention / analytics | Unsupported |

### Phase 10 — DTMF
| Item | Status |
|------|--------|
| Builtin + API + validation | Wired |

### Phase 11 — Conversations
| Item | Status |
|------|--------|
| Sync list + messages | Partial |
| Update/delete/retention jobs | Unsupported / Partial |

### Phase 12 — Knowledge
| Item | Status |
|------|--------|
| Create/upload/attach/RAG | Wired |
| Full CRUD + real citations | Partial |

### Phase 13 — Memory
| Item | Status |
|------|--------|
| Save / clear / enrich privacy | Partial |
| Preview / audit | Unsupported |

### Phase 14 — Versions
| Item | Status |
|------|--------|
| Local rollback + remote sync/promote | Partial |
| Compare + publish gate on tests | Unsupported |

### Phase 15 — Canary
| Item | Status |
|------|--------|
| Upsert/delete | Partial |
| Per-version metrics | Unsupported |

### Phase 16 — Tests
| Item | Status |
|------|--------|
| Seed 12-suite + run/poll | Partial |
| Gate publish on pass / schedule regression | Unsupported |

### Phase 17 — Scheduled events
| Item | Status |
|------|--------|
| SMS + quiet hours + suppression | Partial |
| phone_call outbound | Deferred (gated) |

### Phase 18 — Insights
| Item | Status |
|------|--------|
| Seed 14 defaults + signed webhook | Partial |
| CRM/timeline from Telnyx insights | Partial (still mostly post-call heuristic) |

### Phase 19 — MCP
| Item | Status |
|------|--------|
| Register / approve / reject / attach | Partial |
| Transovo-hosted MCP server | Unsupported |
| Arbitrary customer MCP | Deferred |

### Phase 20 — Integrations
| Item | Status |
|------|--------|
| Telnyx catalog metadata | Wired |
| Transovo CRM/calendar SoT | Fully (by design) |

### Phase 21 — Multi-party
| Item | Status |
|------|--------|
| Flag + conference overflow gate | Partial |
| Silent/listen/exit modes | Unsupported |

### Phase 22 — Widget
| Item | Status |
|------|--------|
| Embed chat + allowlist/rate/CAPTCHA require | Partial |
| WebRTC voice preview / ephemeral browser creds | Unsupported |

### Phase 23 — SMS cross-channel
| Item | Status |
|------|--------|
| send_sms builtin | Partial |
| Telnyx smsChatAssistant product path | Client-only |
| Unified voice+SMS timeline | Unsupported |

### Phase 24 — Speech/model
| Item | Status |
|------|--------|
| Voice/language/model/temperature | Partial |
| STT provider/model/keyterms/custom LLM | Unsupported |

### Phase 25 — Observability
| Item | Status |
|------|--------|
| Config enrich | Partial |
| Latency dashboard / Langfuse customer UI | Unsupported / Deferred |

### Phase 26 — Usage / concurrency
| Item | Status |
|------|--------|
| Minutes billing + admission + soft alert + spend + transfer legs | Wired |
| Plan/trial/overage product | Unsupported |

### Phase 27 — Webhooks
| Item | Status |
|------|--------|
| Main Call Control verify/dedup/process | Fully (code path) |
| Insight webhook verify | Wired |
| Scheduled/test-run completion / DLQ | Unsupported / Partial |

### Phase 28 — Security
| Item | Status |
|------|--------|
| Workspace isolation / emergency / SSRF allowlist / MCP approve | Wired / Partial |
| Retention workers / PII log redaction / prompt-injection system | Partial / Unsupported |

### Phase 29 — UI
| Item | Status |
|------|--------|
| Agents + builder (12 sections) + AI platform ops | Partial |
| Full 21-tab builder + rich conversation detail | Partial / Unsupported |

### Phase 30 — Acceptance
| Item | Status |
|------|--------|
| Contract file checks | Partial |
| Mock e2e subsets | Partial |
| Live 38-scenario suite with Telnyx IDs | Unsupported |

---

## Intentionally deferred

- Unrestricted outbound AI campaigns / Missions (`outboundAiEnabled=false`)
- Bulk / purchased-list dialing
- Unapproved customer MCP
- Customer Langfuse login
- phone_call scheduled events without consent

## Needs live Telnyx traffic / support

1. Real inbound DID → assistant start evidence IDs  
2. Dynamic-variables webhook payload variants  
3. Suite seed/run against live `/ai/assistants/tests*`  
4. Canary rules schema vs plan  
5. Signed insight webhooks → CRM  
6. MCP tool invocation  
7. Multi-party conference AI  
8. Widget chat live  
9. All 38 acceptance scenarios  

## Preserved working paths

- Publish → Telnyx assistant sync  
- Outbound dial + AMD + `ai_assistant_start`  
- Softphone → AI forward, tools webhook, cold/warm transfer  
- Knowledge RAG, recordings, post-call usage  
- Mock mode without Telnyx env  
