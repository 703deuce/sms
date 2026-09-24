# Transovo Multi-Tenant Isolation — Certification Report

**Status:** **LOCKED** (application architecture — 2026-09-24 UTC)  
**Date:** 2026-09-24 (UTC)  
**Pass type:** Two-workspace negative testing (ALPHA PLUMBING vs BETA ELECTRIC) + P1 remediation  
**Runner:** `npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts`  
**Voice tool auth:** `npx tsx scripts/test-telnyx-voice-tool-webhook-auth.ts`  
**Prerequisite audit:** `docs/TRANSOVO-MULTI-TENANT-ISOLATION-AUDIT.md`  
**PRs:** #502 (permanent A/B fixture suite) · #503 (P1 remediation — voice tool auth + `ws_1`)  
**Out of scope (next feature):** MCTB active (consumer + 888) conversation ownership — see `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md`.

Do not reopen broad tenancy passes unless a new P0/P1 is demonstrated. Further Call Handling **Telnyx provider** isolation is a separate stub test; it does not invalidate this certification.

---

## Final verdict

| Field | Value |
|-------|--------|
| **P0** | **0** |
| **P1 REMAINING** | **0** (focused pass complete) |
| **VOICE TOOL AUTH** | **PASS** |
| **VOICE TOOL CALL/AGENT BINDING** | **PASS** |
| **PRODUCTION CUSTOMER-RUNTIME ws_1 FALLBACK** | **PASS** |
| **ALL PREVIOUS A/B TESTS** | **PASS** |
| **CALL HANDLING LOCAL A/B** | **PASS** |
| **TELNYX PROVIDER MUTATION ISOLATION** | **NOT TESTED** |
| **SAFE FOR SECOND REAL CUSTOMER** | **YES** (application architecture level) |

---

## Fixture

| Workspace | Name | Slug pattern |
|-----------|------|----------------|
| A | ALPHA PLUMBING | `tenant-iso-alpha-<timestamp>` |
| B | BETA ELECTRIC | `tenant-iso-beta-<timestamp>` |

Shared consumer: `+15550100999` (separate `Contact` rows per workspace).

Resources per workspace: `PhoneNumber`, `MissedCallTextConfig`, `Contact`, `Conversation`, `Message`, `MissedCallEvent`, `VoiceAgent`, `VoiceCall` (with `telnyxCallControlId`), `VoiceKnowledgeBase` (A), `VoiceService`.

---

## Certification results (A/B)

| Check | Result |
|-------|--------|
| A→B READ | **PASS** |
| B→A READ | **PASS** |
| A→B WRITE | **PASS** |
| PHONE NUMBER ISOLATION | **PASS** |
| CALL HANDLING LOCAL A/B | **PASS** (per-ingress `settingsJson`; **Telnyx not called**) |
| CONTACT SAME-CONSUMER | **PASS** |
| CONVERSATION/MESSAGE | **PASS** |
| PLATFORM OWNER SEPARATION | **PASS** |
| AI LEAD RECOVERY | **PASS** |
| MCTB ANALYTICS | **PASS** |
| BACKGROUND JOB PROPAGATION | **PASS** (static trace) |
| VOICE TOOL UNAUTHENTICATED | **REJECTED (401)** |
| VOICE TOOL AUTHENTICATED | **ACCEPTED** |
| VOICE TOOL TENANT BINDING | **REJECTED mismatch (403)** |

---

## PART A — Production `ws_1` fallbacks (remediated)

| FILE | CLASSIFICATION | CURRENT TENANT SOURCE | ws_1 FALLBACK REACHABLE? | CHANGE REQUIRED? | CHANGE MADE | TEST |
|------|----------------|----------------------|--------------------------|------------------|-------------|------|
| `src/lib/voice/outbound/ensure-realtime-clone-agent.ts` | OPERATOR ONLY (`OUTBOUND_REALTIME_TEST=1`, setup scripts) | `requireExplicitWorkspaceId` | No (was reachable if env unset) | Yes | Removed `\|\| "ws_1"` | Isolation fixture PASS |
| `src/lib/voice/outbound/auto-smoke.ts` | OPERATOR ONLY (`OUTBOUND_AUTO_SMOKE_CALL=1`) | `WORKSPACE_ID` env | No | Yes | Skip smoke if `WORKSPACE_ID` missing | Isolation fixture PASS |
| `src/lib/voice/frontdesk/ensure-realtime-agent.ts` | OPERATOR ONLY (frontdesk realtime boot) | `requireExplicitWorkspaceId` | No | Yes | Removed `\|\| "ws_1"` | Isolation fixture PASS |
| `src/lib/voice/real-estate/deploy-agent.ts` | REALTOR deploy (onboarding API passes `workspaceId`) | `requireExplicitWorkspaceId` | No | Yes | Removed `\|\| "ws_1"` | Isolation fixture PASS |
| `src/lib/voice/real-estate/deploy-knowledge.ts` | REALTOR deploy | `requireExplicitWorkspaceId` | No | Yes | Removed `\|\| "ws_1"` | Isolation fixture PASS |
| `src/lib/voice/real-estate/bootstrap.ts` | OPERATOR boot (`WORKSPACE_ID`) | env / explicit input | No | Yes | Fail closed without `WORKSPACE_ID` | Isolation fixture PASS |
| `src/lib/realtor/verification/verify-integration.ts` | TEST / integration script | `WORKSPACE_ID` env | No | Yes | Throw if env missing | Isolation fixture PASS |
| `src/app/api/voice/telnyx-official-baseline/route.ts` | DEV/BASELINE + smoke bootstrap | Session `auth.workspaceId` OR bootstrap body | Bootstrap only | Yes | Bootstrap requires `body.workspaceId` (no default) | Static + session path unchanged |

**Intentional platform `ws_1` (unchanged):** `platform-owner-workspace.ts`, `frozen-pipeline.ts`.

---

## PART B–D — Voice tool trust boundary (remediated)

**Target:** `POST /api/telnyx/voice/tools`

### Trace (unchanged architecture)

| Layer | Mechanism |
|-------|-----------|
| LiveKit Voice V3 | `TransovoV3ToolClient` → `POST /api/internal/voice-runtime` with **Bearer** (`TRANSOVO_INTERNAL_API_KEY`) |
| Telnyx AI Assistant tools | Telnyx HTTP → `/api/telnyx/voice/tools` with `X-Transovo-*` headers |

### Smallest fix (implemented)

1. **`verifyTelnyxVoiceToolWebhookAuth`** — same secret as voice-runtime bridge (`TRANSOVO_INTERNAL_API_KEY` / `VOICE_RUNTIME_INTERNAL_SECRET`). Accepts `Authorization: Bearer …` or `x-transovo-internal-api-key`. **Production without secret:** dev-only allow; **with secret:** unauthenticated → **401**.
2. **`assertToolWebhookCallTenantBinding`** — when `call_control_id` / `conversation_id` match an existing `VoiceCall`, **workspaceId** and **agentId** must match claims → else **403**.
3. **`ensureTransovoSharedWorkflowTools`** — publishes `Authorization: Bearer <secret>` on Telnyx shared webhook tools when secret is configured (re-publish tools after deploy).

**Exploitability verdict (post-fix):** **NOT EXPLOITABLE** for cross-tenant or unauthenticated same-tenant invocation when internal secret is set (proven by fixture tests).

**Deploy note:** Existing Telnyx assistants must **re-sync shared tools** (or republish agent) so webhook `Authorization` is present before enforcing auth in production.

---

## PART F — Call Handling scope

| Item | Result |
|------|--------|
| CALL HANDLING A/B LOCAL STATE | **PASS** |
| TELNYX PROVIDER MUTATION ISOLATION | **NOT YET PROVIDER-CERTIFIED** |

---

## Tenant foundation for MCTB platform routing (locked invariant)

Once deterministic routing resolves **customer `workspaceId`**, the product keeps downstream work inside that tenant:

```
consumer
  → platform sender (888)
  → ACTIVE ASSIGNMENT (next implementation)
  → customer workspaceId
  → customer Conversation
  → customer AI Lead Recovery
  → customer Brain / booking / calendar
```

This certification independently proves A/B isolation for reads, writes, messaging, Lead Recovery context, analytics, and platform-owner separation **after** `workspaceId` is known. Active ownership is the next engineering layer on top of this foundation.

---

## Mandatory production sequence (Voice tool auth — do not skip)

Existing Telnyx assistants may **not** send `Authorization` until shared tools are re-synced. **Do not** treat merge/deploy alone as production-certified.

1. **Merge** remediation (#503) and fixture suite (#502) per your release process.  
2. **Coolify** deploy completes successfully; verify running commit SHA matches merged head.  
3. **Re-sync / republish** Telnyx shared workflow tools (`ensureTransovoSharedWorkflowTools` or equivalent publish path) so webhooks include `Authorization: Bearer <TRANSOVO_INTERNAL_API_KEY>`.  
4. **Verify auth boundary:** unauthenticated `POST /api/telnyx/voice/tools` → **401**; legitimate request with Bearer + valid agent/workspace → succeeds (harmless tool, e.g. `get_runtime_context` with test call context).  
5. **One harmless real Voice tool path** on production (single live call or controlled tool invocation) — confirm behavior unchanged vs pre-deploy.  
6. **Mark remediation production-certified** only after steps 1–5.

```bash
# CI / pre-deploy (DATABASE_URL required)
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
npx tsx scripts/test-telnyx-voice-tool-webhook-auth.ts
```

---

## Follow-ups (not blocking second customer at app layer)

1. Mocked `setActiveCallHandler` Telnyx stub A/B test (provider mutation — **NOT TESTED** today).  
2. HTTP-level authenticated IDOR suite against running app.  
3. Voice analytics A/B aggregate test (mirror MCTB).

---

## Stop condition

**P0:** none observed in this pass. **Next engineering feature:** active (consumer + 888) conversation ownership after #502/#503 deploy + Voice auth steps above.
