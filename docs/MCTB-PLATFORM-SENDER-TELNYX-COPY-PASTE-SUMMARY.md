# MCTB Platform Sender — Telnyx Primary (copy-paste summary)

**Date:** 2026-09-25  
**Status:** Engineering complete — handset live cert pending  
**PR:** https://github.com/703deuce/sms/pull/529  
**Full runbook:** `docs/MCTB-PLATFORM-SENDER-TELNYX-MIGRATION.md`

**Finish line (when deployed + cert):**  
`MCTB TELNYX PRIMARY PLATFORM SENDER READY — TWILIO PRESERVED`

---

## Mode

**CONTROLLED PROVIDER MIGRATION** — change **identity (3)** only (PLATFORM SMS sender provider/number).  
**Not** “replace Twilio with Telnyx” in the stack. **Not** automatic per-message failover.

**PRIMARY = TELNYX** (`+18666020680`, verified on Telnyx Toll Free Verification)  
**TWILIO = PRESERVED / AVAILABLE** (`+18885046264`, re-selectable via config)

This task does **not** reopen: MCTB IA, sender-authority (1B/1C), PLATFORM vs WORKSPACE, consent, TeXML/CFNA, AI Recovery, Inbox, Setup, eligibility, analytics.

---

## Three number identities (do not collapse)

| # | Identity | Scope | Resolved by | Purpose |
|---|----------|--------|-------------|---------|
| **1** | **Customer business DID** | **Per customer / workspace** | Setup / forwarding (customer’s public number) | CFNA forwards *from* this when the business does not answer |
| **2** | **Transovo MCTB voice-ingress DID** | **Per workspace** (Transovo/provider-owned) | `MissedCallTextConfig.phoneNumberId` → TeXML ingress | Unique CFNA destination per workspace; routes call to correct tenant |
| **3** | **Transovo PLATFORM SMS sender DID** | **Global / shared** | `resolveCanonicalMctbPlatformSender()` + `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | `From` on PLATFORM recovery texts; inbound replies to that `To` |

Provisioning must **not** set every workspace’s ingress to the canonical platform sender. See `docs/MCTB-NUMBER-IDENTITY-VERIFICATION-REPORT.md`.

**Call flow (conceptual):**

```
Business DID
  → no-answer forwarding
  → Transovo voice-ingress DID
  → IVR / Press-1 / consent
  → recovery runtime
  → Transovo platform SMS sender DID
  → customer receives text
```

**(2) and (3) do not have to be the same E.164.**  
This migration changes **only (3)**. It does **not** change TeXML/CFNA, `phoneNumberId` for ingress, or per-workspace business numbers.

**ws_1 certification note:** Today `+18666020680` is both voice ingress and the verified Telnyx platform SMS sender (same `PhoneNumber` row: `customer_mctb` + `platformMctbSender: true`). That is an **operational choice for cert**, not a product rule. Other workspaces can use different ingress DIDs while sharing one canonical platform sender.

**Voice (Amy) analogy:** Business number → conditional/after-hours forwarding → Transovo Voice DID → LiveKit SIP → Amy. Same pattern: intermediary Transovo DID; business number is not ported.

---

## Forensics — existing platform-sender path (read before editing)

**Outbound**

```
MCTB outbound action
  → sender-authority / senderMode
  → resolveMctbOutboundSmsRoute() [PLATFORM]
  → resolveCanonicalMctbPlatformSender()
  → isPhoneAuthorizedForOutboundSms()
  → platform assignment gate (unchanged)
  → sendQuickSms → sendViaRegistration(..., authorizedPhoneNumberId)
  → if canonical.provider === "twilio" → trySendMctbPlatformParentTwilio()
  → else → Telnyx (or workspace) adapter via registration
  → delivery callback → provider-neutral Message state
```

**Inbound**

```
Customer SMS
  → Twilio /api/twilio/inbound OR Telnyx /api/telnyx/messaging
  → isActiveMctbPlatformSenderE164(To)
  → handleMctbPlatformSenderInboundCore (twilio | telnyx)
  → STOP/HELP → handlePlatformSenderComplianceInbound (Transovo runtime)
  → tenant resolution + assignment
  → acceptMctbInboundSmsIngress → AI Recovery / Inbox
```

**Canonical resolver (do not duplicate):**

- `resolveCanonicalMctbPlatformSender()` — `src/lib/mctb/messaging/platform-sender-config.ts`
- `resolveMctbSmsSender()` — workspace-owned senders only (WORKSPACE mode)
- `resolveMctbOutboundSmsRoute()` — `src/lib/mctb/messaging/outbound-sms-route.ts`

**Provider selection:** `PhoneNumber.provider` on the canonical row (`twilio` | `telnyx`). Switch primary by **which row is canonical** (`MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`), not by rewriting adapters.

**PLATFORM ≠ TELNYX.** PLATFORM = Transovo-controlled sender; provider is implementation detail.

---

## Numbers (authoritative)

### Preserved Twilio platform sender (not primary)

| Field | Value |
|-------|--------|
| E.164 | `+18885046264` |
| PhoneNumber ID | `cmufvsanf1g0v060m13730z0q` |
| Provider | `twilio` |
| Config | Platform owner workspace + `settingsJson` TFV APPROVED |
| Outbound (when primary again) | `trySendMctbPlatformParentTwilio()` / parent Twilio credentials |
| Inbound | `/api/twilio/inbound` → platform core |
| Status | `/api/twilio/message-status` |
| After demotion | `platformMctbSenderPreservedTwilio: true` — not canonical until re-adopted |

### New Telnyx primary platform SMS sender

| Field | Value |
|-------|--------|
| E.164 | `+18666020680` |
| PhoneNumber ID | `cmtoszkn26t6z485u3d2w3c51` |
| Telnyx resource ID | `3020837399669245525` |
| Messaging profile | `40019fd9-524a-445a-b765-d37641e1f108` |
| Verification | Telnyx portal — Toll Free Verification **Verified** (assigned `+18666020680`) |
| Inbound/outbound webhooks | `POST {APP_URL}/api/telnyx/messaging` (shared Telnyx messaging handler) |

---

## What was implemented (minimal diff)

| Area | Change |
|------|--------|
| Telnyx adoption | `adoptMctbPlatformSenderFromTelnyxAccount()` |
| Twilio demotion (preserve) | `demoteTwilioPlatformMctbSenderToPreserved()` |
| Dual role on same DID | `platformMctbSender: true` + keep `customer_mctb` when TeXML ingress present |
| Platform marker | `isPlatformMctbSenderPhoneRecord` accepts `platformMctbSender: true` or `mctbRole: platform_mctb_sender` |
| Switch script | `scripts/switch-mctb-platform-sender-to-telnyx.ts` — **does not** update `MissedCallTextConfig.phoneNumberId` |
| Setup script | `MCTB_PLATFORM_SENDER_PROVIDER=twilio\|telnyx` on `scripts/setup-mctb-platform-sender.ts` |
| Observability | `platform_outbound_route_resolved` log with provider + from |
| Audit | `scripts/audit-mctb-three-number-identities.ts` |
| Tests | `scripts/test-mctb-platform-sender-telnyx-primary.ts` (+ existing platform sender / Twilio gate tests) |
| Schema | **None** |

**Not done:** automatic Telnyx→Twilio failover; multi-number pool; UI “Telnyx” branding (still “Transovo-managed messaging”).

---

## Production / Coolify (after merge)

1. Merge PR #529, deploy **transovo-web** + **SMS worker** (if applicable).
2. Set environment:
   - `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmtoszkn26t6z485u3d2w3c51`
   - `MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1`
3. On production DB (if not already applied):
   ```bash
   MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
     npx tsx scripts/switch-mctb-platform-sender-to-telnyx.ts
   ```
4. Verify readiness:
   ```bash
   MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
   MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmtoszkn26t6z485u3d2w3c51 \
     NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
     npx tsx scripts/verify-mctb-platform-production-readiness.ts
   ```
5. Handset cert: PLATFORM send **From +18666020680**, reply routing, HELP, STOP last, `smsSentAt`, WORKSPACE sender regression.

---

## Switch back to Twilio (one config path, no code archaeology)

1. `MCTB_PLATFORM_SENDER_PROVIDER=twilio MCTB_PLATFORM_SENDER_E164=+18885046264 npx tsx scripts/setup-mctb-platform-sender.ts`
2. Clear Telnyx `platformMctbSender` on `+18666020680` if you want that DID SMS-only for ingress (optional).
3. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q`
4. Redeploy.

---

## Configuration / secrets (names only)

- `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`
- `MCTB_PLATFORM_OWNER_WORKSPACE_ID`
- `MCTB_PLATFORM_SENDER_E164`
- `MCTB_PLATFORM_SENDER_PROVIDER` (setup script: `twilio` | `telnyx`)
- `MCTB_PLATFORM_TELNYX_SENDER_E164` (switch script, default `+18666020680`)
- `MCTB_PLATFORM_TWILIO_PRESERVED_E164` (switch script, default `+18885046264`)
- `TELNYX_API_KEY`
- Twilio parent account envs (`TWILIO_ACCOUNT_SID`, etc.) — preserved for Twilio path

---

## Tests (run locally)

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-sender-telnyx-primary.ts
npx tsx scripts/test-mctb-platform-sender.ts
npx tsx scripts/test-mctb-platform-parent-twilio-gate.ts
WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/audit-mctb-three-number-identities.ts
```

---

## Invariants preserved

- Pass 1C / AI templates **above** provider layer  
- `assertMctbInboxOutboundAllowed` / PLATFORM restrictions  
- Press-1, existing consent, opt-out, STOP/HELP, suppression, eligibility  
- `validateMctbAutonomousAiOutboundBeforeSend` / human takeover  
- Analytics: `smsSentAt`, `BOOKING_LINK_SENT`, suppression ≠ failed  
- WORKSPACE sender mode unchanged  
- Twilio webhooks and parent-send adapter remain  

---

## Remaining blockers

- Coolify env pointer on all app instances  
- Owner handset PSTN/SMS certification  
- Historical threads on `+18885046264` only get Twilio callbacks if traffic still hits Twilio  

---

## Git

- **Branch:** `cursor/mctb-platform-sender-telnyx-primary-2304`  
- **PR:** https://github.com/703deuce/sms/pull/529  
