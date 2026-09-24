# MCTB Platform Sender — Implementation Report

**Branch:** `cursor/mctb-platform-sender-impl-2304`  
**Commit:** `a7af2b87`  
**Scope:** MCTB only. No AI Receptionist / Voice V3 runtime changes.  
**Pre-implementation audit:** `docs/MCTB-PLATFORM-SENDER-PRE-IMPLEMENTATION-AUDIT.md` (approved on PR #494).

---

## A. Architecture Implemented

1. **Ingress (unchanged):** Customer business line → CFNA → per-workspace MCTB toll-free ingress DID → TeXML MCTB runtime → workspace resolution.
2. **Outbound sender mode** on `MissedCallTextConfig.senderMode`:
   - `WORKSPACE` (default): workspace-owned sender via `resolveMctbSmsSender` + `resolveMctbOutboundSmsRoute`.
   - `PLATFORM`: canonical Transovo platform `PhoneNumber` (`mctbRole = platform_mctb_sender`) via `resolveCanonicalMctbPlatformSender`; send authorization uses platform-owner `sendWorkspaceId`; message/conversation data remains `customerWorkspaceId`.
3. **Inbound (narrow):** When `To` matches the active platform sender E.164, Twilio/Telnyx bypass generic `resolveInboundWorkspaceRouting` / `single_phone_row` and use `handleMctbPlatformSenderInboundCore` → tenant resolution → `acceptMctbInboundSmsIngress` (same durable path as Telnyx MCTB).
4. **Tenant resolution:** `RESOLVED` | `AMBIGUOUS` | `UNMATCHED`. Multiple eligible workspaces → **AMBIGUOUS** (no inbox, no Lead Recovery). STOP/HELP at platform boundary without guessing tenant for STOP.

---

## B. Files Changed

| FILE | CHANGE | WHY |
|------|--------|-----|
| `prisma/schema.prisma` | `MctbSenderMode` enum + `senderMode` on `MissedCallTextConfig` | Explicit PLATFORM vs WORKSPACE |
| `prisma/migrations/20260924180000_mctb_platform_sender_mode/migration.sql` | Migration | Safe default `WORKSPACE` |
| `src/lib/messaging/compliance/phone-number-class.ts` | `platform_mctb_sender` role + settings helper | Canonical platform resource marker |
| `src/lib/mctb/messaging/platform-sender-config.ts` | **NEW** | Resolve platform sender by env ID or role |
| `src/lib/mctb/messaging/platform-inbound-tenant-resolution.ts` | **NEW** | RESOLVED / AMBIGUOUS / UNMATCHED |
| `src/lib/mctb/messaging/platform-inbound-boundary.ts` | **NEW** | STOP/HELP at shared sender |
| `src/lib/mctb/messaging/platform-sender-inbound-core.ts` | **NEW** | Shared Twilio/Telnyx platform inbound |
| `src/lib/mctb/messaging/twilio-platform-inbound.ts` | **NEW** | Twilio adapter |
| `src/lib/agents/missed-call-text-back/sms-sender.ts` | Explicit `smsPhoneNumberId` before ingress when set | Product semantics correction |
| `src/lib/mctb/messaging/outbound-sms-route.ts` | PLATFORM route + fail-closed | Platform outbound |
| `src/lib/agents/missed-call-text-back/types.ts` | `senderMode` on config | Type surface |
| `src/lib/agents/missed-call-text-back/config.ts` | `sender_mode` patch + default | API/config |
| `src/lib/agents/missed-call-text-back/send.ts` | Outbound metadata on missed call + recovery conversation | Inbound routing evidence |
| `src/lib/mctb/messaging/recovery-conversation.ts` | `outboundSmsPhoneNumberId` | Conversation sender identity |
| `src/app/api/twilio/inbound/route.ts` | Platform path before generic routing | Twilio MCTB parity |
| `src/lib/messaging/telnyx/webhook-handlers.ts` | Platform path before generic routing | Telnyx parity for platform TFN |
| `src/lib/messaging/inbound-workspace-routing-policy.ts` | Exclude `platform_mctb_sender` from tenant `single_phone_row` | Blast-radius guard |
| `scripts/test-mctb-platform-sender.ts` | **NEW** | Required tests |
| `scripts/test-mctb-sms-sender-strict.ts` | Expect explicit SMS source | WORKSPACE priority |

**Voice V3 / LiveKit / GPT-Live:** no files under `src/lib/voice-v3/**`, `voice-runtime/**`, or Voice V3 wizard routes were modified in this branch.

---

## C. Database Migration

- **Change:** `MctbSenderMode` enum (`WORKSPACE`, `PLATFORM`); column `missed_call_text_configs.senderMode` NOT NULL DEFAULT `WORKSPACE`.
- **Compatibility:** All existing workspaces remain `WORKSPACE` → same outbound behavior as before migration (ingress-first only when `smsPhoneNumberId` is not an explicit separate sender). No automatic switch to `+18885046264`.

---

## D. Platform Sender Configuration

- Represent `+1 888 504 6264` as one **platform-owned** `PhoneNumber` with `settingsJson` from `platformMctbSenderSettings({ provider: "twilio", tfvApproved: true })` and `mctbRole: "platform_mctb_sender"`.
- **Resolve:** `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` (preferred) or exactly one Active row with `platform_mctb_sender` role.
- **Do not** hard-code E.164 in send/resolver logic (only env + DB).

---

## E. Sender Resolution

| Mode | Outbound `from` | `sendWorkspaceId` | `customerWorkspaceId` |
|------|-----------------|-------------------|------------------------|
| `PLATFORM` | Platform `PhoneNumber.e164` | Platform owner workspace | Customer workspace |
| `WORKSPACE` + explicit `smsPhoneNumberId` | Verified SMS DID | Owning workspace | Customer workspace |
| `WORKSPACE` legacy (no explicit SMS) | `phoneNumberId` then `smsPhoneNumberId` | Owning workspace | Customer workspace |

PLATFORM: **no fallback** to ingress or alternate numbers if platform sender unauthorized → `platform_sender_not_configured` / `platform_sender_not_authorized` logs, send suppressed.

---

## F. Provider Selection

- Outbound uses existing `isPhoneAuthorizedForOutboundSms` → `sendQuickSms` → `sendViaRegistration` / `getMessagingProviderForRegistration`.
- Platform resource `provider` field drives Twilio vs Telnyx adapter; swapping platform `PhoneNumber` to Telnyx + approved compliance does not require MCTB business-logic edits (verified by `platformMctbSenderSettings({ provider: "telnyx" })` shape test).

---

## G. Outbound Flow

`executeMissedCallTextSend` → `loadMissedCallTextConfig` → `resolveMctbOutboundSmsRoute` → (`PLATFORM` → `resolveCanonicalMctbPlatformSender` OR `WORKSPACE` → `resolveMctbSmsSender`) → `sendQuickSms` (`senderRoute.sendWorkspaceId`) → `ensureMctbRecoveryConversation` + `MissedCallEvent.metadata` outbound sender fields.

---

## H. Inbound Twilio Flow

`POST /api/twilio/inbound` → `isActiveMctbPlatformSenderE164(to)` → (skip `resolveInboundContext`) → verify signature (parent token) → `handleMctbPlatformSenderInboundCore` → compliance STOP/HELP → `resolvePlatformMctbInboundReply` → if `RESOLVED`, `acceptMctbInboundSmsIngress` → job `mctb_process_inbound_sms` → existing Lead Recovery path.

---

## I. Shared-Sender Tenant Resolution

- **Evidence:** MCTB conversations (`productSource=MCTB`) tied to platform `phoneNumberId`/`fromE164`, recent outbound messages, `Message` rows, `MissedCallEvent` with `metadata.outboundSmsPhoneNumberId` / `outboundSmsFromE164`.
- **RESOLVED:** exactly one workspace in eligible set.
- **AMBIGUOUS:** 2+ workspaces → log `ambiguous_platform_reply`, no tenant delivery.
- **UNMATCHED:** zero → log `unmatched_platform_reply`, no platform-owner inbox attribution.

Recency is **not** used to break ties when count > 1.

---

## J. STOP / HELP

- **STOP:** `handlePlatformSenderComplianceInbound` applies suppression to **all** workspaces with active platform MCTB reply context for that consumer; no conversational routing.
- **HELP:** Transovo platform help string (no business A/B context); safe when tenant unknown/ambiguous.

---

## K. Conversation Ownership

- `ensureMctbRecoveryConversation` / `acceptMctbInboundSmsIngress` use **customer** `workspaceId`.
- `sendWorkspaceId` is only passed to `sendQuickSms.senderRoute` for provider credentials.

---

## L. AI Lead Recovery

- Unchanged runtime: inbound still enqueues `mctb_process_inbound_sms` → `handleMctbCustomerSmsReply` / Lead Recovery when resolution is `RESOLVED` only.

---

## M. Voice V3 No-Change Confirmation

No edits to: `src/lib/voice-v3/**`, `src/app/**/voice-v3/**`, `voice-runtime/**`, Voice V3 tools, GPT-Live delegation, `/voice/calls`, Call Handling ownership switcher.

---

## N. Tests

```bash
npx prisma generate
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-sender.ts
# test:mctb-platform-sender ok

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-sms-sender-strict.ts
# test:mctb-sms-sender-strict ok

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-durable-inbound-architecture.ts
# ok

NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mass-texting-boundary.ts
# ok
```

---

## O. Remaining Production Configuration

After deploy (not performed in this pass):

1. **DB:** Insert/update platform `PhoneNumber` for `+18885046264` (Twilio TFV approved), `mctbRole=platform_mctb_sender`; set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`.
2. **Twilio console (number or messaging service owning the TFN):**
   - Inbound SMS webhook: `https://<app>/api/twilio/inbound` POST
   - Status callback: `https://<app>/api/twilio/message-status` POST (existing)
   - Use parent/subaccount auth token already configured in app
3. Enable `senderMode=PLATFORM` only for workspaces intentionally migrated (not bulk default).

---

## P. Production Certification Matrix (handset)

1. Workspace A PLATFORM outbound → From platform TFN → message in A only  
2. Workspace B PLATFORM outbound → same From → message in B only  
3. Consumer reply with single active thread → A inbox + Lead Recovery  
4. A+B active platform threads → reply **AMBIGUOUS** (neither inbox)  
5. STOP with ambiguity → opt-out recorded; no cross-tenant body leak  
6. HELP with ambiguity → platform help only  
7. Workspace C WORKSPACE + verified sender → unchanged routing  
8. PLATFORM sender disabled/unauthorized → fail closed, ingress/voice OK  

---

## Q. Rollback

- Set affected workspaces `senderMode=WORKSPACE` (or revert migration column default behavior).
- Remove/disable platform `PhoneNumber` row or env `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` → PLATFORM sends fail closed; ingress DIDs unaffected.

---

## R. Diff Summary

Run after commit:

```bash
git status
git diff --stat master...HEAD
```

---

**STOP:** No merge, no production Twilio/Telnyx changes, no live SMS certification in this pass.
