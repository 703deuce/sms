# MCTB Platform Active Conversation Ownership — Final Report

**Date:** 2026-09-24  
**Branch:** `cursor/mctb-platform-active-ownership-2304`  
**Draft PR:** #504 (base `master`)  
**Platform sender:** `+18885046264` (single TFN; no pool in this pass)

---

## What shipped

Deterministic **(consumerE164 + platformPhoneNumberId) → ACTIVE customer workspace** for `senderMode = PLATFORM` only. Tenant isolation is unchanged; assignment decides which certified tenant owns the SMS pair.

**Normal routing:**

```
consumerE164 + platformPhoneNumberId
        ↓
ACTIVE PlatformSenderAssignment
        ↓
workspaceId + conversation/thread
        ↓
existing MCTB inbound ingress
        ↓
existing AI Lead Recovery
        ↓
existing customer Brain / booking / calendar
```

- **Outbound:** claim before PLATFORM send; collision → no send (`PLATFORM_SENDER_PAIR_COLLISION`).
- **Inbound:** active assignment first (`ACTIVE_ASSIGNMENT`); legacy 14-day evidence resolver as fallback; lazy assignment on unique `RESOLVED` when safe.
- **Release:** explicit lifecycle preferred (resolved, handoff, STOP/suppression, etc.); **72h idle** safety net (`MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS`), not 14 days.
- **WORKSPACE sender:** unchanged (gate no-ops unless `senderMode === PLATFORM`).

**Product rule:** Idle expiration is a safety net, not the primary release path. Explicit lifecycle events release immediately; idle timeout cleans abandoned threads.

---

## SCHEMA (actual implementation)

**Prisma model:** `MctbPlatformSenderAssignment`  
**Table:** `mctb_platform_sender_assignments`

| Field | Notes |
|-------|--------|
| `id` | cuid |
| `workspaceId` | **Customer** tenant (not platform owner) |
| `consumerE164` | Normalized via `normalizeMctbCallerE164` |
| `platformPhoneNumberId` | FK → `PhoneNumber` (`platform_mctb_sender`) |
| `conversationId` | Optional FK → `Conversation` |
| `missedCallEventId` | Optional correlation |
| `state` | `ACTIVE` \| `RELEASED` |
| `releaseReason` | `RESOLVED`, `STAFF_CLOSED`, `HANDOFF_COMPLETE`, `OPT_OUT`, `SUPPRESSED`, `IDLE_TIMEOUT`, `ADMIN_RELEASE`, `SUPERSEDED` |
| `createdAt`, `lastUsedAt`, `releasedAt`, `expiresAt` | `expiresAt` = idle safety net |

**Migration:** `prisma/migrations/20260924183000_mctb_platform_sender_assignment/migration.sql`

**Runtime modules:**

| Module | Role |
|--------|------|
| `src/lib/mctb/messaging/platform-sender-assignment.ts` | Claim, reuse, collision, release, touch, idle expiry, inbound resolution |
| `src/lib/mctb/messaging/platform-outbound-gate.ts` | Gate PLATFORM sends before provider |
| `src/lib/mctb/messaging/platform-assignment-lifecycle.ts` | Release on conversation lifecycle |

**Integrations:** `send.ts`, `customer-sms.ts`, `send-customer-sms-job.ts` (outbound); `platform-sender-inbound-core.ts` (inbound); `platform-inbound-boundary.ts` (STOP release); `handoff/automation-state.ts` (resolved/booked).

---

## ACTIVE UNIQUENESS (database guarantee)

Partial unique index:

```sql
mctb_platform_sender_assignments_active_pair_key
ON (consumerE164, platformPhoneNumberId)
WHERE state = 'ACTIVE'
```

**Claim concurrency:** transaction + partial unique index; duplicate `INSERT` → Prisma `P2002` → re-read active row → `REUSED` or `COLLISION`. Two workspaces cannot both become ACTIVE for the same pair.

---

## Automated tests

```bash
npx tsx scripts/test-mctb-platform-sender-assignment.ts
```

Matrix **A–L:** sequential reuse, same-workspace reuse, collision, atomic race, legacy unique/ambiguous, released owner, idle expiry, STOP release, platform-owner separation, tenant propagation, historical rows.

**Tenant isolation regression** (when fixture is on deploy branch):

```bash
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
```

On `master` alone the tenant fixture may live only on the tenant remediation PR — re-run on the combined stack before production.

---

## Certification matrix (final report)

```
SCHEMA:
MctbPlatformSenderAssignment → mctb_platform_sender_assignments (ACTIVE|RELEASED);
partial unique (consumerE164, platformPhoneNumberId) WHERE ACTIVE;
migration 20260924183000_mctb_platform_sender_assignment

ACTIVE UNIQUENESS:
Partial unique index + transactional claim + P2002 handling

OUTBOUND CLAIM:                    PASS
SAME-WORKSPACE REUSE:              PASS
CONCURRENT COLLISION:              PASS
ATOMIC RACE:                       PASS
INBOUND ACTIVE RESOLUTION:         PASS
LEGACY UNIQUE FALLBACK:            PASS
LEGACY AMBIGUOUS:                  PASS
LAZY MIGRATION:                    PASS
EXPLICIT RELEASE:                  PASS
IDLE EXPIRATION:                   PASS
STOP RELEASE:                      PASS
PLATFORM OWNER SEPARATION:         PASS
AI TENANT PROPAGATION:             PASS
WORKSPACE SENDER UNCHANGED:        PASS
TENANT CERTIFICATION REGRESSION:   DEFERRED (run fixture after tenant cert PR on deploy branch)
VOICE V3 MODIFIED:                 NO
CALL HANDLING MODIFIED:            NO
READY FOR PRODUCTION DEPLOYMENT REVIEW: YES
```

*(Do not merge or deploy automatically — review migration + handset checklist first.)*

---

## Production deployment & handset checklist

Do **not** run STOP until other cases pass. Human review required.

1. [ ] Deploy commit verified; `prisma migrate deploy` applied.
2. [ ] Platform sender still `+18885046264`; `platform_mctb_sender` role intact.
3. [ ] `senderMode = PLATFORM` test workspace: outbound recovery → logs `decision":"CLAIMED"`.
4. [ ] Twilio send: `Message.from` / `outboundSmsFromE164` = `+18885046264`.
5. [ ] `mctb_platform_sender_assignments` row **ACTIVE** for test consumer + platform phone id.
6. [ ] Consumer reply → `resolutionSource = ACTIVE_ASSIGNMENT` → correct `workspaceId`.
7. [ ] AI Lead Recovery second turn uses same workspace Brain (LR does not query assignment).
8. [ ] Explicit release (resolve / handoff) → `RELEASED`; pair reclaimable.
9. [ ] HELP — platform-safe, no tenant leak.
10. [ ] **LAST:** STOP → suppression + assignment released; subsequent PLATFORM send blocked.

**Collision observability:** logs `decision":"COLLISION"` and suppression `PLATFORM_SENDER_PAIR_COLLISION`.

---

## Deploy order reminder

1. Tenant isolation certification + Telnyx voice-tool republish per `docs/TRANSOVO-MULTI-TENANT-ISOLATION-CERTIFICATION.md`.
2. Deploy this migration and assignment runtime.
3. Handset checklist above (STOP last).

---

## Related documentation

| Doc | Purpose |
|-----|---------|
| `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md` | Product / operational truth |
| `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md` | Engineering design (as-built section) |
| `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP-IMPLEMENTATION.md` | Modules, schema detail, checklist |
| `docs/TRANSOVO-MULTI-TENANT-ISOLATION-CERTIFICATION.md` | Tenant prerequisite |

---

## Out of scope (this pass)

Platform number pool, second TFN, round robin, AI/body tenant routing, Lead Recovery tenant discovery changes, Voice V3, Call Handling, WORKSPACE sender behavior, Model B credential changes.

---

## Collision metric (why this matters)

Track frequency of `COLLISION` and `PLATFORM_SENDER_PAIR_COLLISION`. If collisions are rare over months, a second shared TFN may never be justified for routing; if they matter, use real counts to decide another verified sender or different collision UX.
