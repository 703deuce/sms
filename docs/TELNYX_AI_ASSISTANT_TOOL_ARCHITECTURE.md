# Telnyx AI Assistant Tool Architecture (Amy 866)

**Status:** Implemented — conversation workflow migration complete in codebase  
**Production path:** +18663464256 → TeXML direct → Telnyx AI Assistant (**not LiveKit**)  
**Agent ID:** `cmshz2lc25c622c4i58303501`  
**Telnyx assistant:** `assistant-197f496d-d98a-4995-ad0e-a10aca90951d`  
**Republish:** `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/amy-workflow-republish.ts`

---

## 1. Old architecture

Single Telnyx AI Assistant with:

- One monolithic instruction blob
- **Flat tool list** — all published webhooks visible on every turn
- Model-facing tools: `send_sms`, `record_call_fact`, `take_structured_message`, `lookup_customer`, `escalate_human`, native `hangup`
- All webhooks → `/api/telnyx/voice/tools`
- Transovo `workflow-engine` state machine in dynamic variables (legacy booking path)
- Post-call: `voice_post_call` worker → CRM, insights, automations

**Problems:** model saw bookkeeping tools (`record_call_fact`), CRM lookup, and SMS templates on ordinary FAQ turns; long tool chains; model supplied trusted parameters (phone, URLs).

---

## 2. New architecture

```
Caller → TeXML → Telnyx AI Assistant
                    ├─ Rich base prompt (company knowledge)
                    ├─ Conversation Workflow (capability scopes)
                    │    ├─ GENERAL (0 custom tools)
                    │    ├─ ACTION (send_resource)
                    │    ├─ DETAILED_LOOKUP (search_business_details)
                    │    ├─ HUMAN (native transfer)
                    │    ├─ RECOVERY (0 custom tools)
                    │    └─ CLOSING (native hangup)
                    ├─ Dynamic variables (fast local state)
                    └─ Shared tool library (/ai/tools)
                              ↓
              Narrow Transovo endpoints (authorize + execute)
              POST /api/voice/tools/send-resource
              POST /api/voice/tools/search-details
```

**Principle:** LLM converses; Telnyx workflows scope tools; Transovo owns truth, permissions, idempotency, side effects.

---

## 3. Capability classification

| Capability | Class | Implementation |
|------------|-------|----------------|
| Company identity, hours, services, FAQs | **A. Base knowledge** | Rich prompt / wizard knowledge |
| `business_open_now`, `booking_enabled`, caller name | **B. Dynamic context** | `resolveCallSessionContext` → dynamic-variables webhook |
| Text booking/quote link | **C. Live tool** | `send_resource` (ACTION node) |
| Transfer to human | **C. Live tool** | Native Telnyx transfer (HUMAN node) |
| Long-tail product/PDF specs | **D. Detailed retrieval** | `search_business_details` (DETAILED_LOOKUP) |
| CRM create/update, tags, notes | **E. Post-call** | `voice_post_call` worker (unchanged) |
| Caller name, service interest, address | **B + E** | Conversational capture → call metadata / post-call extraction |
| `record_call_fact` | **Retired from model** | `CallFactStore` + post-call if needed |
| `lookup_customer` | **Retired from model** | Init dynamic var `existing_customer`; CRM post-call |
| `take_structured_message` | **Retired from model** | Post-call structuring |
| `send_sms` / `escalate_human` | **Retired from model** | Replaced by `send_resource` + native transfer |

---

## 4. Final Telnyx workflow graph

Nodes (see `src/lib/voice/telnyx/conversation-workflow.ts`):

| Node | Purpose |
|------|---------|
| **GENERAL** | FAQ, ordinary conversation — no custom tools |
| **ACTION** | SMS resource links |
| **DETAILED_LOOKUP** | Long-tail knowledge |
| **HUMAN** | Transfer |
| **RECOVERY** | Failed SMS/transfer fallback |
| **CLOSING** | Goodbye + hangup |

**Routing:**

- **Semantic (LLM):** intent for booking/SMS, detailed lookup, human, goodbye, subject change
- **Deterministic (expression):** `resource_send_status` ∈ {`not_configured`,`temporarily_unavailable`}, `transfer_available == false`

---

## 5. Per-node tool visibility

| Node | Expected custom tools | Native |
|------|----------------------|--------|
| GENERAL | *(none)* | — |
| ACTION | `send_resource` | — |
| DETAILED_LOOKUP | `search_business_details` | optional RAG retrieval |
| HUMAN | — | `transfer` |
| RECOVERY | *(none)* | — |
| CLOSING | — | `hangup` |

Enforced via Telnyx `shared_tool_ids` + `tools_mode: replace` on each node.

---

## 6. Model-visible tool inventory

| Tool | Endpoint | Node |
|------|----------|------|
| `send_resource` | `/api/voice/tools/send-resource` | ACTION |
| `search_business_details` | `/api/voice/tools/search-details` | DETAILED_LOOKUP |
| `transfer` | Telnyx native | HUMAN |
| `hangup` | Telnyx native | CLOSING |

---

## 7. Removed / deferred tools (model surface)

| Tool | Disposition |
|------|-------------|
| `send_sms` | Replaced by `send_resource` |
| `record_call_fact` | Post-call / session metadata |
| `take_structured_message` | Post-call |
| `lookup_customer` | Dynamic var + post-call CRM |
| `escalate_human` | Native transfer |
| `continue_workflow`, `record_current_field`, `get_runtime_context` | Internal / legacy booking only |

Backend handlers preserved for rollback and non-workflow agents.

---

## 8. MODEL vs RUNTIME parameter ownership

| Tool | Model provides | Runtime owns |
|------|----------------|--------------|
| `send_resource` | `resource_type` | `workspace_id`, `call_id`, `caller_phone`, **`from` = +15714073615 (571)**, approved URL, template, idempotency key |
| `search_business_details` | `query` | `workspace_id`, `agent_id`, RAG buckets, auth |
| `transfer` | target selection (if multiple) | destination numbers, hours policy |
| `hangup` | — | call control |

---

## 9. Dynamic variable inventory

From `resolveCallSessionContext` (merged into dynamic-variables webhook when workflow mode):

| Variable | Purpose |
|----------|---------|
| `business_name`, `business_timezone` | Identity / clock |
| `booking_enabled`, `sms_enabled`, `quote_enabled`, `financing_enabled`, `directions_enabled` | Capability flags |
| `transfer_available`, `transfer_enabled` | Deterministic human routing |
| `resource_configured`, `available_resource_types` | SMS routing |
| `caller_name`, `existing_customer`, `customer_found` | Caller context |
| `resource_send_status`, `resource_send_type` | Post-tool machine state |
| `business_open_now`, `after_hours` | Hours routing (defaults safe) |

Legacy workflow JSON vars (`workflow_state`, `allowed_tools_json`) **skipped** in conversation workflow mode.

---

## 10. Deterministic vs semantic routing

| Condition | Router |
|-----------|--------|
| Caller wants person | LLM → HUMAN |
| Caller wants link/text | LLM → ACTION |
| Detailed technical question | LLM → DETAILED_LOOKUP |
| `resource_send_status == not_configured` | Expression → RECOVERY |
| `transfer_available == false` | Expression → RECOVERY |
| `booking_enabled == false` | Dynamic var (future edge) |
| Ordinary FAQ | Stay in GENERAL (0 tools) |

---

## 11. Tool result contract

Compact vocabulary (`src/lib/voice/tools/workflow-tool-contract.ts`):

```json
{ "ok": true, "status": "success", "result": "booking_link_sent", "speak": "...", "dynamic_variables": { "resource_send_status": "success" } }
```

Statuses: `success`, `not_found`, `not_configured`, `invalid_input`, `not_allowed`, `already_completed`, `temporarily_unavailable`, `timeout`.

Provider payloads and debug metadata stay server-side logs only.

---

## 12. Idempotency design

`send_resource`: stable key from `call_id` + `resource_type` + template idempotency key.

Duplicate `send_resource(booking)` → `already_completed` unless `force_resend`.

`resource_send_status` persisted on `voiceCall.metadata` for workflow edges.

---

## 13. Sync / async / post-call classification

| Operation | Timing |
|-----------|--------|
| `send_resource` | **SYNC** — caller must hear truthful send result |
| `search_business_details` | **SYNC** — answer in same turn |
| Transfer | **SYNC** |
| CRM upsert, tags, notes | **POST-CALL** |
| Call summary, insights | **POST-CALL** |
| Lead enrichment | **POST-CALL** |

Telnyx Post-Conversation Processing: not required; Transovo worker remains primary.

---

## 14. Post-call architecture

Unchanged: TeXML/conversation end → `voice_post_call` job → `processPostCall`.

Call/session metadata (`resource_send_type`, facts in `CallFactStore`) available for post-call CRM writes.

CRM outages do not block live calls.

---

## 15. Prompt architecture

Sections in wizard-built prompt + appendices:

- IDENTITY / ROLE
- COMPANY OVERVIEW, CORE SERVICES, HOURS, LOCATION
- COMMON CUSTOMER QUESTIONS, POLICIES
- APPOINTMENT / LEAD PROCESS (SMS-first)
- CONVERSATIONAL STYLE
- `CONVERSATION_WORKFLOW_PROMPT` (scoped tools)
- `MINIMUM_SIDE_EFFECT` reliability rules
- Per-node append instructions (small) in workflow graph

---

## 16. Test matrix

| # | Scenario | Expected |
|---|----------|----------|
| 1 | What does your company do? | NO TOOL |
| 2 | What time do you close? | NO TOOL |
| 3 | Tub-to-shower conversions? | NO TOOL |
| 4 | Can I make an appointment? | Conversational + booking resource offer |
| 5 | Text me the link | One `send_resource` |
| 6 | Same link twice | `already_completed` |
| 7 | Declines text | NO SMS |
| 8 | Detailed bathtub dimensions | `search_business_details` |
| 9 | Subject change mid-flow | Natural GENERAL return |
| 10 | Talk to someone | Transfer |
| 11 | Transfer unavailable | Honest fallback |
| 12 | SMS provider fails | No false success |
| 13 | Resource not configured | RECOVERY path |
| 14 | CRM unavailable | Call unaffected |
| 15 | Caller gives lead info | Retained without live CRM |
| 16 | Unsupported request | No random tool |
| 17 | Ambiguous request | Clarification |
| 18 | Interrupt / intent change | Workflow recovers |

**Automated:** `npx tsx scripts/test-conversation-workflow.ts`, `npx tsx scripts/test-caller-amy-orchestration.ts`, `npm run test:caller-amy-preprod`

**Live audit:** `AMY_CONVERSATION_WORKFLOW=1 node scripts/audit-caller-amy-published-tools.mjs`

---

## 17. Before / after results

| Metric | Flat (v54) | Workflow (target) |
|--------|------------|-------------------|
| Custom tools visible in GENERAL | 5 | 0 |
| Model parameters per SMS | 2–4 | 1 (`resource_type`) |
| Bookkeeping tools on surface | 3 | 0 |
| Deterministic failure routing | None | Expression edges |
| Automated regression | Pass (orchestration) | Pass (workflow script) |

Live call certification (26-scenario suite) requires production republish + real calls. Run after `amy-workflow-republish.ts`.

---

## 18. Remaining risks

1. **Telnyx account feature gate:** `conversation_flow` PATCH may 403 on some accounts — assistant-sync falls back to inline tools.
2. **Shared tool creation:** First republish creates org-level tools; verify display names in Telnyx console.
3. **RAG retrieval:** Optional `retrieval` shared tool not wired (`retrievalId = null`); `search_business_details` covers long-tail via Transovo resolver.
4. **Langfuse / Telnyx observability:** Deferred — correlate via `voiceToolExecution` + `providerWebhookEvent`.
5. **Real-call evals:** Tool-selection scoring requires live certification calls.

---

## 19. Production rollout

1. `amy-workflow-republish.ts` on staging/test assistant
2. `AMY_CONVERSATION_WORKFLOW=1` audit script
3. 18-scenario live certification on test number
4. Limited canary on +18663464256
5. Full production after PASS

---

## 20. Rollback procedure

1. Set `conversationWorkflowMode: false` in agent advanced config (or revert publish version).
2. Run `amy-minimum-side-effect-republish.ts` (flat v54 surface).
3. Verify audit with `AMY_CONVERSATION_WORKFLOW` unset (expects flat minimum tools).
4. Telnyx assistant snapshot (model, tools, instructions) recorded before workflow republish.

---

## SMS sender (866 inbound → 571 outbound)

Inbound calls on **+18663464256**; outbound resource texts send from **+15714073615** (HP-certified 571 A2P). Runtime resolves this via `resolveVoiceOutboundSmsFrom` — never exposed to the model. Override: `VOICE_OUTBOUND_SMS_FROM_E164`.

---

## Key source files

| Area | Path |
|------|------|
| Workflow graph | `src/lib/voice/telnyx/conversation-workflow.ts` |
| Sync to Telnyx | `src/lib/voice/telnyx/workflow-sync.ts` |
| Shared tools | `src/lib/voice/telnyx/shared-tools.ts` |
| Publish policy | `src/lib/voice/workflow-engine/tool-publish.ts` |
| send_resource | `src/lib/voice/tools/send-resource.ts` |
| search_details | `src/lib/voice/tools/search-business-details.ts` |
| Dynamic vars | `src/lib/voice/call-session-context.ts`, `src/lib/voice/dynamic-variables.ts` |
| Authorization | `src/lib/voice/workflow-engine/workflow-tool-guard.ts` |
| Phase 1 inventory | `docs/telnyx-conversation-workflow-phase1-inventory.md` |
