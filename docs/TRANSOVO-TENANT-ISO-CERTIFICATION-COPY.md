# Transovo Tenant Isolation Certification — Copy-Paste Summary

**Status:** LOCKED · **2026-09-24 (UTC)**  
**SAFE FOR SECOND REAL CUSTOMER:** **YES** (application architecture)  
**P0:** 0 · **P1:** 0  

**PRs:** #502 (A/B fixture suite) · #503 (voice tool auth + `ws_1` remediation)  
**Full report:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-CERTIFICATION.md`  
**Parent audit:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-AUDIT.md`  
**Next feature:** `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md` (after prod deploy checklist below)

---

## Run the suite

```bash
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
npx tsx scripts/test-telnyx-voice-tool-webhook-auth.ts
```

---

## Certification results

| Check | Result |
|-------|--------|
| A→B READ | **PASS** |
| B→A READ | **PASS** |
| A→B WRITE | **PASS** |
| PHONE NUMBER ISOLATION | **PASS** |
| CALL HANDLING LOCAL A/B | **PASS** (DB state; Telnyx **not** called) |
| CONTACT SAME-CONSUMER | **PASS** |
| CONVERSATION/MESSAGE | **PASS** |
| PLATFORM OWNER SEPARATION | **PASS** |
| AI LEAD RECOVERY | **PASS** |
| MCTB ANALYTICS | **PASS** |
| VOICE TOOL AUTH | **PASS** (401 unauthenticated) |
| VOICE TOOL TENANT BINDING | **PASS** (403 mismatch) |
| PRODUCTION ws_1 FALLBACK | **PASS** |
| TELNYX PROVIDER MUTATION (Call Handling) | **NOT TESTED** (does not invalidate app cert) |
| **SAFE FOR SECOND REAL CUSTOMER** | **YES** |

---

## Voice architecture (unchanged)

- LiveKit → GPT-Live/Sol → `TransovoV3ToolClient` → `/api/internal/voice-runtime` (Bearer) — **unchanged**
- Hardened separately: `POST /api/telnyx/voice/tools` (internal secret + call/agent binding)

---

## Mandatory production sequence (after merge)

1. Merge #502 + #503  
2. Coolify deploy OK; verify commit SHA  
3. Re-publish Telnyx shared workflow tools (add `Authorization` header)  
4. Verify 401 without auth; authenticated harmless tool succeeds  
5. One harmless real Voice tool path / call in production  
6. Then: remediation **production-certified** → start **Active Conversation Ownership**

---

## Locked routing foundation (next build)

```
consumer → 888 → ACTIVE ASSIGNMENT → workspaceId → Conversation → Lead Recovery → Brain/booking
```

Tenant isolation for everything **after** `workspaceId` is proven by the A/B suite above.
