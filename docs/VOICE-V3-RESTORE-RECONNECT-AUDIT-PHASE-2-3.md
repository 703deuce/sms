# Voice V3 restore/reconnect — Phase 2 & 3 audits + Phase 2 minimum port

**Date:** 2026-09-21  
**Branch:** `cursor/voice-v3-restore-reconnect-2304`  
**Baseline accepted:** Phase 1 booking persistence (`bf89fa2b`) — unchanged this pass except regression re-run  
**Status:** STOP BEFORE PRODUCTION DEPLOYMENT

---

## 1. Qualification dependency trace (`d275f9c3`)

### Imports from `voice-receptionist-wizard/deterministic-rules`

| Consumer | Symbol used | Role |
|----------|-------------|------|
| `evaluate-qualification.ts` | `evaluateDeterministicFieldRule` | Compare intake field values to wizard rule rows |
| `evaluate-urgency.ts` | `evaluateDeterministicFieldRule` | Same for urgency rule rows |
| `after-hours-handling-types.ts` (master) | `VoiceV2DeterministicOperator` type only | Shared operator enum |

**Contents of historical `deterministic-rules.ts`:** ~70 lines — **pure business-rule operators** (`EQUALS`, `IN`, `EXISTS`, numeric compares). No dialogue, prompts, state machine, or tool sequencing.

**Classification:** pure business-rule logic + data normalization (lowercase trim, list split).

**Not imported from deterministic-rules by qualification/urgency:** any wizard dialogue engine, after-hours orchestration, or V1/V2 conversation controller.

### Other qualification/urgency dependencies

| Dependency | Classification | Current V3 equivalent |
|------------|----------------|------------------------|
| `qualification-types.ts` | Types only | Present on master |
| `after-hours-handling-types.ts` | Types + separate after-hours config module | Present; urgency **rules** now compiled into `callHandling.urgencyRules` |
| Intake `ctx.intake.values` | Runtime data | Canonical intake objective path |
| `config.qualification.*` | Compiled wizard | `compileVoiceV3AgentConfig` already populated; runtime evaluator was missing |

### Service policy / REQUEST_ONLY (`service-policy.ts`)

| Function | Purpose | Classification |
|----------|---------|----------------|
| `resolveActiveServicePolicy` | Delegates to `resolveBookingServiceForRuntime` | Pure policy |
| `serviceAllowsLiveBooking` | Blocks live FIND/BOOK when `request_only` / `staff_only` | Pure policy |
| `validateSlotAgainstServicePolicy` | Min notice + max horizon | Pure policy |
| `clampFindWindowToServiceHorizon` | FIND window clamp | Pure policy (not wired to find-dispatch yet) |
| `servicePolicyFromWizardType` | Compile appointment types → `VoiceV3ServiceConfig` | Data mapping |

**REQUEST_ONLY runtime:** `d275f9c3` adds `submit_appointment_request` tool + persist executor. **Intentionally not ported this pass** — separate tool surface; service policy gates live calendar tools only.

### Rejected from historical `d275f9c3` (not restored)

- Full gap-closure bundle (SMS recovery, billing, forensics, callback persist deltas) — out of scope
- `ctx.booking.verbalConfirmation` persistent state machine on call context
- `operatingPolicy` / after-hours **tool gating** block in `effective-tool-authorization` — `operatingPolicy` not on current `VoiceV3AgentConfig`
- `submit_appointment_request` / REQUEST_ONLY executor chain
- Blind import of any wizard “deterministic dialogue” modules beyond field operators

---

## 2. Historical `booking.verbalConfirmation` meaning

| Aspect | Historical (`d275f9c3`) |
|--------|-------------------------|
| Type | `NOT_REQUIRED` \| `AWAITING` \| `CONFIRMED` on `ctx.booking` |
| Source of truth | `config.scheduling.bookingBehavior.confirmBeforeBooking` |
| Set `AWAITING` | Slot selection / apply-slot-selection when confirmation required |
| Set `CONFIRMED` | `book_appointment` arg `caller_verbal_confirmed: true` |
| Gate | `call-rules.bookingReady` and `book-appointment-tool` |

**Current V3 equivalent (chosen approach):**

- **Config:** `confirmBeforeBooking` already compiled and used in legacy prompt builders.
- **Deterministic gate:** `book_appointment` tool arg `caller_verbal_confirmed` + `booking/verbal-confirmation.ts` helpers — **no** `verbalConfirmation` field on `VoiceV3CallContext`.
- **Conversational authority:** GPT-Live / Sol still obtains agreement; tool cannot commit without `caller_verbal_confirmed: true` when wizard requires confirmation.

**Rejected:** Adding `verbalConfirmation` to call context solely because historical code expected it.

---

## 3. Qualification code restored vs rejected

**Restored (minimum):**

- `src/lib/voice-receptionist-wizard/deterministic-rules.ts`
- `src/lib/voice-v3/qualification/evaluate-qualification.ts`
- `src/lib/voice-v3/urgency/evaluate-urgency.ts`
- `src/lib/voice-v3/policy/service-policy.ts`
- `src/lib/voice-v3/policy/effective-tool-authorization.ts` (qualification + service policy + transfer flag only)
- `src/lib/voice-v3/booking/verbal-confirmation.ts` (tool-arg gate only)
- Wiring: `call-rules.ts`, `authorize-tool-for-config.ts`, `compile-voice-v3-agent-config.ts`, `book-appointment-tool.ts`, `find-availability-tool.ts`, extended `VoiceV3ServiceConfig` / `urgencyRules`
- `scripts/test-voice-v3-qualification-urgency.ts`

**Rejected / deferred:**

- REQUEST_ONLY submit tool + persistence
- Urgency **actions** executor (TRANSFER/CALLBACK routing from urgency eval) — evaluator present; action wiring unchanged
- `clampFindWindowToServiceHorizon` in find-dispatch (follow-up)
- After-hours operating maturity gating in effective auth

---

## 4. Architecture found in `0ad68d4e` (knowledge / RAG)

**Commit message:** GPT Live `file_search` RAG via LiveKit, not Telnyx.

### Source files and runtime flow

```
Wizard / KB sources
  → knowledge-processor.ts (ingest)
      → syncTextSourceToOpenAiVectorStore (gpt-live-file-search-rag.ts)
      → OpenAI files API + vectorStores.files
      → Prisma voiceKnowledgeBase.openaiVectorStoreId

Publish / session start (Node)
  → resolve-agent-knowledge-retrieval.ts
      → listOpenAiVectorStoreIdsForKnowledgeBases
      → agentConfig.knowledge.retrieval.openaiVectorStoreIds

voice-v3-livekit.ts (Node → Python config payload)
  → openaiFileSearchVectorStoreIds[]

voice-runtime-python/session.py
  → livekit.plugins.openai.tools.FileSearch(vector_store_ids=cleaned_vs)
  → appended to GPTLiveModel session tools (alongside Transovo FunctionTools)

voice-tool-catalog.ts
  → search_business_knowledge FunctionTool DISABLED when openaiVectorStoreIds.length > 0
```

---

## 5. Does `0ad68d4e` use native OpenAI FileSearch provider tools?

**Yes.** Python attaches LiveKit OpenAI plugin `FileSearch(vector_store_ids=...)` on the **GPTLiveModel** session tool list. Retrieval is performed by **OpenAI** during the realtime/delegated Responses path, not by a custom Node embedding search in the live call loop.

Node `gpt-live-file-search-rag.ts` handles **ingestion** (vector store create, file upload, status wait) only.

---

## 6. Telnyx RAG / custom embedding on V3 path after `0ad68d4e`

| Layer | Behavior |
|-------|----------|
| **Ingestion** | `knowledge-processor.ts` prefers OpenAI vector store when `useGptLiveFileSearchRag()` true; Telnyx sync paths remain for legacy / `VOICE_KNOWLEDGE_TELNYX_RAG=1` |
| **Live V3 retrieval** | Intended: **no** `search_business_knowledge` FunctionTool when vector stores active; **no** Telnyx `similaritySearch` on that path |
| **Current master** | Still Telnyx-oriented `knowledge-processor.ts`; **no** `gpt-live-file-search-rag.ts`; **no** Python `FileSearch` wiring |

**Not resurrected on master in this pass.**

---

## 7. 100-page crawler (`55e48438`)

**Not restored on master in this pass.**

Historical pieces (preferred when ported):

- `src/lib/voice-v3/knowledge/website-crawl/*` (`MAX_USEFUL_PAGES = 100`, sitemap index, same-origin, prioritize)
- Job handler + `api/voice/knowledge/crawl/[jobId]`
- `scripts/test-voice-v3-website-crawl.ts`

---

## 8. Crawl → ingestion → vector store → FileSearch path (target)

```
website URL (wizard)
  → crawl job (55e48438) → text/HTML extract → voiceKnowledgeSource rows
  → processKnowledgeSource / knowledge-processor
  → syncTextSourceToOpenAiVectorStore (0ad68d4e)
  → OpenAI vector store + openaiFileId on source
  → resolveAgentKnowledgeRetrieval → openaiVectorStoreIds on compiled agent config
  → LiveKit session FileSearch provider tool (0ad68d4e Python)
  → GPT-Live delegation → Sol uses native retrieval (no second RAG layer)
```

**Separation preserved:** crawling ≠ runtime retrieval; Telnyx bucket storage on old rows does not force Telnyx runtime search for V3.

---

## 9. Python worker files that would change (Phase 3 port)

| File | Change |
|------|--------|
| `voice-runtime-python/transovo_voice/voice_v3/session.py` | Import `FileSearch`; append to `session_tools` when `openaiFileSearchVectorStoreIds` non-empty |

**Isolated change** — report before production worker rebuild. Not applied on master in this pass.

---

## 10. Wizard → Live instructions mapping

**Not completed this pass.** Master already compiles qualification/urgency into `VoiceV3AgentConfig`; manifest still lists some consumers as “future qualification executor” — update manifest in a focused docs/compile pass.

---

## 11. Transfer configuration alignment

**No code changes this pass.** Master retains `compile-transfer-config.ts` and transfer tools. Historical `d275f9c3` transfer deltas not cherry-picked.

---

## 12. Freshness wiring

**Not completed.** `markCallerTurnSemanticApplied` remains uncalled; `conversation-freshness` + `handle-delegated-voice-tools` unchanged. Stale-tool tests on master still authoritative.

---

## 13. SEND_LINK verification

**Re-run this pass:** `npx tsx scripts/test-voice-v3-send-booking-link-matrix.ts` → **TOTAL_PASS=14**

---

## 14. Tests and results

| Script | Result |
|--------|--------|
| `scripts/test-voice-v3-qualification-urgency.ts` | PASS |
| `scripts/test-voice-v3-booking.ts` | PASS |
| `scripts/test-voice-v3-send-booking-link-matrix.ts` | PASS (14) |
| `scripts/test-voice-v3-booking-persistence.ts` | Not re-run (requires `DATABASE_URL`) |

---

## 15. Files changed (this continuation)

See git diff on branch after audit commit. Summary:

- New: deterministic-rules, qualification, urgency, policy, verbal-confirmation (tool gate), test script, this doc
- Modified: agent-config, compile, defaults, call-rules, authorize-tool-for-config, book/find tools

Phase 1 persistence files **unchanged**.

---

## 16. Commit SHA

Recorded at push time on `cursor/voice-v3-restore-reconnect-2304` (see `git log -1`).

---

## 17. Production deployment

**No production deployment occurred.** No Python worker rebuild. Architecture freeze respected (delegation, SET→FIND, intake, MS/Google commit, booking persistence design).

---

## Next recommended passes (ordered)

1. REQUEST_ONLY: `submit_appointment_request` tool + executor only (no dialogue engine)
2. Port `0ad68d4e` Node ingestion + Prisma migration + compile hook for `openaiVectorStoreIds`
3. Port `55e48438` crawler (job + lib only)
4. Python `FileSearch` session change (isolated build)
5. Freshness: wire `markCallerTurnSemanticApplied` at semantic-apply boundary
6. Wizard manifest consumer strings + live instruction mapping audit
