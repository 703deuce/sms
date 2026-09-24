# MCTB Platform Sender — Pre-Implementation Source Audit

**Date:** 2026-09-24  
**Status:** Read-only audit — **no implementation, no production changes**  
**Scope:** Missed Call Text Back (MCTB) telephony, SMS, numbers, consent, conversations, provider layer  
**Hard boundary:** AI Receptionist / Voice V3 — **read-only** where shared phone infrastructure overlaps; **no Voice V3 changes proposed**

**Target product model (for planning):**

- Workspace-specific **MCTB ingress / forwarding DID** (toll-free per workspace) — voice only, resolves tenant.
- Shared **Transovo platform SMS sender** — initially Twilio TFV `+1 888 504 6264` (not yet referenced in repo).
- Optional future **workspace-owned verified sender** via `smsPhoneNumberId` without changing ingress.

---

## A. Executive Summary

### What already exists

| Area | Finding |
|------|---------|
| **Ingress vs sender in schema** | `MissedCallTextConfig.phoneNumberId` (voice trigger / ingress) and `smsPhoneNumberId` (optional outbound SMS) are **separate fields** with an explicit schema comment (`prisma/schema.prisma`). |
| **Sender resolution** | `resolveMctbSmsSender()` prefers `phoneNumberId`, then `smsPhoneNumberId` (`src/lib/agents/missed-call-text-back/sms-sender.ts`). |
| **Outbound routing** | `resolveMctbOutboundSmsRoute()` picks first **SMS-authorized** candidate; supports per-number TFV vs Telnyx A2P via `isPhoneAuthorizedForOutboundSms()` (`src/lib/mctb/messaging/outbound-sms-route.ts`). |
| **Provider abstraction** | `MessagingProvider` interface + `getMessagingProviderForRegistration()` — Twilio and Telnyx adapters (`src/lib/messaging/provider.ts`, `twilio-provider.ts`, `telnyx/provider.ts`). |
| **MCTB send path** | `executeMissedCallTextSend` → eligibility → template → `resolveMctbOutboundSmsRoute` → `sendQuickSms` → `sendViaRegistration` (`src/lib/agents/missed-call-text-back/send.ts`, `src/lib/sms/send-quick.ts`). |
| **Workspace resolution (voice)** | `resolveMctbInboundTenant()` — per-DID ingress, TeXML/SIP (`src/lib/mctb/tenant/resolve-inbound.ts`). |
| **Inbound SMS (Telnyx MCTB)** | Durable `acceptMctbInboundSmsIngress` + `mctb_process_inbound_sms` job → `handleMctbCustomerSmsReply` / AI Lead Recovery (`src/lib/mctb/messaging/inbound-sms-ingress.ts`, `process-inbound-sms-job.ts`, `customer-sms.ts`). |
| **Shared-E164 routing (partial)** | `resolveInboundWorkspaceRouting` + **outbound pairing** (14-day window) when multiple `PhoneNumber` rows share `e164` (`src/lib/messaging/inbound-workspace-routing.ts`). |
| **Call Handling** | Canonical voice ingress switch is separate from SMS; documented in `src/lib/call-handling/resolve-canonical-voice-ingress.ts`. |
| **Compliance classes** | `TWILIO_TOLL_FREE` vs `TELNYX_LOCAL_A2P` on `PhoneNumber.settingsJson` (`src/lib/messaging/compliance/phone-number-class.ts`). |
| **Product registration** | `MessagingProductRegistration` with `MCTB_CUSTOMER_CARE` vs mass texting (`prisma/schema.prisma`). |

### What is missing for platform sender launch

1. **No canonical “platform sender” config** — `resolvePlatformDemoSmsSender()` / `resolvePlatformDemoOwnerWorkspaceId()` are **retired (return null)** (`src/lib/mctb/onboarding/platform-demo.ts`). No env/doc reference to `+18885046264`.
2. **No explicit `senderMode` (PLATFORM vs WORKSPACE)** — documented as future work (`docs/MCTB-EXPLICIT-SMS-SENDER-MODE-LAUNCH-ITEM.md`).
3. **Twilio inbound is not MCTB-aware** — `/api/twilio/inbound` only calls `processInboundMessage`; **no** `acceptMctbInboundSmsIngress` path (unlike Telnyx `handleTelnyxInbound`).
4. **Shared-sender inbound gap** — If platform TFN has **one** `PhoneNumber` row, `resolveInboundWorkspaceFromPhoneCandidates` uses `single_phone_row` and **never runs outbound pairing** — replies would attribute to the wrong workspace unless fixed.
5. **Production default behavior** — `resolveMctbSmsSender` **prefers ingress `phoneNumberId`**, so when ingress is SMS-capable, outbound **From** equals ingress DID (coupled), not a separate platform sender.

### Can platform sender be added surgically?

**Yes**, mostly inside MCTB/messaging layers: extend sender resolution, add one platform-owned `PhoneNumber` + registration (or platform config table), wire Twilio inbound for MCTB shared sender, and fix inbound tenant resolution for shared `To`. **Do not** touch Voice V3 / LiveKit / GPT-Live.

### Highest-risk areas

1. **Inbound reply routing** with one shared `From` across many workspaces (collision + `single_phone_row` shortcut).
2. **STOP/HELP** — app suppression is **per-workspace** (`suppressionKey = workspaceId:p:phone`); carrier-level STOP on a shared TFN may affect **all** tenants on that sender.
3. **Twilio vs Telnyx parity** on inbound MCTB path (Telnyx has MCTB ingress; Twilio does not yet).
4. **`sendViaRegistration` send workspace** — platform sender likely uses **platform owner** `sendWorkspaceId` (pattern exists in `MctbOutboundSmsRoute` type) while message rows stay on customer `workspaceId`.

---

## B. Current End-to-End MCTB Call → SMS Path

### Voice ingress (PSTN → workspace)

| Step | Implementation |
|------|----------------|
| Customer CFNA → workspace toll-free ingress | Telnyx TeXML pipeline (`docs/MCTB_FINAL_PRODUCTION_PIPELINE.md` — frozen); routes via `routePhoneToMctbCallHandlingIngress` / `routePhoneToMctbTexmlIngress` (`src/lib/mctb/texml-ingress/provision.ts`). |
| Resolve workspace from `To` DID | `resolveMctbInboundTenant()` → `resolveMctbSipIngressByDid`, `resolveBestMctbIngressPhoneRow`, assignments (`src/lib/mctb/tenant/resolve-inbound.ts`, `src/lib/mctb/sip-ingress/resolver.ts`, `src/lib/mctb/texml-ingress/resolve-phone-row.ts`). |
| Press-1 / existing consent | TeXML + consent prompt services (`src/lib/mctb/consent-prompt/*`); mode from workspace `mctb.consentMode` (`src/lib/mctb/consent-mode.ts`). |
| Missed-call capture | `captureMctbMissedCall()` (`src/lib/mctb/capture/handle.ts`) → `processMissedInboundCall` / eligibility (`src/lib/agents/missed-call-text-back/process.ts`, `src/lib/mctb/capture/eligibility.ts`). |
| Schedule send | `scheduleMissedCallTextSend` / job handler → `executeMissedCallTextSend` (`src/lib/agents/missed-call-text-back/schedule.ts`, `src/lib/jobs/job-handlers.ts`). |

### SMS eligibility & content

| Step | Implementation |
|------|----------------|
| Eligibility recheck | `evaluateMissedCallTextEligibility` in send worker (`src/lib/agents/missed-call-text-back/eligibility.ts` — also `src/lib/mctb/capture/eligibility.ts` for capture-time). |
| Template | `resolveMctbMessageTemplate` + `renderMctbMessageTemplate` + `resolveMctbTemplateVars` (`src/lib/mctb/message-template`, `template-vars.ts`). |
| Trial / entitlement | `reserveTrialSmsSegments` (`src/lib/mctb/entitlement.ts`). |

### Sender resolution → provider → persistence

| Step | Implementation |
|------|----------------|
| Route | `resolveMctbOutboundSmsRoute({ workspaceId, config })` (`src/lib/mctb/messaging/outbound-sms-route.ts`). |
| Sender candidates | `resolveMctbSmsSender` → `phoneNumberId` then `smsPhoneNumberId`; loop `isPhoneAuthorizedForOutboundSms`. |
| Send | `sendQuickSms({ senderRoute: { sendWorkspaceId, fromE164, phoneNumberId } })` (`src/lib/sms/send-quick.ts`). |
| Provider API | `sendViaRegistration(sendWorkspaceId, …, fromOverride, { authorizedPhoneNumberId })` → `getMessagingProviderForRegistration(reg).sendMessage` (`src/lib/messaging/registration-processor.ts`). |
| Message row | `prisma.message` created in `sendQuickSms` with `workspaceId` = **customer** workspace. |
| Conversation | `ensureMctbRecoveryConversation` links outbound to `Conversation` with `productSource: MCTB` (`src/lib/mctb/messaging/recovery-conversation.ts`). |
| Missed call state | `MissedCallEvent.smsSentAt`, `smsMessageId`, status `SENT` (`send.ts`). |

**ASCII (current production-shaped path):**

```
Public business line (customer carrier)
  → CFNA → Workspace TF ingress DID (PhoneNumber per workspace)
  → resolveMctbInboundTenant → TeXML (press_1 | existing_consent)
  → MissedCallEvent
  → executeMissedCallTextSend
  → resolveMctbOutboundSmsRoute
       → usually From = same PhoneNumber as phoneNumberId (ingress) if SMS-authorized
  → sendViaRegistration (Telnyx or Twilio per PhoneNumber.provider + registration)
  → Message + Conversation (MCTB)
```

---

## C. Current Inbound Reply Path

### Telnyx (production MCTB path today)

| Step | File / function |
|------|-----------------|
| Webhook | `handleTelnyxInbound` (`src/lib/messaging/telnyx/webhook-handlers.ts`) |
| Workspace from `To` | `resolveInboundContext` → `resolveInboundWorkspaceRouting` (`inbound-process.ts`, `inbound-workspace-routing.ts`) |
| MCTB branch? | `isMctbCustomerReplyThread` OR `shouldSkipInboxAwayAutoReply` → `acceptMctbInboundSmsIngress` |
| Durable processing | Job `mctb_process_inbound_sms` → `processMctbInboundSmsJob` → `handleMctbCustomerSmsReply` |
| AI Lead Recovery | `handleMctbLeadRecoveryInboundSms` (`src/lib/mctb/lead-recovery/conversation-runtime.ts`) |
| Legacy handoff | `processMctbInboundReply` — **not** used for Telnyx customer SMS per file comment (`handoff/process-inbound-reply.ts`) |

**MCTB thread detection:** `isMctbCustomerReplyThread` = recent `MissedCallEvent` with `smsSentAt` for caller (`customer-sms.ts`).  
**Conversation binding:** `acceptMctbInboundSmsIngress` uses `resolveInboundConversation` + patches `productSource: MCTB`, `missedCallEventId` from latest SMS-sent event.

### Twilio inbound (gap)

`/api/twilio/inbound/route.ts` → `resolveInboundContext` → `processInboundMessage` only. **No** MCTB ingress acceptance, **no** Lead Recovery job enqueue.

### Shared-sender ambiguity

**Existing mitigations (only when multiple `PhoneNumber` rows share `e164`):**

- Outbound pairing: recent `Message` / `ConversationMessage` where `from = To_platform`, `to = From_caller` (`loadOutboundPairingWorkspaceIds`, 14-day window).
- Keyword match (mass texting).
- `ambiguous_duplicate_e164` if still unresolved.

**Critical gap:** With **exactly one** active `PhoneNumber` row for `+18885046264`, routing reason is `single_phone_row` → **all** inbound SMS to that number go to that row's `workspaceId` **without** pairing. Multi-tenant platform sender **requires** a new routing tier (e.g. always pair on platform E164, or resolve via open `Conversation` / `MissedCallEvent` before workspace routing).

**Collision scenario (same consumer, two businesses):**

- Workspace A and B both send recovery from platform `From`.
- Inbound `To` = platform number; pairing picks **most recent outbound** in 14-day window — may be wrong if consumer replies late or alternates businesses.
- Must define safe behavior: prefer **open MCTB conversation** with latest activity, fail closed to HELP, or explicit disambiguation — **not** silent wrong-tenant routing.

---

## D. Phone Number Data Model

### `PhoneNumber` (`prisma/schema.prisma`)

| Field | Role |
|-------|------|
| `workspaceId` | Owning workspace |
| `e164` | E.164 (unique per workspace) |
| `provider` | `telnyx` \| `twilio` (default telnyx) |
| `twilioSid`, `providerNumberId` | Provider IDs |
| `type`, `capabilitiesJson`, `settingsJson` | Capabilities + **MCTB metadata** |
| `messagingService` | Profile / service SID |
| `a2pStatus` | Compliance enum |

**Settings JSON conventions (evidence):**

- `mctbRole`: `customer_mctb` \| `platform_demo` \| `archived` (provisioning / routing)
- `mctbSipIngress`, `mctbNumberClass`: `TWILIO_TOLL_FREE` \| `TELNYX_LOCAL_A2P`
- `messagingCompliance`: TFV or A2P block
- `telephony.routingMode` / `routingOwner`: Call Handling / TeXML

### `MissedCallTextConfig`

| Field | Role |
|-------|------|
| `phoneNumberId` | Voice trigger / ingress DID (primary in `resolveMctbSmsSender`) |
| `smsPhoneNumberId` | Optional **different** outbound SMS DID |
| `messageTemplate*`, cooldown, quiet hours, etc. | Recovery content & rules |

### `Conversation`

- `productSource`: `MCTB` for inbox
- `phoneNumberId`, `fromE164`, `missedCallEventId` — thread context for inbound resolution

### `MessagingRegistration` (workspace-level legacy)

Single row per workspace — drives `sendViaRegistration` when workspace-level A2P ready.

### `MessagingProductRegistration`

Per `productUseCase` (`MCTB_CUSTOMER_CARE`, etc.) — parallel to legacy registration; audit mass-texting boundary in AGENTS.md.

### Does schema distinguish ingress vs outbound sender?

**Yes at config level** (`phoneNumberId` vs `smsPhoneNumberId`).  
**No explicit enum** for PLATFORM vs WORKSPACE mode.  
**Runtime often collapses** when only `phoneNumberId` is set and it is SMS-authorized (ingress = From).

**Smallest schema change (proposal):** Add `senderMode` + `platformSenderRef` (or env-backed platform ID) on `MissedCallTextConfig` **or** workspace `customFieldsConfig.mctb` — avoid redesigning `PhoneNumber`.

---

## E. Twilio Capability Inventory (reusable)

| Capability | Location |
|------------|----------|
| `MessagingProvider` adapter | `src/lib/messaging/twilio-provider.ts` → `twilio-adapter.ts` |
| Send SMS | `twilioAdapter.sendSmsViaMessagingService` (via `sendMessage`) |
| Inbound webhook | `src/app/api/twilio/inbound/route.ts` |
| Status callback | `src/app/api/twilio/message-status/route.ts` |
| TFV API | `src/app/api/twilio/toll-free-verification/route.ts`, `src/lib/messaging/twilio/toll-free-verification.ts` |
| Number search/purchase | `twilioAdapter.searchNumbers`, `purchaseNumber` |
| Signature validation | `twilio-client.ts`, `twilio-config.getWebhookUrls()` |
| Credentials (names only) | `TWILIO_ACCOUNT_SID`, `TWILIO_ACCOUNT_AUTH_TOKEN` / `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_*`, `TWILIO_PRIMARY_PROFILE_SID`, `APP_URL` |
| E.164 helpers | `twilio-mappings.ts` (shared across products) |
| Port-out | `src/lib/numbers/twilio-port-out-service.ts` |
| MCTB trial TF purchase | `src/lib/mctb/onboarding/trial-number.ts` (Twilio search + workspace-owned TF) |

**Do not** add a second Twilio client — extend `twilio-adapter` / `sendViaRegistration`.

---

## F. Telnyx Capability Inventory (reusable)

| Capability | Location |
|------------|----------|
| Provider | `src/lib/messaging/telnyx/provider.ts` |
| Inbound + status webhooks | `src/lib/messaging/telnyx/webhook-handlers.ts` |
| MCTB-specific inbound | `acceptMctbInboundSmsIngress`, `handleTelnyxInbound` branch |
| Number ops | `telnyx/phone-numbers.ts`, `number-reservation.ts` |
| MCTB ingress provision | `src/lib/mctb/provisioning/telnyx-sip-ingress.ts`, `provision-customer-local.ts` |
| TeXML voice | `src/lib/mctb/texml-ingress/*` |
| Delivery normalization | `applyParsedDeliveryStatus` + `appendMctbDeliveryTraceFromProviderStatus` |

---

## G. Provider Abstraction

**Exists:** `MessagingProvider` + per-registration `messagingProvider` field.  
**MCTB outbound** already selects provider via `PhoneNumber.provider` when using `authorizedPhoneNumberId` override in `sendViaRegistration`.

**Sufficient for Twilio → Telnyx platform sender swap?**  
**Mostly yes** if platform sender is modeled as a `PhoneNumber` row (provider + TFV settings) and `resolveMctbOutboundSmsRoute` returns that ID with correct `sendWorkspaceId`. Business logic stays in `resolveMctbOutboundSmsRoute` / new `resolveMctbSmsSenderMode`.

**Gap:** No single function named `resolveMctbSmsSender(workspaceId)` — today split across `resolveMctbSmsSender` + `resolveMctbOutboundSmsRoute` + authorization helper.

---

## H. Platform Sender Configuration (recommendation)

**Do not** insert `+18885046264` into every workspace.

**Recommended canonical homes (pick one in implementation):**

1. **Platform workspace + single `PhoneNumber` row** (owner workspace e.g. Transovo ops) with TFV APPROVED in `settingsJson` — referenced by env `MCTB_PLATFORM_SMS_PHONE_NUMBER_ID` or lookup by E.164 + role `platform_mctb_sender` in settings.
2. **System config table / `PlatformTelephonyResource`** (if exists elsewhere) — grep found none dedicated; would be new but small.
3. **Env-only** `MCTB_PLATFORM_SMS_E164` + `MCTB_PLATFORM_SMS_PROVIDER=twilio` for bootstrap — still persist provider IDs in DB for webhooks.

Align with retired `platform-demo.ts` pattern but **restore** with explicit **PLATFORM** semantics (not demo session routing).

---

## I. Workspace Sender Override

**Already supported mechanically:**

- Set `MissedCallTextConfig.smsPhoneNumberId` to workspace verified DID.
- `resolveMctbOutboundSmsRoute` tries `phoneNumberId` first, then authorized `smsPhoneNumberId` when different (`outbound-sms-route.ts`).

**Implementation should:**

- When `senderMode = WORKSPACE`, skip platform sender even if ingress unauthorized.
- When `senderMode = PLATFORM`, use platform sender **without** requiring ingress SMS authorization.
- **Never** change `phoneNumberId` ingress when switching sender mode.

---

## J. Inbound Shared-Sender Routing (detailed)

### Current order (`resolveInboundWorkspaceRouting`)

1. Find all active `PhoneNumber` rows matching `To`.
2. If one row → that workspace (`single_phone_row`).
3. If many → outbound pairing → keyword → mirror disambiguation → registration unique → else `ambiguous_duplicate_e164`.

### MCTB overlay (Telnyx only)

After workspace resolution, `targetWorkspaceId` may be overridden by platform demo session (`resolvePlatformDemoInboundWorkspace` — demo retired for production).

Then MCTB if reply thread or MCTB DID.

### Required platform-sender behavior (proposal)

For inbound `To ∈ PLATFORM_SENDER_E164S`:

1. **Do not** use `single_phone_row` alone.
2. Resolve tenant by **deterministic precedence** (suggested):
   - (a) Open `Conversation` where `productSource=MCTB`, `contact.phone=From`, `fromE164=platform`, ordered by `updatedAt`.
   - (b) Else latest `MissedCallEvent` with `smsSentAt` and outbound `Message.from=platform` to `From` within pairing window.
   - (c) Else if exactly one candidate workspace in pairing window → use it.
   - (d) Else **fail closed** — auto-reply HELP / “reply from the number you called” / no AI; log `ambiguous_platform_reply`.
3. Mirror logic on **Twilio** inbound (new branch).

### Collision: same caller, workspace A and B

Both received platform-sender texts → pairing by recency can mis-route. Mitigations: tie-break by **conversation id** on outbound message metadata, narrow pairing window, or block second concurrent open MCTB thread per `(caller, platformSender)` until one closes.

---

## K. Consent / STOP / HELP

| Topic | Current behavior |
|-------|------------------|
| Press-1 | TeXML + consent persistence; no SMS without consent path (`consent-prompt/*`, frozen pipeline doc). |
| Existing consent | `validateExistingConsentAttestation` in send (`send.ts`). |
| STOP (in-app) | `processInboundMessage` → `suppression` with key `${workspaceId}:p:${phone}` (`inbound-process.ts`). |
| HELP | Keyword lists from `getMessagingRuntimeSettings` / registration help text. |
| MCTB on Telnyx | Keyword auto-reply may be skipped for platform demo line; MCTB uses durable job for body messages. |

**Shared sender:** Carrier STOP on TFN may suppress at **provider** level for that From — affects **all** workspaces using that sender. Document honestly in UX/compliance; per-workspace STOP in DB does not override carrier block.

**Platform sender copy:** Templates must keep Transovo as legal sender where TFV requires; partner name as context (audit template-vars / compliance messages separately in implementation).

---

## L. Delivery Status

| Provider | Path |
|----------|------|
| Telnyx | `handleTelnyxMessageStatus` → `applyParsedDeliveryStatus` → MCTB `delivery-trace` |
| Twilio | `src/app/api/twilio/message-status/route.ts` → same delivery layer |

**Requirement for platform Twilio sender:** Configure status callback URL (`getWebhookUrls().messageStatus`) on send; map SIDs to `Message` / `ConversationMessage` same as Telnyx.

---

## M. Multi-Tenant Isolation

**Assumption “one E.164 → one workspace”** holds for **ingress DIDs** but **fails** for shared platform sender.

| Surface | Risk |
|---------|------|
| `resolveInboundWorkspaceRouting` | `single_phone_row` wrong tenant |
| `resolveInboundConversation` | `phoneNumberId` on conversation may point at ingress, not platform From |
| `isMctbCustomerReplyThread` | Workspace-scoped — OK **if** workspace already correct |
| Suppression / Contact status | Workspace-scoped — OK |
| AI Lead Recovery | Uses `workspaceId` from job payload — **poisoned if routing wrong** |
| Analytics / notifications | Filter by `workspaceId` — depend on correct routing |
| API auth | Standard workspace guards — assume routing is the weak link |

---

## N. Existing Workspace Migration

| Question | Answer |
|----------|--------|
| Current sender | Typically workspace `phoneNumberId` (ingress TF or local) when SMS-authorized; else `smsPhoneNumberId` if split (`docs/CALL-HANDLING-NUMBER-TOPOLOGY-AUDIT.md`). |
| Workspace-specific senders | Supported via `smsPhoneNumberId` + authorization order. |
| Ingress == sender | Common when single DID and `smsPhoneNumberId` unset. |
| Default mode for existing | Recommend `WORKSPACE` until opt-in to `PLATFORM` (or auto PLATFORM only for new free tier). |
| Backfill | Set `senderMode` default WORKSPACE; no change to sends until PLATFORM enabled. |
| Rollback | Flip mode / env disable platform sender; ingress untouched. |

---

## O. Failure / Rollback Plan

| Condition | Current / desired |
|-----------|-------------------|
| No platform config | `resolveMctbOutboundSmsRoute` returns null → `MESSAGING_NOT_APPROVED` suppression (`send.ts`) — **fail closed** |
| Missing Twilio creds | `sendViaRegistration` throws — event `FAILED` |
| Provider timeout | `PROVIDER_ERROR` on missed call event |
| Opt-out | Suppression / contact UNSUBSCRIBED — throw in `sendQuickSms` |
| Ambiguous inbound | Should **not** route to arbitrary tenant — return unmatched or safe HELP |
| Disable platform sender | Env flag + mode WORKSPACE — MCTB ingress and voice unchanged |

---

## P. Exact Proposed Changes (plan only)

### NEW FILES (illustrative)

| File | Responsibility | Why |
|------|----------------|-----|
| `src/lib/mctb/messaging/platform-sender-config.ts` | Resolve platform E.164, provider, phoneNumberId, owner workspace | Single canonical platform sender |
| `src/lib/mctb/messaging/resolve-mctb-sms-sender.ts` | Unified `PLATFORM` \| `WORKSPACE` resolver | Product semantics |
| `src/lib/mctb/messaging/inbound-platform-sender-routing.ts` | Tenant resolution for shared `To` | Fix single_phone_row gap |
| `src/lib/messaging/twilio/inbound-mctb.ts` (or extend route) | Twilio MCTB ingress parity | Platform sender on Twilio |

### MODIFIED FILES

| File | Current | Proposed | Risk |
|------|---------|----------|------|
| `src/lib/mctb/messaging/outbound-sms-route.ts` | Customer candidates only | Branch `senderMode === PLATFORM` → platform route | Medium — send path |
| `src/lib/agents/missed-call-text-back/sms-sender.ts` | Config phones only | Delegate to unified resolver | Low |
| `src/lib/messaging/inbound-workspace-routing.ts` | Generic pairing | Platform E.164 bypass / pre-hook | **High** — all inbound SMS |
| `src/lib/messaging/telnyx/webhook-handlers.ts` | Telnyx MCTB | Call platform routing before ctx | High |
| `src/app/api/twilio/inbound/route.ts` | Generic only | MCTB branch like Telnyx | High |
| `src/lib/mctb/messaging/recovery-conversation.ts` | `fromE164` on conversation | Store platform sender E.164 when used | Medium |
| `src/app/api/mctb/setup/route.ts` | No sender mode | Expose mode + readiness (read-only PLATFORM) | Low UI |
| `prisma/schema.prisma` | No senderMode | Optional `mctbSenderMode` on config | Low migration |

### DATABASE CHANGES

- Optional: `MissedCallTextConfig.mctbSenderMode` enum `PLATFORM` \| `WORKSPACE` (default `WORKSPACE`).
- Optional: `PhoneNumber.settingsJson.mctbRole = platform_mctb_sender` for `+18885046264` row on platform workspace.
- No change to Voice V3 tables.

### ENVIRONMENT / SECRETS (names only)

- Existing Twilio vars (see `twilio-config.ts`).
- New: `MCTB_PLATFORM_SMS_E164`, `MCTB_PLATFORM_SMS_PHONE_NUMBER_ID`, `MCTB_PLATFORM_SENDER_WORKSPACE_ID`, `MCTB_PLATFORM_SENDER_ENABLED`.

### WEBHOOK / CONSOLE CHANGES (future cert)

- Twilio: inbound + status URLs on platform TFN / messaging service.
- Telnyx: when second platform sender on Telnyx — same pattern.
- **Not in audit pass.**

### NO-CHANGE PROTECTED (Voice V3 / AI Receptionist)

See section Q.

### TESTS REQUIRED (per change)

- Extend `scripts/test-call-handling-ownership.ts` / new `test-mctb-platform-sender-routing.ts`
- Extend `scripts/test-inbound-sms-workspace-routing.ts` for single-row platform E.164
- MCTB cert scripts (lead recovery inbound) with mocked platform From
- Mass-texting boundary script unchanged

---

## Q. Voice V3 / AI Receptionist No-Change Confirmation

**Inspected (read-only) — no modifications proposed:**

- `src/lib/voice-v3/**` (delegation, intake, LiveKit bridge references in grep only)
- `src/lib/voice/python-runtime-bridge/**`
- `src/lib/voice/runtime-provider/livekit.ts`
- `src/lib/call-handling/*` — **ownership switch preserved**; only SMS route proof referenced
- `src/app/api/webhooks/twilio/voice/**` (voice, not SMS MCTB)
- Voice receptionist wizard / `src/lib/voice-receptionist-wizard/**`

**Platform sender work stays in:** `src/lib/mctb/messaging/*`, `src/lib/agents/missed-call-text-back/send.ts`, `src/lib/messaging/inbound-*`, Twilio/Telnyx SMS webhooks.

**If Voice V3 had to change:** Only acceptable case would be accidental shared constant — **none identified**. STOP if tempted to route voice ingress through platform sender.

---

## R. Implementation Phases

| Phase | Deliverable |
|-------|-------------|
| **1** | Canonical platform sender config + DB row for `+18885046264` (TFV metadata), feature flags |
| **2** | `senderMode` + unified `resolveMctbOutboundSmsRoute` PLATFORM branch |
| **3** | Twilio outbound via existing `sendViaRegistration` + `TWILIO_TOLL_FREE` authorization |
| **4** | Inbound shared-sender routing (Telnyx + Twilio) + MCTB ingress parity on Twilio |
| **5** | Delivery callbacks + MCTB delivery trace for Twilio platform sends |
| **6** | STOP/HELP behavior review + copy compliance for platform sender |
| **7** | Workspace override UX + migration defaults (`WORKSPACE`) |
| **8** | Automated tests (matrix below) + controlled PSTN/SMS certification |

---

## Required Test Matrix (design before code)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Workspace A miss → A ingress → consent → PLATFORM send | Template A context; From = platform |
| 2 | Workspace B same platform From | Template B; no A data in message |
| 3 | No consent | No SMS |
| 4 | Existing consent path | Unchanged suppression rules |
| 5 | Reply to platform From | Correct workspace conversation |
| 6 | Lead Recovery | Same workspace policy engine |
| 7 | STOP | Document carrier + workspace suppression |
| 8 | HELP | Approved help text |
| 9 | Workspace C with own `smsPhoneNumberId` | From = C sender; ingress unchanged |
| 10 | Provider swap Twilio→Telnyx (unit) | Same resolver interface |
| 11 | Same caller A + B active | Documented safe behavior / no silent wrong tenant |
| 12 | Missing platform config / provider fail | Fail closed, no wrong From |
| 13 | Cross-workspace conversation lookup attack | Must fail authorization |

---

## Production Certification Plan (future — not executed in audit)

1. Real PSTN → business line → CFNA → workspace ingress → press-1 → consent row.
2. Outbound SMS from `+18885046264` to handset.
3. Handset reply → correct `/mctb/conversations` thread + Lead Recovery.
4. STOP + HELP on handset.
5. Delivery events in UI/admin diagnostics.
6. Second workspace on same platform sender without cross-leak (paired test).

---

## Final Questions (direct answers)

1. **What exact number currently sends MCTB SMS in production?**  
   Per-workspace: the first **SMS-authorized** among `MissedCallTextConfig.phoneNumberId` then `smsPhoneNumberId` (`resolveMctbOutboundSmsRoute`). Often the **workspace ingress toll-free or local DID**, not a shared platform number. `+18885046264` is **not** in repository code.

2. **Where is that sender selected?**  
   `resolveMctbSmsSender` → `resolveMctbOutboundSmsRoute` → `sendQuickSms` (`send.ts`).

3. **Is sender selection coupled to forwarding DID?**  
   **Often yes** — `phoneNumberId` is ingress and is tried first for SMS. Split only when `smsPhoneNumberId` differs and is authorized (`smsPhoneNumberId` field + docs).

4. **What change lets +18885046264 become shared platform sender?**  
   Platform `PhoneNumber` + TFV approved row, `senderMode=PLATFORM`, extend `resolveMctbOutboundSmsRoute` to use it with `sendWorkspaceId` = platform owner; **not** per-workspace provisioning of that E.164.

5. **What Twilio SMS code exists?**  
   `twilio-provider.ts`, `twilio-adapter.ts`, `sendViaRegistration`, inbound/status routes (section E).

6. **What Twilio webhook infrastructure exists?**  
   `/api/twilio/inbound`, `/api/twilio/message-status`, `/api/twilio/compliance-status`, `/api/twilio/toll-free-verification`, voice webhooks under `/api/webhooks/twilio/voice/*`.

7. **What additional Twilio configuration is required?**  
   TFN wired to inbound + status URLs; messaging service or From-number send; credentials in env; platform row in DB.

8. **How does inbound to +18885046264 resolve workspace today?**  
   **Not implemented** — would hit `resolveInboundWorkspaceRouting`; single `PhoneNumber` row → wrong `single_phone_row` without new logic. Twilio path would not enter MCTB Lead Recovery.

9. **Same consumer, two workspaces, shared platform From?**  
   Pairing may pick **most recent outbound**; risk of mis-route — needs conversation-first resolver and explicit collision policy (section J).

10. **STOP/HELP with shared sender?**  
    App: per-workspace suppression. Carrier: likely **sender-wide** for TFN — document limitation.

11. **Can a workspace use its own verified sender?**  
    **Yes** — `smsPhoneNumberId` + existing authorization path.

12. **Sender priority?**  
    Proposed: `senderMode` → PLATFORM uses platform ID; WORKSPACE uses current candidate loop (ingress then sms id).

13. **Twilio → Telnyx platform swap without business logic change?**  
    **Yes**, if platform sender remains a `PhoneNumber` + provider adapter selection.

14. **Voice V3 modification required?**  
    **No** for platform SMS sender.

15. **Database migration?**  
    Optional `mctbSenderMode` (+ index); platform `PhoneNumber` seed — no change to VoiceCall tables.

16. **Environment changes?**  
    Platform sender IDs/E.164/feature flag; existing Twilio secrets.

17. **Provider console changes?**  
    Webhooks on TFN; TFV already approved for stated number (outside repo).

18. **Automated tests before merge?**  
    Inbound routing unit tests, outbound route tests, regression `test-mass-texting-boundary.ts`, MCTB lead recovery cert scripts.

19. **Live tests after deploy?**  
    Certification plan above (handset PSTN + SMS).

20. **Smallest safe implementation patch?**  
    Phase 1–4: config + outbound PLATFORM branch + inbound platform routing + Twilio MCTB inbound — **without** altering TeXML, consent, or Voice V3.

---

## STOP CONDITION

This audit is **complete**.  
**No code, production, Twilio/Telnyx console, or number purchases were performed.**

**Deliverables:**

1. This report (`docs/MCTB-PLATFORM-SENDER-PRE-IMPLEMENTATION-AUDIT.md`)
2. Proposed implementation map (section P, R)
3. Risk focus: inbound shared-sender + STOP scope + Twilio MCTB parity
4. Voice V3 confirmed out of scope (section Q)

Review before authorizing implementation.
