# Voice V3 production deployment report

**Deployed immutable SHA:** `4f5e99e4c566190e98f43c39fab781d0417c4311`  
**Date (UTC):** 2026-09-21  
**Git merge:** PR #472 merged to `master` (code reachable at pinned SHA)

---

## 1. Exact deployed SHA

`4f5e99e4c566190e98f43c39fab781d0417c4311`

Verified in production web health:

`GET /api/health` → `"commitSha":"4f5e99e4c566190e98f43c39fab781d0417c4311"`

---

## 2. Migration results

**Order:** migrations applied **before** application deploy.

- `20260921120000_voice_openai_vector_store` — already applied (no pending at deploy time)
- `20260921140000_voice_website_crawl_jobs` — **applied successfully** via `npx prisma migrate deploy` at SHA `4f5e99e4`

`prisma migrate deploy` exit: success.

---

## 3. Web build / deploy

| Item | Result |
|------|--------|
| Coolify app | `sms:master-ds8s3hjin60qs6g7s0iqkixs` (id=1) |
| Deployment queue | `3059` |
| Commit pinned | `4f5e99e4c566190e98f43c39fab781d0417c4311` |
| Status | **finished** `2026-09-21 21:34:43 UTC` |
| Container | `ds8s3hjin60qs6g7s0iqkixs-212403600478` |
| Image | `ds8s3hjin60qs6g7s0iqkixs:4f5e99e4c566190e98f43c39fab781d0417c4311` |
| Health | `{"ok":true,"commitSha":"4f5e99e4..."}` |

Build warnings (non-fatal): `deriveOutcomeBadges` import warning on legacy voice calls page during Next build.

---

## 4. Voice worker build / deploy

| Item | Result |
|------|--------|
| Coolify app | `transovo-voice` (id=2) |
| Deployment queue | `3060` |
| Commit pinned | `4f5e99e4c566190e98f43c39fab781d0417c4311` |
| Status | **finished** `2026-09-21 21:28:46 UTC` |
| Container | `tgjridm6vrmrgljkfrr0rpjn-212403630170` |
| Image | `tgjridm6vrmrgljkfrr0rpjn:4f5e99e4c566190e98f43c39fab781d0417c4311` |

---

## 5. Worker health

- Legacy profile: HTTP **8081**, registered with LiveKit
- V3 profile: HTTP **8083**, `agent_name=transovo-voice-v3`, **healthy**
- Startup: no FileSearch import errors, no plugin incompatibility, backend health probe **200**

---

## 6–11. PSTN certification (human — not run by Cloud Agent)

Cloud Agent **cannot** place real PSTN calls. **Product certification is intentionally pending** until you complete:

| Test | Status |
|------|--------|
| A. Microsoft booking | **PENDING** (human PSTN) |
| B. Google booking | **PENDING** |
| C. REQUEST_ONLY | **PENDING** |
| D. FileSearch knowledge | **PENDING** |
| E. SEND_LINK | **PENDING** |
| F. Transfer | **PENDING** |

Use your checklist (natural conversation, verify durable rows / provider events / no duplicate side effects).

---

## 12. Durable booking persistence

Not re-verified on production PSTN in this pass. Pre-deploy unit/regression tests passed at cert SHA.

---

## 13. Errors / warnings

| Severity | Item |
|----------|------|
| Warning | Next build import warning `deriveOutcomeBadges` (legacy page) |
| Info | Two voice worker containers briefly overlapped during rolling deploy (expected) |
| None | Migration failure, FileSearch import failure, worker unhealthy |

---

## 14. Latency observations

No new PSTN forensics in this deploy pass. Collect during human certification (section 7 of deploy brief).

---

## 15. Architecture

**Confirmed unchanged:** Telnyx → LiveKit → GPT-Live (`gpt-live-1`, `delegation="responses"`) → Sol → Transovo FunctionTools.

---

## 16. V3 RAG path

**Native OpenAI FileSearch** when `openaiVectorStoreIds` present. No Telnyx RAG requirement on V3 live path. No custom `search_business_knowledge` FunctionTool on catalog when vector stores configured.

---

## 17. ACTIVE agent demo config

Production code at deployed SHA: **fail closed** — `VoiceV3AgentConfigResolutionError` when ACTIVE + missing wizard + `NODE_ENV=production` (unless `VOICE_V3_ALLOW_DEMO_CONFIG_FALLBACK=1`).

---

## 18. Remaining issues

| Class | Item |
|-------|------|
| **Deployment blocker** | None identified for infra deploy |
| **Functional** | PSTN matrix **not yet executed** — blocks *product* sign-off, not infra rollback |
| **Optimization** | Freshness, prompt/context size, filler — **deferred** per plan |

---

## Post-deploy actions for you

1. Run PSTN certification calls (Microsoft, Google, REQUEST_ONLY, FileSearch, SEND_LINK, transfer).
2. Confirm old web/voice containers fully drained if still visible in `docker ps`.
3. Freeze baseline after PSTN pass; then start optimization work separately.
