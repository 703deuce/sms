# Transovo Multi-Tenant Isolation — Certification Report

**Date:** 2026-09-24 (UTC)  
**Pass type:** Two-workspace negative testing (ALPHA PLUMBING vs BETA ELECTRIC)  
**Runner:** `npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts`  
**Prerequisite audit:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-AUDIT.md`  
**No production deploy** in this pass. **No Voice V3 code changes.** **No active-888 ownership implementation.**

---

## Fixture

| Workspace | Name | Slug pattern |
|-----------|------|----------------|
| A | ALPHA PLUMBING | `tenant-iso-alpha-<timestamp>` |
| B | BETA ELECTRIC | `tenant-iso-beta-<timestamp>` |

**Not ws_1** on either side. Shared consumer: `+15550100999` (separate `Contact` rows per workspace).

Resources created per workspace where supported: `PhoneNumber`, `MissedCallTextConfig`, `Contact`, `Conversation`, `ConversationMessage`, `Message`, `MissedCallEvent`, `VoiceAgent`, `VoiceCall` (A only), `VoiceKnowledgeBase` (A only), `VoiceService` (Drain Cleaning / Panel Replacement).

Fixture module: `scripts/lib/transovo-tenant-iso-fixture.ts` (creates + deletes in transaction cleanup).

---

## Certification results

| Check | Result |
|-------|--------|
| **A→B READ TESTS** | **PASS** |
| **B→A READ TESTS** | **PASS** |
| **A→B WRITE TESTS** | **PASS** |
| **PHONE NUMBER ISOLATION** | **PASS** |
| **CALL HANDLING A/B** | **PASS** (settings scoped per ingress row; Telnyx **not** called) |
| **CONTACT SAME-CONSUMER** | **PASS** |
| **CONVERSATION/MESSAGE** | **PASS** |
| **PLATFORM OWNER SEPARATION** | **PASS** (resolver + `Message.workspaceId`) |
| **AI LEAD RECOVERY** | **PASS** (`loadMctbApprovedBusinessInformation` — ALPHA vs BETA) |
| **ANALYTICS** | **PASS** (MCTB `loadMctbAnalytics` — distinct counts A vs B) |
| **BACKGROUND JOB PROPAGATION** | **PASS** (static trace: MCTB inbound job carries `workspaceId`) |
| **VOICE TOOL TRUST BOUNDARY** | **DEFENSE-IN-DEPTH** (trace only — see below) |
| **PRODUCTION ws_1 FALLBACK** | **WARN** |
| **NEW WORKSPACE CLEAN START** | **PASS** (static + fixture create) |
| **P0 CONFIRMED** | **0** |
| **P1 REMAINING** | **2** |
| **SAFE FOR SECOND REAL CUSTOMER** | **NO** |

---

## What was exercised

### Read isolation (A→B / B→A)

Session-shaped queries: `findFirst({ id: <B resource>, workspaceId: <A> })` → **null** for phone, conversation, missed call, contact, voice agent, voice call, knowledge.

### Write isolation

`updateMany` with `{ id: B, workspaceId: A }` → **count 0**. B `PhoneNumber.settingsJson` unchanged after A mutation attempts.

### Call Handling A/B

Simulated handler state on **A ingress only** (`mergeCallHandlingIntoSettings` on A row). B snapshot unchanged; then B switched independently. **Does not** invoke `setActiveCallHandler` or live Telnyx (follow-up: mocked integration test).

### Analytics

Seeded **3** vs **7** `MissedCallEvent` rows in 7d window; `loadMctbAnalytics` returned **different** `totalMissed` per workspace.

### Voice analytics

Not exhaustively traced in this pass — MCTB analytics proven; Voice aggregates remain **WARN** in parent audit until same A/B count test is added.

---

## Voice tool trust boundary (P1-002) — trace only, no code changes

**Endpoint:** `POST /api/telnyx/voice/tools` (`src/app/api/telnyx/voice/tools/route.ts`)

| Question | Finding |
|----------|---------|
| Externally reachable? | **Yes** — `src/middleware.ts` treats `/api/telnyx/*` as public (no browser session). |
| Authenticates caller? | **No Telnyx signature check** in tools route (unlike some TeXML status paths). |
| Forge `x-transovo-workspace-id`? | **Yes** — any HTTP client can set headers. |
| Cross-tenant A→B via headers? | **Blocked** when `agentId` ∉ `workspaceId` (`voiceAgent.findFirst({ id, workspaceId })`). |
| `agentId` bound to `VoiceCall`? | **Partial** — `findVoiceCallByTelnyxIds` scopes by `workspaceId`; call created under header workspace. |
| Workspace from `VoiceCall` row vs header? | **Header is primary** for tool execution context; call lookup uses same header workspace. |
| Replay protection? | **Limited** — provider message ids / ingress fingerprinting; not full HMAC on tools route. |
| LiveKit / GPT-Live impact if changed? | **High** — headers are how Telnyx assistant webhooks identify tenant today. |

**Verdict:** **DEFENSE-IN-DEPTH** — cross-tenant agent mismatch is blocked; **same-tenant** unauthenticated tool invocation remains a concern (not proven cross-tenant P0 in this pass). **Do not change Voice V3** until a focused fix design compares Telnyx assistant URL secrets vs header binding to `VoiceCall`.

---

## Production `ws_1` fallback (Priority 10)

| File | Classification |
|------|----------------|
| `src/lib/mctb/platform-owner-workspace.ts` | **INTENTIONAL PLATFORM** |
| `src/lib/mctb/texml-ingress/frozen-pipeline.ts` | **INTENTIONAL PLATFORM** (reference id) |
| `src/lib/voice/outbound/ensure-realtime-clone-agent.ts` | **PRODUCTION CUSTOMER RUNTIME RISK** — `\|\| "ws_1"` |
| `src/lib/voice/outbound/auto-smoke.ts` | **PRODUCTION CUSTOMER RUNTIME RISK** |
| `src/lib/voice/frontdesk/ensure-realtime-agent.ts` | **PRODUCTION CUSTOMER RUNTIME RISK** |
| `src/lib/voice/real-estate/*` | **PRODUCTION CUSTOMER RUNTIME RISK** (deploy/bootstrap paths) |
| `src/lib/realtor/verification/verify-integration.ts` | **PRODUCTION CUSTOMER RUNTIME RISK** |
| `src/app/api/voice/telnyx-official-baseline/route.ts` | **WARN** — defaults `body.workspaceId \|\| "ws_1"`; baseline/dev surface |

**Not fixed in this pass** (per instructions). Smallest fix direction: **fail closed** when `workspaceId` missing in customer runtime paths; keep `ws_1` only in scripts/platform owner env.

---

## P1 remaining (after certification)

1. **Voice tool webhook authentication** — bind tenant to `VoiceCall`/signed ingress, not header alone.  
2. **Production `ws_1` fallbacks** — remove silent default tenant in `src/lib/voice/**` customer paths.  
3. **Call Handling** — add mocked `setActiveCallHandler` A/B test (Telnyx stub).  
4. **HTTP-level IDOR suite** — optional: authenticated fetch against running app (not only Prisma-shaped reads).  
5. **Voice analytics** — A/B aggregate count test (mirror MCTB).

---

## Stop condition

**P0 CONFIRMED: 0** — no demonstrated A→B data exposure in this run.

---

## Next order (product)

1. Fix **P1** trust + fallbacks (focused, no generic auth refactor).  
2. Re-run this certification → target **SAFE FOR SECOND REAL CUSTOMER: YES** only when ws_1 WARN cleared + voice tool verdict improved + HTTP IDOR optional.  
3. Then **active (consumer + 888) ownership** implementation.
