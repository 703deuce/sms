# MCTB Platform Inbound Tenant Resolution + AI Lead Recovery Audit

**Date:** 2026-09-24 (UTC)  
**Type:** Read-first audit (production DB + source trace)  
**Scope:** Reply to shared platform TFN `+18885046264` — tenant routing, AI Lead Recovery, booking isolation  
**Out of scope:** Voice V3, outbound Model B redesign, activating dormant `AI_BOOK` beyond what config already exposes

---

## Executive summary

| Area | Result |
|------|--------|
| Latest PLATFORM outbound (ws_1) | **Found** — breadcrumbs on `MissedCallEvent` + `Message` row |
| Resolver (live consumer → 888) | **RESOLVED → `ws_1`**, candidate count **1** |
| Ambiguity (two workspaces) | **AMBIGUOUS** in unit tests — no guess |
| Inbound webhook crash risk | **Defect found and fixed locally** (`conv.messages?.[0]`) — deploy before relying on inbound |
| `Message.from` breadcrumb | **Defect** — row shows `+15714073615` while metadata/Twilio From is `+18885046264` |
| ws_1 isolation proof | **Cannot prove** customer vs platform-owner separation (both are `ws_1`) |
| AI workspace propagation | **Uses resolved `input.workspaceId`** — no `platformSender.workspaceId` in lead-recovery lib |
| Direct `AI_BOOK` in production | **Configurable** — ws_1 has `aiBooking.enabled` path → `bookingMode: AI_BOOK` when enabled; policy health **`NEEDS_CONFIGURATION`** |

**SAFE TO REPLY TO CURRENT 888 THREAD: YES** — for **tenant resolution** on the controlled ws_1 test, **after** deploying the `conv.messages?.[0]` guard. Reply will route to **ws_1** deterministically. Caveats: ws_1 does not prove multi-tenant isolation; fix `Message.from` persistence for long-term message-based evidence; Lead Recovery booking may be degraded until policy health is green.

---

## PART 1 — Production outbound record (latest PLATFORM test)

Queried via `scripts/audit-mctb-platform-inbound-production.ts` (caller masked).

| Field | Value |
|-------|--------|
| Customer `workspaceId` | `ws_1` |
| `MissedCallEvent.id` | `cmufx6obe100a0g5v5x2h3x1m` |
| `Message.id` | `cmufx6u2v3t4a2b6a3q1d586o` |
| Twilio `MessageSid` | `SM8a37133011c328a4169a9e32a3be7dd5` |
| `Conversation.id` | `cmufx6xh2541o3h5r6c3t2v4p` |
| `senderMode` (metadata) | `PLATFORM` |
| Platform `phoneNumberId` | `cmufvsanf1g0v060m13730z0q` |
| Metadata `outboundSmsFromE164` | `+18885046264` |
| `smsSentAt` | `2026-09-24T19:23:42.489Z` |
| `Message.workspaceId` | `ws_1` |
| **`Message.from` (DB)** | **`+15714073615`** ⚠️ |
| Handset From (observed) | `+18885046264` ✓ |

**Breadcrumbs used by inbound resolver:**

1. **`MissedCallEvent`** — `smsSentAt`, `callerE164`, metadata `outboundSmsPhoneNumberId` / `outboundSmsFromE164` / `outboundSmsSenderMode` (written in `send.ts` after successful send).
2. **`Message`** — `workspaceId`, `to`, `from`, `createdAt` within 14-day window (weaker today because `Message.from` ≠ platform E.164).
3. **`Conversation`** — `productSource: MCTB`, `phoneNumberId` = platform sender id, recent outbound `ConversationMessage` (nested query; see defect below).

Recovery thread creation: `ensureMctbRecoveryConversation` in `send.ts` with `outboundSmsPhoneNumberId: route.phoneNumberId`.

---

## PART 2 — Inbound path (Twilio → processing)

| Step | File | Function |
|------|------|----------|
| 1 | `src/app/api/twilio/inbound/route.ts` | `POST` — signature, detect platform `To` |
| 2 | `src/lib/mctb/messaging/twilio-platform-inbound.ts` | `tryHandleTwilioMctbPlatformSenderInbound` |
| 3 | `src/lib/mctb/messaging/platform-sender-inbound-core.ts` | `handleMctbPlatformSenderInboundCore` |
| 4 | `src/lib/mctb/messaging/platform-inbound-boundary.ts` | `handlePlatformSenderComplianceInbound` (HELP/STOP) |
| 5 | `src/lib/mctb/messaging/platform-inbound-tenant-resolution.ts` | `resolvePlatformMctbInboundReply` |
| 6 | `src/lib/mctb/messaging/inbound-sms-ingress.ts` | `acceptMctbInboundSmsIngress` (durable + job) |
| 7 | `src/lib/mctb/messaging/process-inbound-sms-job.ts` | `processMctbInboundSmsJob` |
| 8 | `src/lib/agents/missed-call-text-back/customer-sms.ts` | `handleMctbCustomerSmsReply` |
| 9 | `src/lib/mctb/lead-recovery/conversation-runtime.ts` | `handleMctbLeadRecoveryInboundSms` |

**AMBIGUOUS / UNMATCHED:** `platform-sender-inbound-core.ts` returns early — **no** `acceptMctbInboundSmsIngress`, **no** AI, **no** conversation mutation.

---

## PART 3 — How workspace is selected

**Shared `To = +18885046264` does not select tenant.**

`loadPlatformMctbReplyContexts` (`platform-inbound-tenant-resolution.ts`):

1. Find `Contact` rows matching consumer E.164 variants (any workspace).
2. **Conversations** — `productSource: MCTB`, platform `phoneNumberId` or `fromE164`, recent outbound messages on thread.
3. **`Message`** — `workspaceId` in candidate set, `to` = consumer, `from` = platform E.164, within window.
4. **`MissedCallEvent`** — caller match, `smsSentAt` in window, metadata proves platform sender.

`resolvePlatformInboundReplyFromContexts`:

- 0 contexts → **UNMATCHED**
- 2+ distinct `workspaceId` → **AMBIGUOUS** (no recency tie-break)
- 1 → **RESOLVED**

**Reply-context window:** `MCTB_PLATFORM_REPLY_CONTEXT_WINDOW_MS` = `INBOUND_OUTBOUND_PAIRING_WINDOW_MS` = **14 days** (`src/lib/messaging/inbound-workspace-routing-policy.ts`).

---

## PART 4 — Live resolver result (production test message)

```
RESOLUTION: RESOLVED
workspaceId: ws_1
candidate workspace count: 1
evidence: MissedCallEvent (platform metadata + smsSentAt); Message row (workspace + to consumer)
conversationId in resolution: null (conversation branch did not attach id; event/message paths sufficient)
```

Run again:

```bash
WORKSPACE_ID=ws_1 npx tsx scripts/audit-mctb-platform-inbound-production.ts
```

---

## PART 5 — Multi-business safety

Unit tests:

- `scripts/test-mctb-platform-sender.ts` — two contexts → **AMBIGUOUS**
- `scripts/test-mctb-platform-inbound-tenant-isolation.ts` — ws_customer_A + ws_customer_B → **AMBIGUOUS**

No “newest wins” in `resolvePlatformInboundReplyFromContexts` — only unique workspace count.

---

## PART 6 — AI Lead Recovery after resolution

`acceptMctbInboundSmsIngress` passes **`workspaceId` from resolver** (customer workspace).

`handleMctbCustomerSmsReply({ workspaceId: resolution.workspaceId, ... })` loads:

- `loadMissedCallTextConfig(workspaceId)`
- `loadLeadRecoveryConfig(workspaceId)`
- `handleMctbLeadRecoveryInboundSms({ workspaceId, ... })`

**Does not** load tenant from `To` or from platform `PhoneNumber.workspaceId`.

---

## PART 7 — Business Brain / approved information

`buildMctbSemanticConversationContext` (`semantic-conversation-context.ts`):

- `loadLeadRecoveryConfig(input.workspaceId)`
- `loadMctbApprovedBusinessInformation(input.workspaceId)`

All keyed on **resolved customer `workspaceId`**.

---

## PART 8 — Lead Recovery configuration

`loadLeadRecoveryConfig(workspaceId)` reads `workspace.customFieldsConfig.mctb.leadRecovery` + `loadMctbAiBookingConfig(workspaceId)` for booking mode.

Platform owner workspace is **not** consulted for customer reply handling.

---

## PART 9 — Booking capabilities (MCTB SMS, not Voice V3)

| Capability | Active when | Workspace for actions |
|------------|-------------|------------------------|
| FAQ / approved info | LR enabled | `ctx.workspaceId` |
| `SEND_BOOKING_LINK` | Policy + `resolveBookingUrl(workspaceId, config)` | Customer workspace |
| `AI_BOOK` | `aiBooking.enabled` → `bookingMode: AI_BOOK`; policy allows + semantics | Customer workspace via `executeLeadRecoveryActions` |
| Reschedule/cancel | Policy intents if enabled | Same |

ws_1 audit: `leadRecovery.enabled: true`, `policyHealth: NEEDS_CONFIGURATION`, `actionCapabilities` includes `AI_BOOK` and `SEND_BOOKING_LINK`. Booking behavior may be **limited** until configuration is complete — separate from tenant routing.

---

## PART 10 — Booking link tenant

`action-runtime.ts` → `resolveBookingUrl(ctx.workspaceId, ctx.config)` — not platform owner.

---

## PART 11 — Calendar / direct book

If `AI_BOOK` delegates, paths use `input.workspaceId` from lead recovery runtime (`getMctbAiBookingSessionStore`, provider gates). No Voice V3 booking pipeline in this SMS path.

---

## PART 12 — ws_1 testing limitation

| Role | Current cert |
|------|----------------|
| Customer workspace | `ws_1` |
| Platform `PhoneNumber.workspaceId` | `ws_1` |

A bug substituting platform owner workspace would **still look correct**. Multi-tenant proof requires **ws_customer_A** ≠ **ws_platform** with synthetic or staging data.

Automated isolation (resolver layer only):

```bash
npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts
```

---

## PART 13 — Ambiguity fail-closed

On **AMBIGUOUS**: no ingress accept, no LR, no booking link, no LLM disambiguation (PART 15).

---

## PART 14 — Platform owner invariant

Platform owner may own canonical `PhoneNumber` row only. Customer `Message`, `Conversation`, `MissedCallEvent`, LR, Brain, booking → **resolved customer workspace**.

---

## Defects found

### D1 — Inbound resolver crash (material, fixed in branch)

`loadPlatformMctbReplyContexts` accessed `conv.messages[0]` when `messages` was undefined (compat/Prisma), throwing before resolution.

**Fix:** `conv.messages?.[0]?.createdAt` in `platform-inbound-tenant-resolution.ts`.

**Action:** Deploy before production reply test.

### D2 — `Message.from` breadcrumb mismatch (follow-up)

`sendQuickSms` sets `Message.from` to `preferredFrom || reg.phoneE164` **before** `input.from` (`send-quick.ts` ~L224). Platform sends pass `from: +18885046264` but DB stored `+15714073615`.

**Impact:** `messageHits` in resolver may miss; **MissedCallEvent metadata** still matched for current test.

**Action:** Prefer `input.senderRoute?.fromE164 || input.from` over workspace `preferredFrom` when persisting `Message.from` (separate fix; not merged in this audit pass per instruction to preserve outbound path unless concrete regression).

---

## Tests run

```bash
npx tsx scripts/audit-mctb-platform-inbound-production.ts
npx tsx scripts/test-mctb-platform-sender.ts
npx tsx scripts/test-mctb-platform-inbound-tenant-isolation.ts
```

---

## Files touched in this audit pass

| File | Change |
|------|--------|
| `docs/MCTB-PLATFORM-INBOUND-TENANT-AND-AI-AUDIT.md` | This report |
| `scripts/audit-mctb-platform-inbound-production.ts` | Production read-only audit |
| `scripts/test-mctb-platform-inbound-tenant-isolation.ts` | Synthetic isolation + ambiguity |
| `src/lib/mctb/messaging/platform-inbound-tenant-resolution.ts` | Optional chaining guard (D1) |

**Not changed:** Model B outbound send, Voice V3, bulk PLATFORM enable.

---

## Remaining before full inbound cert

1. Deploy D1 fix.
2. Handset: reply → confirm `acceptMctbInboundSmsIngress` + LR response in **ws_1** inbox.
3. HELP / STOP on 888.
4. Multi-tenant staging test (ws_customer_A ≠ ws_platform).
5. Fix D2 for durable `Message.from` evidence.

---

SAFE TO REPLY TO CURRENT 888 THREAD: **YES** (tenant resolves to ws_1; deploy D1 first; ws_1 isolation not proven; LR policy health may limit booking)
