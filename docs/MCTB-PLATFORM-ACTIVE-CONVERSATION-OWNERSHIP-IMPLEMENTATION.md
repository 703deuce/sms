# MCTB Platform Active Conversation Ownership — Implementation & Certification

**Status:** Implemented (pending production deploy review)  
**Product spec:** `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md`  
**Engineering design:** `docs/MCTB-PLATFORM-SENDER-ASSIGNMENT-DESIGN.md`  
**Platform sender:** `+18885046264` (single TFN; no pool in this pass)

---

## As-built schema

**Prisma model:** `MctbPlatformSenderAssignment` → table `mctb_platform_sender_assignments`

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | |
| `workspaceId` | FK → `Workspace` | **Customer** tenant (not platform owner) |
| `consumerE164` | string | Normalized via `normalizeMctbCallerE164` |
| `platformPhoneNumberId` | FK → `PhoneNumber` | Must be `platform_mctb_sender` |
| `conversationId` | optional FK → `Conversation` | |
| `missedCallEventId` | optional string | Audit / correlation |
| `state` | `ACTIVE` \| `RELEASED` | |
| `releaseReason` | optional string | `RESOLVED`, `STAFF_CLOSED`, `HANDOFF_COMPLETE`, `OPT_OUT`, `SUPPRESSED`, `IDLE_TIMEOUT`, `ADMIN_RELEASE`, `SUPERSEDED` |
| `createdAt`, `lastUsedAt`, `releasedAt`, `expiresAt` | timestamps | `expiresAt` = idle safety net |

**Migration:** `prisma/migrations/20260924183000_mctb_platform_sender_assignment/migration.sql`

**Active uniqueness:** partial unique index `mctb_platform_sender_assignments_active_pair_key` on `(consumerE164, platformPhoneNumberId)` WHERE `state = 'ACTIVE'`.

**Claim concurrency:** transaction + partial unique index; `P2002` on create → re-read active row → `REUSED` or `COLLISION`.

---

## Runtime modules

| Module | Role |
|--------|------|
| `src/lib/mctb/messaging/platform-sender-assignment.ts` | Claim, reuse, collision, release, touch, idle expiry, inbound resolution |
| `src/lib/mctb/messaging/platform-outbound-gate.ts` | Gate PLATFORM sends before provider |
| `src/lib/mctb/messaging/platform-assignment-lifecycle.ts` | Release on conversation lifecycle |

**Idle timeout:** `MCTB_PLATFORM_SENDER_ASSIGNMENT_IDLE_MS` = **72 hours** (safety net; explicit lifecycle release is preferred).

**Outbound integration:** `send.ts`, `customer-sms.ts`, `send-customer-sms-job.ts` — collision → suppress / `PLATFORM_SENDER_PAIR_COLLISION` (no send).

**Inbound integration:** `platform-sender-inbound-core.ts` — `resolvePlatformMctbInboundReplyWithAssignment` first; legacy 14-day resolver fallback; touch on accepted ingress.

**STOP:** `platform-inbound-boundary.ts` — release assignment on platform STOP.

**Lifecycle release:** `handoff/automation-state.ts` (resolved/booked paths), workspace STOP in `customer-sms.ts`.

**WORKSPACE sender mode:** unchanged — no assignment path.

---

## Automated tests

```bash
npx tsx scripts/test-mctb-platform-sender-assignment.ts
```

Covers matrix A–L (sequential reuse, same-workspace reuse, collision, atomic race, legacy unique/ambiguous, released owner, idle expiry, STOP release, platform-owner separation, tenant propagation, historical rows).

**Tenant isolation regression** (when present on branch):

```bash
npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts
```

Run after merging tenant certification remediation if not yet on `master`.

---

## Production deployment & handset certification checklist

Do **not** run STOP until other cases pass. Do **not** auto-execute on deploy — human review.

1. [ ] Deploy commit verified on target environment (`prisma migrate deploy` applied).
2. [ ] Platform sender still `+18885046264`; `platform_mctb_sender` role intact.
3. [ ] `senderMode = PLATFORM` test workspace: outbound recovery triggers **CLAIMED** (logs: `mctb-platform-sender-assignment`).
4. [ ] Twilio send: `Message.from` / metadata `outboundSmsFromE164` = `+18885046264`.
5. [ ] `mctb_platform_sender_assignments` row **ACTIVE** for test consumer + platform phone id.
6. [ ] Consumer reply → inbound `resolutionSource = ACTIVE_ASSIGNMENT` → correct `workspaceId`.
7. [ ] AI Lead Recovery second turn uses **same** workspace Brain (no assignment lookup inside LR).
8. [ ] Explicit release (resolve conversation / handoff complete) → `RELEASED`; pair reclaimable.
9. [ ] HELP on platform sender — platform-safe, no tenant leak.
10. [ ] **LAST:** STOP → suppression + assignment `OPT_OUT` / `RELEASED`; subsequent PLATFORM send blocked.

**Collision observability:** search logs for `decision":"COLLISION"` and `PLATFORM_SENDER_PAIR_COLLISION` suppressions.

---

## Out of scope (this pass)

Platform number pool, second TFN, AI/body tenant routing, Lead Recovery tenant discovery changes, Voice V3, Call Handling, WORKSPACE sender behavior.
