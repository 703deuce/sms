# Transovo Multi-Tenant / Workspace Isolation Audit

**Date:** 2026-09-24 (UTC)  
**Type:** READ-FIRST (no production deploy; no sweeping refactors)  
**Scope:** MCTB, AI Receptionist / Voice V3, shared PLATFORM sender, Call Handling, core SaaS data plane  
**Companion:** `docs/MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md` (888 routing — subset of this audit)

---

## Governing invariant

> Workspace A must never read, write, route, execute, display, book, message, call, configure, or mutate resources belonging to Workspace B.

Shared Transovo infrastructure may exist; **shared infrastructure must never become customer tenant identity.**

---

## TENANT ROOT (actual implementation)

| Layer | Implementation |
|-------|----------------|
| **User** | `User` — auth identity (`email`, `passwordHash`, …) |
| **Workspace** | `Workspace` — customer tenant boundary (`id`, `slug`, `type`, `ownerUserId`, …) |
| **Membership** | `Membership` — `@@unique([userId, workspaceId])`, role (`OWNER`, …) |
| **Session** | Cookie `transovo_session` — JSON `{ userId, email, name, isAdmin }` (`src/lib/auth.ts`) |
| **Active workspace** | Cookie `transovo_workspace` + `getActiveWorkspaceId()` |

**Resolution path:**

```
getSession()
  → getActiveWorkspaceId()
      → cookie transovo_workspace (if set)
      → resolvePreferredBusinessWorkspaceId(userId, cookie)
          → memberships for userId (business workspaces)
          → may prefer workspace owning HP-certified SMS number (571) when cookie workspace lacks it
      → fallback: membership.findFirst({ userId })  // nondeterministic if many workspaces, no cookie
```

**API workspace for mutations:** `requireSession()` → `auth.workspaceId` from `getActiveWorkspaceId()`.  
**Explicit override:** `resolveWorkspaceId(session, requestedWorkspaceId)` — override allowed **only** if `membership` exists for `(userId, requestedWorkspaceId)` (`src/lib/api-auth.ts`).

**Server pages:** `requireWorkspaceContext()` — session + `getActiveWorkspaceId()` (`src/lib/workspace-data.ts`).

### Tenant root assessment

| Check | Result |
|-------|--------|
| Arbitrary `workspaceId` in body without membership | **Blocked** when routes use `resolveWorkspaceId` |
| Cookie workspace not in memberships | **Mitigated** — `resolvePreferredBusinessWorkspaceId` does not return non-member cookie as active tenant |
| Multi-workspace user default | **WARN** — `membership.findFirst` when DB error + empty cookie |
| HP workspace auto-preference | **WARN** — user with access to A+B may be steered to workspace with HP 571 number (UX, not B→A data leak) |

---

## NEW CUSTOMER / WORKSPACE CREATION

**Paths:** `src/app/api/auth/signup/route.ts`, `src/app/api/workspace/route.ts`, `createWorkspaceForUser()` (`src/lib/workspace/create-workspace.ts`).

**New workspace receives:**

- New `Workspace` row (unique `slug`)
- `Membership` OWNER for creating user
- Optional `messagingRegistration`, `workspaceLimits` (business)
- Voice/MCTB onboarding blob in `customFieldsConfig` for voice intent — **templates only**, not ws_1 copy

**Does not automatically copy:** ws_1 phone numbers, agents, conversations, MCTB `MissedCallTextConfig`, integrations, knowledge, contacts.

**Assessment:** **PASS** for clean tenant shell at creation (no evidence of cloning ws_1 tenant state in create paths). Per-product config is created on first use / onboarding flows — those must be audited separately when enabled.

---

## DATABASE TENANT OWNERSHIP INVENTORY

**Schema scale (Prisma):** ~**300** models; ~**273** direct `workspaceId String` fields.

**Convention:**

| Pattern | Examples |
|---------|----------|
| **Direct** `workspaceId` | `Contact`, `Conversation`, `Message`, `PhoneNumber`, `MissedCallEvent`, `VoiceAgent`, `VoiceCall`, `Appointment`, … |
| **Indirect** | `ConversationMessage` → `conversationId` → `Conversation.workspaceId`; `VoiceCallEvent` → `callId` → `VoiceCall.workspaceId` |
| **Child FK without workspaceId** | Must always be loaded via parent scoped query — **write-time invariant risk** (§27) |

**Representative customer-owned models (direct `workspaceId`):**

| Domain | Models (representative) |
|--------|------------------------|
| Core | `Workspace`, `Membership`, `WorkspaceInvite` |
| Numbers | `PhoneNumber`, `PhoneNumberAssignment`, `MessagingProductRegistration` |
| MCTB | `MissedCallTextConfig` (via workspace), `MissedCallEvent`, MCTB LR / booking link tables |
| Messaging | `Contact`, `Conversation`, `Message`, `Suppression`, consent events |
| Voice | `VoiceAgent`, `VoiceCall`, `VoiceRecording`, `VoiceKnowledgeBase`, `VoiceCalendarConnection` |
| Appointments | `Appointment`, `AppointmentType`, calendar connections |
| Integrations | OAuth connection rows per workspace |
| Billing | workspace-scoped usage / subscription artifacts |

**Full enumeration:** generate from `prisma/schema.prisma` (`rg 'workspaceId'`) before compliance sign-off; this audit samples critical paths.

---

## RESOURCE CLASSIFICATION (§4)

### A — Customer tenant resources

All rows with `workspaceId` = customer workspace for operational data (contacts, calls, messages, agents, knowledge, appointments).

### B — Transovo shared infrastructure

| Resource | Owner row | Customer tenant from |
|----------|-----------|----------------------|
| PLATFORM SMS sender `+18885046264` | `PhoneNumber.workspaceId` = platform owner (`ws_1` / `MCTB_PLATFORM_OWNER_WORKSPACE_ID`) | **Inbound resolver** / future active assignment — **not** platform `PhoneNumber.workspaceId` |
| Parent Twilio send credentials | Platform workspace for Model B send | Outbound `Message.workspaceId` = **customer** workspace in route |
| Telnyx MCTB TeXML ingress pool | Per-customer ingress DIDs on **customer** `PhoneNumber` rows | `phoneNumberId` on config + call correlation |

**Verified path:** `handleMctbPlatformSenderInboundCore` → `resolution.workspaceId` → `acceptMctbInboundSmsIngress({ workspaceId })` — **PASS** (no platform owner as customer tenant).

### C — Global system configuration

Platform admin flags, feature flags, provider env secrets — must not embed customer PII. Not exhaustively audited in this pass.

---

## TENANT OWNERSHIP MATRIX (§30 — selected rows)

| Resource | Tenant owner | Ownership path | Read auth | Write auth | Runtime routing | Shared? | Risk | Result |
|----------|--------------|----------------|-----------|------------|-----------------|---------|------|--------|
| Workspace | Self | `id` | Membership | OWNER/admin | Session | No | Low | **PASS** |
| PhoneNumber (customer) | Customer WS | `workspaceId` | Session WS | Session WS + admin | Ingress/sender config | No | IDOR on `[id]` | **WARN** (spot-check only) |
| PhoneNumber (platform TFN) | Platform WS | `workspaceId` (infra) | Internal | Platform ops | SMS To address | **YES** | Tenant confusion | **WARN** |
| MissedCallTextConfig | Customer | `workspaceId` | MCTB APIs | Setup API | Voice ingress | No | — | **PASS** (session scoped) |
| MissedCallEvent | Customer | `workspaceId` | List/detail APIs | Runtime | TeXML/webhooks | No | — | **WARN** |
| Contact | Customer | `workspaceId` | Contacts APIs | Contacts APIs | — | No | Global phone unique | **PASS** (`@@unique([workspaceId, phone])`) |
| Conversation | Customer | `workspaceId` | Inbox/MCTB | Messaging | — | No | Child messages | **WARN** |
| Message | Customer | `workspaceId` | Inbox | Send pipelines | Provider | No | — | **WARN** |
| PLATFORM inbound reply | Customer (resolved) | Resolver → WS | Webhook | N/A | Pair + assignment (future) | **YES** | Ambiguous pair | **WARN** |
| VoiceAgent | Customer | `workspaceId` | Voice APIs | Voice APIs | PSTN bind | No | — | **WARN** |
| VoiceCall | Customer | `workspaceId` | `/api/voice/calls/[id]` | Runtime | Telnyx/LK | No | — | **PASS** (scoped GET) |
| Voice tool execution | Customer | Call/agent context | Webhook headers | Executor | `x-transovo-workspace-id` + agent match | No | Header trust | **WARN** |
| VoiceKnowledgeBase | Customer | `workspaceId` | KB APIs | KB APIs | RAG | No | — | **WARN** |
| VoiceCalendarConnection | Customer | `workspaceId` | Calendar APIs | OAuth | Book/find | No | — | **WARN** |
| MCTB Lead Recovery | Customer | Passed `workspaceId` | After ingress | Runtime | SMS job | No | Resolver | **PASS** (design) **WARN** (E2E) |
| Call Handling state | Customer | `PhoneNumber.settingsJson` on **owned** ingress | `/api/call-handling` | PATCH scoped | Telnyx `connection_id` | No | Cross-DID | **PASS** (code) **WARN** (no A/B test) |
| Analytics aggregates | Customer | Query `workspaceId` | Analytics routes | — | — | No | Unscoped SQL | **WARN** |
| New signup workspace | New tenant | New `id` | — | Signup | — | No | Clone ws_1 | **PASS** |

---

## PHONE NUMBER OWNERSHIP (§5)

**Roles (product):**

| Role | Typical storage | Modify by |
|------|-----------------|-----------|
| Business line (public) | Customer config / contact | Customer WS |
| MCTB voice ingress / CFNA target | `MissedCallTextConfig.phoneNumberId` | Customer WS |
| WORKSPACE SMS sender | `senderMode=WORKSPACE`, `smsPhoneNumberId` | Customer WS |
| PLATFORM SMS sender | Canonical platform `PhoneNumber` (infra WS) | Platform ops only |
| AI Receptionist ingress | Same canonical voice ingress DID + Call Handling | Customer WS |

**Guards:** `loadCanonicalVoiceIngressPhone`, `resolveCanonicalVoiceIngressPhoneNumberId` always `where: { id, workspaceId: input.workspaceId }`.

**Move number:** `/api/numbers/[numberId]/move-workspace` — source must be in `auth.workspaceId`; target requires membership — **PASS**.

---

## CALL HANDLING SWITCHER (§6)

**API:** `PATCH /api/call-handling` — `setActiveCallHandler({ workspaceId: auth.workspaceId, voiceIngressPhoneNumberId })`.

**Lock:** `withCallHandlingSwitchLock(voiceIngressPhoneNumberId)` — per **phone id**, not global.

**Telnyx:** PATCH `connection_id` only for phone row loaded under **that workspace**.

**Automated cross-tenant test:** **NOT PRESENT** — existing `test-call-handling-mctb-isolation.ts` covers mode flags only, not A/B workspaces.

| Result | **WARN** (code review **PASS**; regression test **FAIL**) |

**Recommended test (§24):** Two workspaces, two ingress `PhoneNumber` ids, flip A MCTB↔AI, assert B `settingsJson` and mock `connection_id` unchanged — add to `scripts/test-transovo-multi-tenant-isolation-fixture.ts` Phase 3.

---

## MCTB ISOLATION (§7–8)

- Setup, missed calls, handoff routes use `getActiveWorkspaceId()` / session workspace.
- Platform sender: customer records use **resolved** `workspaceId`; platform owner used only for suppression key namespace and parent send billing (`sendWorkspaceId` in outbound route) — document explicitly.
- **14-day resolver:** can return `AMBIGUOUS` — fail-closed, not cross-tenant leak.
- **Gap:** No automated IDOR suite for `MissedCallEvent` / conversation IDs across A/B.

| MCTB ISOLATION | **WARN** |
| SHARED PLATFORM RESOURCE SEPARATION | **WARN** (design **PASS**, ws_1 cert insufficient) |

---

## CONTACT ISOLATION (§9)

**Schema:** `Contact` `@@unique([workspaceId, phone])` — same E.164 may exist in A and B as **separate rows**.

| CONTACT ISOLATION | **PASS** (schema) **WARN** (API IDOR not fully tested) |

---

## CONVERSATION / MESSAGE (§10)

- `Conversation.workspaceId` required.
- `ConversationMessage` has no `workspaceId` — queries must join/filter via `conversation.workspaceId`.

| CONVERSATION/MESSAGE ISOLATION | **WARN** |

---

## AI LEAD RECOVERY (§11)

Runtime receives `workspaceId` from ingress (`handleMctbLeadRecoveryInboundSms(workspaceId, …)`). Must not load Brain from platform owner.

| AI LEAD RECOVERY ISOLATION | **PASS** (architecture) **WARN** (no A/B ALPHA vs BETA test in CI) |

---

## AI RECEPTIONIST / VOICE V3 (§12–14)

- PSTN binding via workspace-owned `PhoneNumber` + agent publish pipeline.
- `docs/voice-v3/VOICE-V3-RUNTIME-ISOLATION.md`, `scripts/test-voice-v3-runtime-isolation.ts` exist.
- **No Voice V3 code changes** in this audit.

| AI RECEPTIONIST ISOLATION | **WARN** (existing guards; PSTN E2E on two workspaces not in CI) |
| KNOWLEDGE ISOLATION | **WARN** |

**Voice tools:** `/api/telnyx/voice/tools` — `workspaceId` from `x-transovo-workspace-id`; `voiceAgent.findFirst({ id: agentId, workspaceId })`. **Risk:** if headers forgeable without call binding → **P1-class** (needs ingress hardening review). LLM must not supply tenant in tool args for booking — executor should use call context (spot-check in follow-up).

---

## CALENDAR / BOOKING (§15)

Appointments APIs: static test `test-appointments-tenant-isolation.ts` — routes require session; booking-platform scopes by `workspaceId`.

| CALENDAR ISOLATION | **WARN** (static **PASS**; Microsoft/Google A/B live test missing) |

---

## PROVIDER CREDENTIALS (§16)

OAuth and messaging registrations are workspace-scoped rows. PLATFORM send uses explicit parent path (`platform-parent-twilio-send`) — exception documented.

**Risk pattern to hunt:** customer send falling back to platform credentials when registration missing — audit send gates separately (`unified-send-gate`).

---

## ANALYTICS (§18)

Not exhaustively traced. Any aggregate without `where: { workspaceId }` is **P1** candidate.

| ANALYTICS ISOLATION | **WARN** |

---

## WEBHOOKS / JOBS (§19)

MCTB platform inbound resolves tenant before job enqueue. Full job inventory not completed in this pass.

| Background jobs | **WARN** |

---

## CACHE / GLOBAL STATE (§20)

`call-handling/set-active-call-handler.ts` — `switchingPhones` Set keyed by phone id (OK).  
Search hits for `ws_1` in **production `src/`** — see defect register.

---

## ws_1 / TEST LEAKAGE (§21)

| Class | Count (approx) |
|-------|----------------|
| `scripts/` only | Majority |
| `src/lib/mctb/platform-owner-workspace.ts` | **Intentional** platform owner default |
| `src/lib/voice/**` deploy helpers | **PRODUCTION RISK** if `WORKSPACE_ID` env missing |
| `src/app/api/voice/telnyx-official-baseline/route.ts` | Defaults `body.workspaceId \|\| "ws_1"` — dev/baseline route |

---

## DEFECT REGISTER (§31)

### P0 — confirmed cross-tenant exposure

**None confirmed** in this read-first pass without live IDOR reproduction. **Do not interpret as “zero bugs”** — run §33 test plan against staging with two real workspaces.

### P1 — strong defects / launch blockers (potential or process)

| ID | Area | Finding | Path | Fix direction |
|----|------|---------|------|----------------|
| P1-001 | Testing | No permanent two-workspace IDOR + Call Handling A/B suite | — | Implement §33 + fixture script phases |
| P1-002 | Voice tools | Tenant from `x-transovo-workspace-id` header | `src/app/api/telnyx/voice/tools/route.ts` | Bind header to signed call/session or VoiceCall row |
| P1-003 | Platform SMS | Single-TFN multi-customer routing ambiguous under concurrent active threads | Platform inbound resolver | Active ownership layer (`MCTB-PLATFORM-ACTIVE-CONVERSATION-OWNERSHIP.md`) |

### P2 — defense in depth

| ID | Area | Finding | File | Notes |
|----|------|---------|------|-------|
| P2-001 | Session | `membership.findFirst` default workspace | `src/lib/auth.ts` | Nondeterministic active WS |
| P2-002 | Session | HP-certified workspace preference | `preferred-business-workspace.ts` | May switch active WS without user intent |
| P2-003 | Voice | `ws_1` fallback when env missing | `ensure-realtime-clone-agent.ts`, etc. | Fail closed in production |
| P2-004 | Dev API | `telnyx-official-baseline` defaults ws_1 | `telnyx-official-baseline/route.ts` | Gate behind admin/dev only |
| P2-005 | Child rows | `ConversationMessage` lacks `workspaceId` | schema | Enforce parent workspace on write |

### P3 — cleanup / docs

| ID | Finding |
|----|---------|
| P3-001 | Hundreds of scripts default `WORKSPACE_ID` to ws_1 — OK for ops, document |
| P3-002 | `test-call-handling-mctb-isolation.ts` name implies cross-tenant; only mode flags |

---

## WRITE-TIME INVARIANTS (§27)

**Present:** PhoneNumber ingress resolution checks `workspaceId` on load.  
**Gaps:** Generic attach of `conversationId`, `contactId`, `agentId` across APIs — **not systematically verified**; recommend helper `assertResourceInWorkspace(type, id, workspaceId)` at mutation boundaries.

---

## UNIQUE CONSTRAINTS (§28)

**PASS:** `Contact` scoped per workspace.  
**Review:** Global `@unique` on provider ids (`providerMessageId`, `providerEventId`) — correct for provider dedupe, not tenant merge.

---

## REQUIRED AUTOMATED TEST PLAN (§33)

Permanent suite (implement incrementally):

| # | Test | Status |
|---|------|--------|
| 1 | A cannot read B resource by ID | **Planned** (fixture Phase 2+) |
| 2 | A cannot write B | **Planned** |
| 3 | A cannot use B PhoneNumber | **Planned** |
| 4 | A Call Handling switch cannot route B DID | **Planned** |
| 5 | A MCTB message not in B | **Planned** |
| 6 | A contact cannot expose B history | **Planned** |
| 7 | A LR cannot load B Brain | **Planned** |
| 8 | A booking cannot use B calendar | **Planned** |
| 9 | A Voice call cannot bind B agent | **Planned** |
| 10 | A Voice tool cannot use B calendar | **Planned** |
| 11 | A knowledge cannot retrieve B | **Planned** |
| 12 | A recording/transcript not for B | **Planned** |
| 13 | A analytics cannot aggregate B | **Planned** |
| 14 | PLATFORM send → customer-owned Message/Conversation WS | **Partial** (platform inbound tests) |
| 15 | Platform owner WS ≠ customer tenant | **PASS** (code path) |
| 16 | Background jobs preserve tenant | **Planned** |
| 17 | Same consumer in A and B | **PASS** (schema) |
| 18 | New Workspace C clean start | **PASS** (create path) |

**Scaffold:** `npx tsx scripts/test-transovo-multi-tenant-isolation-fixture.ts`  
**Env for DB phase:** `TENANT_ISO_WS_A`, `TENANT_ISO_WS_B`

---

## FINAL REPORT (§34)

```
TENANT ROOT:
  User → Membership → getActiveWorkspaceId() / resolveWorkspaceId() (membership-gated override)

CUSTOMER-OWNED RESOURCE COUNT:
  ~273 Prisma models/fields with direct workspaceId (~300 models total)

SHARED INFRASTRUCTURE RESOURCES:
  Platform TFN (+18885046264), parent Twilio PLATFORM send, platform owner workspace id (ws_1 default)

P0: 0 confirmed (read-first; IDOR suite not yet run)
P1: 3 (process + platform routing + voice header trust review)
P2: 5
P3: 2

CALL HANDLING ISOLATION:     WARN  (code PASS; A/B test missing)
MCTB ISOLATION:              WARN
AI RECEPTIONIST ISOLATION:   WARN
AI LEAD RECOVERY ISOLATION:  WARN
CALENDAR ISOLATION:          WARN
PHONE NUMBER ISOLATION:      WARN
CONVERSATION/MESSAGE ISOLATION: WARN
KNOWLEDGE ISOLATION:         WARN
ANALYTICS ISOLATION:         WARN
NEW WORKSPACE CLEAN-START:   PASS
SHARED PLATFORM RESOURCE SEPARATION: WARN

SAFE FOR SECOND REAL CUSTOMER: NO
```

**Reason:** Isolation patterns are present in auth, schema, Call Handling ingress scoping, and platform inbound resolution, but **cross-tenant IDOR and two-workspace Call Handling regression are not yet proven in automated tests**. ws_1-only production certification cannot detect several failure classes.

**Next focused passes (after this audit):**

1. Implement Phase 2–3 of `test-transovo-multi-tenant-isolation-fixture.ts` (A/B workspaces in CI/staging).  
2. Call Handling A/B Telnyx mock test.  
3. Voice tool webhook tenant binding review (P1-002).  
4. Active `(consumer + 888)` ownership implementation (operational doc).  
5. Twilio TFN / ISV multi-business compliance reconciliation before scale.

**Change discipline:** No merge required for this audit document. **No production deploy** for audit-only commits.
