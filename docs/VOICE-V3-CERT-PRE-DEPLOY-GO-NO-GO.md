# Voice V3 certification — pre-deploy GO / NO-GO

**Branch:** `cursor/voice-v3-cert-predeploy-2304`  
**Deployment candidate base:** `26c2f897`  
**Certification tip:** see `git log -1` on branch  
**Status:** STOP BEFORE PRODUCTION DEPLOYMENT

---

## 1. ACTIVE production agent + demo/env fallback

**Before this pass:** `resolveVoiceV3AgentConfigForAgent` returned `VOICE_V3_BOOKING_AGENT_CONFIG` whenever wizard resolution failed — including `ACTIVE` agents — after logging only.

**After this pass (executable):**

```
resolveVoiceV3AgentConfigForAgent
  → resolveWizardSnapshotForVoiceV3
  → if !wizard:
       assertActiveAgentMayUseDemoConfigFallback({ agentStatus })
         → if ACTIVE && !voiceV3AllowsDemoConfigFallback():
              throw VoiceV3AgentConfigResolutionError  (fail closed)
         → else return VOICE_V3_BOOKING_AGENT_CONFIG (dev/test or non-ACTIVE)
  → catch (non-resolution errors):
       same assert before env fallback
```

`voiceV3AllowsDemoConfigFallback()` is **false** when `NODE_ENV=production` unless `VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK=1`.

**Proof test:** `scripts/test-voice-v3-active-agent-demo-fallback.ts` — PASS.

**Answer:** An **ACTIVE** agent on a **production** node (`NODE_ENV=production`, no explicit allow flag) **cannot** receive the demo configuration; resolution throws `VoiceV3AgentConfigResolutionError`. Dev/test may still opt in via non-production `NODE_ENV` or `VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK=1`.

---

## 2. Code change for production fallback safety

- `src/lib/voice-v3/config/demo-config-fallback.ts` (new)
- `src/lib/voice-v3/config/from-published-agent.ts` — `assertActiveAgentMayUseDemoConfigFallback` before any demo return; rethrow resolution errors

---

## 3. Real OpenAI ingestion smoke

**Script:** `scripts/cert-voice-v3-openai-ingestion-smoke.ts`  
**Result:** **PASS** (isolated cert workspace, single text snippet — no website crawl)

| Check | Result |
|-------|--------|
| Upload succeeded | yes |
| Vector store created | yes |
| Indexing completed | yes |
| Elapsed | ~8.8s (representative run) |
| DB `openaiFileId` / `openaiVectorStoreId` | persisted |
| Resolver / compile IDs | match (redacted in log) |

**Fix applied during cert:** OpenAI SDK `vectorStores.files.delete` / `retrieve` argument order corrected in `gpt-live-file-search-rag.ts` (file id first, `{ vector_store_id }`).

---

## 4–5. Indexing + persistence/resolver/compile

Covered by smoke JSON `CERT_VOICE_V3_OPENAI_INGESTION_SMOKE` — `idsMatch: true`, `indexingCompleted: true`.

---

## 6. FileSearch session configuration test

**Script:** `scripts/test-voice-v3-filesearch-session-cert.ts` — **PASS**

- A: no vector IDs → empty session list  
- B: configured IDs → session resolver returns them  
- C: Transovo tools (e.g. `find_availability`) remain  
- D: no `search_business_knowledge` FunctionTool  
- E: `session.py` still `model="gpt-live-1"`, `delegation="responses"`

---

## 7–8. FunctionTools + GPT-Live / Responses

Unchanged architecture; cert tests assert tool catalog and static `session.py` constants.

---

## 9. Migration safety

| Migration | Assessment |
|-----------|------------|
| `20260921120000_voice_openai_vector_store` | Additive nullable columns on existing KB/source tables |
| `20260921140000_voice_website_crawl_jobs` | New tables only; `IF NOT EXISTS` / duplicate FK guards |

No destructive drops. Legacy rows without OpenAI IDs remain valid. Telnyx fields untouched. Apply in order: OpenAI columns first, then crawl tables.

---

## 10. Regression tests

All **PASS**: request-only, knowledge retrieval, website crawl, qualification/urgency, service policy, booking, SEND_LINK 14/14, transfer, active-agent fallback, filesearch session cert.

**Booking persistence (`test-voice-v3-booking-persistence.ts`):** run when safe `DATABASE_URL` available — see CI/local log for this branch tip.

**OpenAI smoke:** PASS when `OPENAI_API_KEY` + `DATABASE_URL` set.

---

## 11. Deployment blockers

| Blocker | Status |
|---------|--------|
| Production ACTIVE → demo fallback | **Resolved** (fail closed) |
| Real OpenAI upload/index path | **Resolved** (SDK fix + smoke PASS) |
| Prisma migrate deploy in target env | **Required before crawl/OpenAI columns work** |
| Single voice-worker rebuild (Python FileSearch) | **Pending your deploy approval** |
| PSTN caller certification | **Out of scope** (post-deploy per your plan) |

**No architectural blockers** identified for deploy after migrations + worker rebuild.

---

## 12. Files changed (certification pass)

See `git diff 26c2f897..HEAD` — demo fallback, OpenAI SDK fix, cert scripts, GO/NO-GO doc, minor livekit export for tests.

---

## 13–14. Commit SHA / NO production deployment

Tip commit on `cursor/voice-v3-cert-predeploy-2304` after push. **No production deployment or Coolify build.**
