# Voice V3 restore/reconnect — pre-deployment report (REQUEST_ONLY, crawler, FileSearch)

**Branch:** `cursor/voice-v3-restore-reconnect-2304`  
**Date:** 2026-09-21  
**Status:** STOP BEFORE PRODUCTION DEPLOYMENT

Architecture freeze preserved: GPT-Live → Responses → Sol; no freshness changes; no delegation/SET→FIND/intake/filler edits.

---

## 1. REQUEST_ONLY files restored (origin SHA)

| File | Origin |
|------|--------|
| `src/lib/voice-v3/tools/submit-appointment-request-tool.ts` | `d275f9c3` |
| `src/lib/voice-v3/appointment-request/execute-submit-appointment-request.ts` | `d275f9c3` |
| `src/lib/voice-v3/appointment-request/persist-appointment-request.ts` | `d275f9c3` |
| Catalog + authorize wiring | adapted from `d275f9c3` |
| `scripts/test-voice-v3-request-only.ts` | new (compile/tool surface) |

**Not restored:** dialogue engines, `verbalConfirmation` call-context state machine, after-hours orchestration.

---

## 2. REQUEST_ONLY runtime flow

1. Wizard `bookingStrategy === "REQUEST_ONLY"` (or `request_only` service permission default).
2. Tool catalog exposes `submit_appointment_request` only; `find_availability` / `book_appointment` hidden.
3. Sol/GPT-Live collects intake via `update_intake` (conversational authority).
4. `submit_appointment_request` validates strategy, required intake (`book_appointment` requirements), phone.
5. `persistVoiceV3AppointmentRequest` → `callbackRequest` row (`sourceRoute: voice_v3_appointment_request`, idempotent metadata).
6. Structured `toolOk("appointment_requested", { requestId })`; optional staff notify via `notifyVoiceV3AppointmentBooked`.
7. Astra prompt append documents request-only mode (no live calendar tools).

---

## 3. Crawler files restored (origin SHA `55e48438`)

- `src/lib/voice-v3/knowledge/website-crawl/*` (constants `MAX_USEFUL_PAGES = 100`, discover, prioritize, ssrf, url-canonical, extract-html, extract-business-suggestions, run-crawl-job)
- `src/app/api/voice/knowledge/route.ts` — `scan_website` → enqueue crawl job
- `src/app/api/voice/knowledge/crawl/[jobId]/route.ts` — job status + pages
- `src/lib/jobs/job-handlers.ts` — `voice_website_crawl`
- `scripts/test-voice-v3-website-crawl.ts`

---

## 4. Prisma / schema changes

**Migration `20260921120000_voice_openai_vector_store`:** `voice_knowledge_bases.openaiVectorStoreId`, `openaiVectorStoreStatus`; `voice_knowledge_sources.openaiFileId`.

**Migration `20260921140000_voice_website_crawl_jobs`:** `voice_website_crawl_jobs`, `voice_website_crawl_pages` (+ indexes/FKs).

**Intentionally omitted from `55e48438` bundle:** `voice_v3_usage_events` billing ledger (out of scope this pass).

---

## 5. Crawl test results

`scripts/test-voice-v3-website-crawl.ts` — **PASS** (sitemap + sitemap index, same-origin, prioritization, SSRF rejects, content hash, HTML extract).

---

## 6. OpenAI ingestion files restored

| File | Origin |
|------|--------|
| `src/lib/voice/gpt-live-file-search-rag.ts` | `0ad68d4e` |
| `src/lib/voice/knowledge-processor.ts` | `0ad68d4e` (OpenAI path when `useGptLiveFileSearchRag()`) |
| `src/lib/voice-v3/knowledge/resolve-agent-knowledge-retrieval.ts` | `0ad68d4e` / `affb98c5` |
| `src/lib/voice-v3/knowledge/resolve-document-source-ids.ts` | `affb98c5` |
| `src/lib/voice-v3/knowledge/astra-knowledge-instructions.ts` | `0ad68d4e` |
| `src/lib/voice-v3/config/from-published-agent.ts` | wires `resolveAgentKnowledgeRetrieval` |
| `src/lib/voice-v3/config/compile-voice-v3-agent-config.ts` | `knowledgeRetrieval` + `openaiVectorStoreIds` |
| `src/lib/voice/python-runtime-bridge/voice-v3-livekit.ts` | passes `openaiFileSearchVectorStoreIds` to worker |

**Not ported:** `search_business_knowledge` FunctionTool (V3 uses native FileSearch when vector stores exist; hot context + prompts otherwise).

---

## 7. Crawl → file → vector store flow

```
scan_website API
  → enqueueVoiceWebsiteCrawlJob (voice_website_crawl job)
  → runVoiceWebsiteCrawlJob (discover/prioritize/fetch, cap MAX_USEFUL_PAGES)
  → voiceKnowledgeSource per page + processKnowledgeSource / syncTextSourceToOpenAiVectorStore
  → OpenAI files API + vectorStores.files
  → Prisma openaiFileId + knowledgeBase.openaiVectorStoreId
  → resolveAgentKnowledgeRetrieval → compile knowledge.retrieval.openaiVectorStoreIds
  → resolveVoiceV3LiveKitSession → Python FileSearch(vector_store_ids)
```

---

## 8. Current V3 does not depend on Telnyx RAG (live path)

- Live retrieval: **OpenAI FileSearch** via LiveKit when `openaiVectorStoreIds` present.
- `knowledge-processor` still supports Telnyx for legacy/non-V3 consumers when `VOICE_KNOWLEDGE_TELNYX_RAG=1` or OpenAI path disabled.
- No `search_business_knowledge` tool on the GPT-Live tool surface when vector stores are configured.

---

## 9. `openaiVectorStoreIds` resolution / compile proof

- `resolveAgentKnowledgeRetrieval` loads KB links + indexed sources + `listOpenAiVectorStoreIdsForKnowledgeBases`.
- `compileVoiceV3AgentConfig({ knowledgeRetrieval })` sets `knowledge.retrieval.openaiVectorStoreIds`.
- `scripts/test-voice-v3-knowledge-retrieval.ts` — **PASS** (IDs on config, no custom search tool, file_search prompt text).
- Agent with no KB: compile with empty retrieval → **no vector IDs** (test included).

**Live OpenAI upload certification:** Still required before production confidence — Node tests use compile/mocks; crawler unit tests do not hit OpenAI API. Recommend one staging KB crawl + `processKnowledgeSource` smoke with real `OPENAI_API_KEY` before deploy.

---

## 10. Wizard → runtime mappings

| Wizard field | V3 compile / runtime |
|--------------|----------------------|
| agentName | `identity.agentName`, prompts |
| businessName | `businessName`, greeting interpolation |
| voiceId / custom voice | `telephony.liveVoiceId`, `liveVoiceOutput` |
| language, tone, role, speakingStyle | `conversation.*`, live frontend instructions |
| openingGreeting | interpolated `conversation.openingGreeting` |
| services / appointmentTypes | `services[]`, service policy |
| bookingStrategy | `scheduling.bookingStrategy` (+ REQUEST_ONLY / SEND_LINK prompt append) |
| calendar | `calendar` when MICROSOFT_365 |
| callback | `callHandling.*`, callback instructions |
| transfer | `transfer`, `transferDestinations`, compile transfer policy |
| knowledge | `knowledge.retrieval` + hot context + `buildAstraKnowledgeInstructions` |

**Demo fallback:** `VOICE_V3_BOOKING_AGENT_CONFIG` only when wizard snapshot missing; **ACTIVE** agents without wizard now log `VOICE_V3_ACTIVE_AGENT_MISSING_WIZARD_SNAPSHOT` (no silent demo for production diagnosis).

**Not in scope:** full `instructions.system` field (not present on wizard type); custom copy continues via guardrails, knowledge items, hot context.

---

## 11. Production demo / env fallback behavior

- Missing wizard → `envFallback` (`VOICE_V3_BOOKING_AGENT_CONFIG`) — dev/test only; explicit observability log for ACTIVE agents.
- Microsoft connection env vars still used when no DB calendar row (unchanged).

---

## 12. Transfer test results

`scripts/test-voice-v3-transfer-system.ts` — **PASS** (E.164, waterfall, WARM mode, billing usage metadata).

---

## 13. Python FileSearch change (summary)

**File:** `voice-runtime-python/transovo_voice/voice_v3/session.py`

- Import `FileSearch` from `livekit.plugins.openai.tools`.
- After building Transovo FunctionTools, if `openaiFileSearchVectorStoreIds` non-empty → append `FileSearch(vector_store_ids=cleaned_vs)` before `end_call` tools.
- If empty → no FileSearch attached.

---

## 14. FileSearch additive to GPT-Live / Responses

**Yes.** `GPTLiveModel(model="gpt-live-1", delegation="responses", ...)` unchanged; FileSearch is an additional provider tool on the same session tool list.

---

## 15. No dual RAG FunctionTool when FileSearch active

**Yes.** Catalog does not include `search_business_knowledge`; knowledge test asserts it is absent when `openaiVectorStoreIds` set.

---

## 16. SEND_LINK regression

`scripts/test-voice-v3-send-booking-link-matrix.ts` — **14/14 PASS** (unchanged).

---

## 17. Booking persistence regression

`scripts/test-voice-v3-booking.ts` — **PASS** (Phase 1 path unchanged).

---

## 18. Qualification / urgency regression

`scripts/test-voice-v3-qualification-urgency.ts` — **PASS**.

---

## 19. All tests run

| Script | Result |
|--------|--------|
| test-voice-v3-request-only | PASS |
| test-voice-v3-knowledge-retrieval | PASS |
| test-voice-v3-website-crawl | PASS |
| test-voice-v3-qualification-urgency | PASS |
| test-voice-v3-service-policy | PASS |
| test-voice-v3-booking | PASS |
| test-voice-v3-send-booking-link-matrix | 14/14 PASS |
| test-voice-v3-transfer-system | PASS |

---

## 20. Files changed

See `git diff` on branch (REQUEST_ONLY, crawler, knowledge/OpenAI, prisma, Python session, prompts, livekit bridge, tests, docs).

---

## 21. Commit SHA

`26c2f897` — `feat(voice-v3): REQUEST_ONLY, website crawl, and OpenAI FileSearch ingestion`

---

## 22. Production deployment

**NO production deployment occurred.** No Coolify build triggered. Python worker change is bundled locally for a **single** rebuild when you approve deploy.

---

## Freshness

**Untouched** (`markCallerTurnSemanticApplied`, Responses cancel, stale tool presentation).

---

## Follow-up (post-deploy)

- Staging OpenAI vector store ingestion smoke after real crawl.
- Prompt optimization: lean hot context + FileSearch for long-tail website content (user-noted; not this pass).
