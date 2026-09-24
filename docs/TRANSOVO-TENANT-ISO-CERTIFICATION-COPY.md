# Transovo Tenant Isolation Certification — Copy-Paste Summary

**Date:** 2026-09-24 (UTC)  
**Pass type:** Two-workspace negative testing (ALPHA PLUMBING vs BETA ELECTRIC)  
**No production deploy.** No Voice V3 changes. No active-888 ownership. No generic auth refactor.

---

## Run the suite

```bash
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
```

**Fixture module:** `scripts/lib/transovo-tenant-iso-fixture.ts`  
**Full report:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-CERTIFICATION.md`  
**Parent audit:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-AUDIT.md`  
**Draft PR:** https://github.com/703deuce/sms/pull/502

---

## Certification results

| Check | Result |
|-------|--------|
| **A→B READ TESTS** | **PASS** |
| **B→A READ TESTS** | **PASS** |
| **A→B WRITE TESTS** | **PASS** |
| **PHONE NUMBER ISOLATION** | **PASS** |
| **CALL HANDLING A/B** | **PASS** (per-ingress `settingsJson`; Telnyx **not** called) |
| **CONTACT SAME-CONSUMER** | **PASS** (`+15550100999` → separate A/B contacts & threads) |
| **CONVERSATION/MESSAGE** | **PASS** |
| **PLATFORM OWNER SEPARATION** | **PASS** |
| **AI LEAD RECOVERY** | **PASS** (ALPHA PLUMBING / Drain Cleaning vs BETA ELECTRIC / Panel Replacement) |
| **ANALYTICS** | **PASS** (MCTB: 3 vs 7 missed events → different totals) |
| **BACKGROUND JOB PROPAGATION** | **PASS** (static trace: MCTB inbound job embeds `workspaceId`) |
| **VOICE TOOL TRUST BOUNDARY** | **DEFENSE-IN-DEPTH** (trace only — no Voice V3 changes) |
| **PRODUCTION ws_1 FALLBACK** | **WARN** (8 `src/` paths — see below) |
| **NEW WORKSPACE CLEAN START** | **PASS** |
| **P0 CONFIRMED** | **0** |
| **P1 REMAINING** | **2** |
| **SAFE FOR SECOND REAL CUSTOMER** | **NO** |

---

## Fixture (not ws_1)

| Workspace | Name | Slug pattern |
|-----------|------|----------------|
| A | ALPHA PLUMBING | `tenant-iso-alpha-<timestamp>` |
| B | BETA ELECTRIC | `tenant-iso-beta-<timestamp>` |

Shared test consumer: `+15550100999` (two separate `Contact` rows).

Per workspace where supported: PhoneNumber, MissedCallTextConfig, Contact, Conversation, ConversationMessage, Message, MissedCallEvent, VoiceAgent, VoiceCall (A), VoiceKnowledgeBase (A), VoiceService.

---

## What was proven

- **Read isolation:** A cannot load B resources (and vice versa) using session-shaped `workspaceId` + id queries → null / denied pattern.
- **Write isolation:** `updateMany` with wrong `workspaceId` → count 0; B settings unchanged when A is mutated.
- **Call Handling:** Changing A ingress call-handling settings does **not** change B; independent B switch afterward.
- **Same consumer:** Same E.164 in A and B = different contacts and different conversation history.
- **Platform:** Resolver + `Message.workspaceId` stay on customer workspace, not platform owner.
- **Lead Recovery brain:** `loadMctbApprovedBusinessInformation` is workspace-scoped (ALPHA vs BETA).
- **Analytics:** `loadMctbAnalytics` returns different missed-call totals for A vs B.

---

## Voice tool trust (P1-002) — trace only

**Endpoint:** `POST /api/telnyx/voice/tools`

| Question | Answer |
|----------|--------|
| Public? | Yes (`/api/telnyx/*` bypasses session in middleware) |
| Telnyx signature on tools route? | Not observed in route (unlike some TeXML callbacks) |
| Forge `x-transovo-workspace-id`? | Yes — any HTTP client can set headers |
| Cross-tenant A agent + B workspace? | Blocked — `voiceAgent.findFirst({ id, workspaceId })` |
| Verdict | **DEFENSE-IN-DEPTH** (not confirmed cross-tenant P0; same-tenant unauthenticated invoke remains a concern) |

**Do not change Voice V3** until fix design binds tenant to trusted `VoiceCall`/signature vs header alone.

---

## Production ws_1 fallback — WARN (not fixed this pass)

**INTENTIONAL PLATFORM (OK):**

- `src/lib/mctb/platform-owner-workspace.ts`
- `src/lib/mctb/texml-ingress/frozen-pipeline.ts` (reference id)

**PRODUCTION CUSTOMER RUNTIME RISK (fail closed when tenant missing):**

- `src/lib/voice/outbound/ensure-realtime-clone-agent.ts`
- `src/lib/voice/outbound/auto-smoke.ts`
- `src/lib/voice/frontdesk/ensure-realtime-agent.ts`
- `src/lib/voice/real-estate/deploy-agent.ts`
- `src/lib/voice/real-estate/deploy-knowledge.ts`
- `src/lib/voice/real-estate/bootstrap.ts`
- `src/lib/realtor/verification/verify-integration.ts`

**WARN / dev-baseline:**

- `src/app/api/voice/telnyx-official-baseline/route.ts` (`body.workspaceId || "ws_1"`)

Scripts may default to `ws_1`; **customer runtime must not** silently become ws_1.

---

## P1 remaining (before second real customer)

1. Voice tool webhook — bind tenant to trusted call/session/signature, not header alone.
2. Remove `ws_1` silent fallbacks in customer-facing `src/lib/voice/**` paths.
3. (Follow-up) Mocked `setActiveCallHandler` A/B test with Telnyx stub.
4. (Follow-up) HTTP-level authenticated IDOR suite optional.
5. (Follow-up) Voice analytics A/B count test (MCTB analytics already PASS).

---

## Governing invariant

> Workspace A must never read, write, route, execute, display, book, message, call, configure, or mutate resources belonging to Workspace B.

Shared infrastructure must **never** become customer tenant identity.

---

## Recommended order (unchanged)

1. Fix P1 trust + ws_1 fail-closed (focused — **no** generic `assertResourceInWorkspace` refactor).
2. Re-run certification → target **SAFE FOR SECOND REAL CUSTOMER: YES** only when WARNs cleared + voice trust improved.
3. Then implement **active (consumer + 888) ownership** for MCTB.
4. Then final MCTB tightening / handset cert on corrected `Message.from`.

---

## P0 stop condition

If any test shows A → B exposure: stop, report P0 with endpoint, resource, reproduction, smallest fix. **This run: P0 = 0.**
