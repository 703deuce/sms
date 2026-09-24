# MCTB Platform — Combined Stack Certification Report

**Generated:** 2026-09-24 (UTC)  
**Purpose:** Prove tenant remediation + Voice tool auth + Active Conversation Ownership (#504) on one deploy candidate.  
**Do not deploy from this document alone — handset certification remains PENDING.**

---

## 1. Deploy candidate SHAs

| Label | SHA |
|-------|-----|
| **TENANT CERTIFICATION COMMIT** | `1dcbf3ce84bb9cefeae44efc6355afdbea0a80df` (`cursor/transovo-tenant-iso-remediation-2304`) |
| **ACTIVE OWNERSHIP COMMIT** | `8e64d453159bf6a852dc10628fa5231c08ca7567` (`cursor/mctb-platform-active-ownership-2304`, PR #504) |
| **COMBINED DEPLOY CANDIDATE (pre-cert script commit)** | `06bcfd6166cdfd403860924888dccdaaed77cd98` |
| **COMBINED DEPLOY SHA (after cert scripts)** | `c0bc7ae9aa07ac1bd3e450155dddc96496448e25` |

**Branch:** `cursor/mctb-combined-stack-cert-2304` = merge of tenant remediation + #504 (no unrelated cleanup).

**PRs (merge order for production):**

1. Tenant isolation remediation / certification (e.g. #503)
2. Active ownership (#504)

Or merge both to `master` and certify final `master` SHA before Coolify deploy.

---

## 2. Migration review — `20260924183000_mctb_platform_sender_assignment`

| Check | Result |
|-------|--------|
| Existing production rows destructively modified | **PASS** — `CREATE TABLE` only; no `UPDATE`/`DELETE` on existing tables |
| Requires assignment backfill | **PASS** — not required; empty table at deploy |
| Existing PLATFORM conversations usable via legacy fallback | **PASS** — inbound uses assignment first, then unchanged 14-day evidence resolver |
| WORKSPACE sender data unaffected | **PASS** — new table only; gate no-ops for `senderMode !== PLATFORM` |
| `platformPhoneNumberId` FK delete behavior | **PASS** — `ON DELETE RESTRICT` on `PhoneNumber` prevents accidental shared-sender deletion; assignments cascade with customer `Workspace` |
| `conversationId` FK delete behavior | **PASS** — `ON DELETE SET NULL` preserves assignment history |
| Partial ACTIVE unique index created | **PASS** — `mctb_platform_sender_assignments_active_pair_key` `WHERE state = 'ACTIVE'` |
| Safe against current production schema | **PASS** — additive enum + table + indexes + FKs only |

**MIGRATION REVIEW: PASS**

---

## 3. Test commands (combined candidate)

```bash
npx tsx scripts/test-mctb-platform-sender-assignment.ts
npx tsx scripts/test-mctb-platform-sender-combined-cert.ts
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
npx tsx scripts/test-telnyx-voice-tool-webhook-auth.ts
```

### Active ownership A–L

**Result on combined candidate:** **PASS** (`ALL PLATFORM SENDER ASSIGNMENT TESTS PASS`)

Includes: outbound claim, same-workspace reuse, concurrent collision, atomic race, inbound active resolution, legacy unique/ambiguous, lazy migration, explicit release, idle expiration, STOP release, platform owner separation, AI tenant propagation, historical rows.

### Combined cert helpers

**Result:** **PASS** (`ALL COMBINED CERT HELPERS PASS`)

- **M** — 48× concurrent release + inbound resolve + B claim (no wrong-tenant violations)
- **Pre-send collision** — gate blocks B; `send.ts` / `send-customer-sms-job.ts` return before `sendQuickSms`
- **Legacy deploy** — unique → RESOLVED; ambiguous → AMBIGUOUS, no assignment row; unmatched → UNMATCHED
- **72h policy** — single constant; read does not extend `lastUsedAt`; touch extends; explicit release wins over idle expiry
- **WORKSPACE sender** — gate `NOT_PLATFORM`

### Tenant certification

**Result:** **PASS** — `SAFE FOR SECOND REAL CUSTOMER: YES`, P0 = 0

Verified on same commit: A↔B read/write, phone isolation, call handling local A/B, same consumer, conversation/message, platform owner separation, AI lead recovery, analytics, new workspace clean start, voice tool trust boundary.

### Voice tool auth regression

**Result:** **PASS** — `PASS telnyx voice tool webhook auth + binding`

Unauthenticated → 401; authenticated → accepted; tenant/agent/call mismatch → 403.

---

## 4. Final combined certification block

```
COMBINED DEPLOY SHA:
c0bc7ae9aa07ac1bd3e450155dddc96496448e25

MIGRATION REVIEW:
PASS

ACTIVE OWNERSHIP A–L:
PASS

TENANT CERTIFICATION:
PASS

VOICE TOOL AUTH REGRESSION:
PASS

RELEASE/RECLAIM/INBOUND RACE:
PASS

COLLISION PRE-SEND:
PASS

LEGACY DEPLOY COMPATIBILITY:
PASS

72H LIFECYCLE:
PASS

WORKSPACE SENDER REGRESSION:
PASS

VOICE V3 MODIFIED:
NO

CALL HANDLING MODIFIED:
NO

READY TO MERGE:
YES (tenant PR + #504 — human approval; not auto-merge)

READY TO DEPLOY:
NO (handset + Coolify + migrate + Telnyx tool republish still required)

PRODUCTION HANDSET CERTIFICATION:
PENDING
```

**TENANT CERTIFICATION REGRESSION on combined stack:** **PASS** (no longer DEFERRED when tested on this branch).

---

## 5. Production deploy plan (do not execute yet)

1. Merge approved **tenant remediation** PR to `master`.
2. Merge approved **active ownership** PR #504 to `master`.
3. Record final **`master` SHA** as production deploy candidate.
4. Wait for **Coolify** build.
5. Verify successful build/deploy.
6. Verify **`prisma migrate deploy`** applied `20260924183000_mctb_platform_sender_assignment`.
7. Verify application health reports expected SHA.
8. **Re-sync/republish Telnyx shared Voice tools** with `Authorization` header (per tenant certification doc).
9. Certify Voice authenticated tool path (smoke + `test-telnyx-voice-tool-webhook-auth.ts` against staging if needed).
10. Begin **MCTB handset certification** (order below).

Do **not** alter real Telnyx Call Handling routing during this certification unless explicitly approved.

---

## 6. Handset certification checklist (STOP last)

| Step | Action | Expected evidence |
|------|--------|-------------------|
| A | Real missed call via AT&T CFNA → MCTB ingress | `VoiceCall` / `MissedCallEvent` row |
| B | Press 1 | Consent event / DTMF path per mode |
| C | Recovery SMS from **+18885046264** | Handset shows 888 |
| D | Outbound persistence | `Message.from` = +18885046264; `MissedCallEvent.metadata.outboundSmsFromE164` = +18885046264; `senderMode` = PLATFORM |
| E | Assignment row | `mctb_platform_sender_assignments.state` = ACTIVE; `workspaceId` = test customer; `consumerE164` = handset; `platformPhoneNumberId` = canonical 888 row |
| F | Normal reply | Inbound accepted |
| G | Resolution | Log `resolutionSource` = ACTIVE_ASSIGNMENT; same `workspaceId`; same conversation/thread where applicable |
| H | Second conversational turn | LR reply in thread |
| I | Brain | `loadMctbApprovedBusinessInformation` for **customer** workspace only |
| J | Explicit release | Staff resolve / handoff / product release path |
| K | Assignment released | `state` = RELEASED; `releaseReason` set |
| L | Reclaim | New thread can CLAIM pair after release |
| M | HELP | Platform-safe response; no tenant leak |
| N | **STOP (LAST)** | Platform suppression; assignment RELEASED/OPT_OUT; subsequent PLATFORM send blocked |

---

## 7. Release vs in-flight inbound (race)

Combined cert runs **48 concurrent interleavings** of:

- A `RELEASED`
- inbound `resolvePlatformMctbInboundReplyWithAssignment`
- B `claim`

**Invariant enforced in test:** inbound must not land on **B** when B’s claim was **COLLISION** or when only **A** has unique legacy evidence while B incorrectly won ACTIVE.

No architecture change was required for this pass; test documents current transaction ordering.

---

## 8. Collision metric (post-deploy)

Monitor:

- `decision":"COLLISION"` in `mctb-platform-sender-assignment` logs
- `PLATFORM_SENDER_PAIR_COLLISION` on `MissedCallEvent.suppressionReason`

These counts inform whether a second shared TFN is ever justified.
