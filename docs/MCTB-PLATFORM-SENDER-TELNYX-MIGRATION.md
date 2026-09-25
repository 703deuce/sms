# MCTB Platform Sender — Telnyx Primary, Twilio Preserved

**Status:** Engineering complete — **handset live cert pending**  
**Canonical Telnyx platform SMS sender:** `+1 866 602 0680` (`+18666020680`)  
**Preserved Twilio platform sender:** `+1 888 504 6264` (`+18885046264`)  
**Last updated:** 2026-09-25 (UTC)

---

## Three number identities (do not collapse)

MCTB uses **three distinct identities** with **different scope**:

| # | Identity | Scope | Resolved by | Purpose |
|---|----------|--------|-------------|---------|
| **1** | **Customer business DID** | **Per customer / workspace** | Setup / forwarding config (customer’s public number) | CFNA forwards *from* this when the business does not answer |
| **2** | **Transovo MCTB voice-ingress DID** | **Per workspace** (Transovo/provider-owned) | `MissedCallTextConfig.phoneNumberId` → TeXML ingress | Unique forwarding destination per workspace; identifies which workspace owns the call |
| **3** | **Transovo PLATFORM SMS sender DID** | **Global / shared** Transovo infrastructure | `resolveCanonicalMctbPlatformSender()` + `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | `From` on PLATFORM recovery texts; inbound replies to that `To` when `senderMode === PLATFORM` |

**Tenancy model (future workspaces):**

```
Business A → CFNA → Workspace A ingress DID_A → ws_A → recovery → GLOBAL platform sender (PLATFORM mode)
Business B → CFNA → Workspace B ingress DID_B → ws_B → recovery → same GLOBAL platform sender
```

Onboarding must **not** assign `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` as every workspace’s `MissedCallTextConfig.phoneNumberId`.

**Call flow (conceptual):**

```
Business DID → CFNA → voice-ingress DID → IVR/Press-1 → recovery runtime
                                                      → platform SMS sender DID → customer handset
```

**(2) and (3) do not have to be the same E.164.** This migration changes **only (3)** (provider/number boundary for PLATFORM SMS). It does **not** change TeXML/CFNA, `phoneNumberId` for ingress, or per-workspace business numbers.

**ws_1 dual-role exception (cert only):** Today `+18666020680` may wear **two roles** on one `PhoneNumber` row: ws_1 voice-ingress DID **and** global PLATFORM SMS sender (`customer_mctb` + `platformMctbSender: true`). That is acceptable for the current certification workspace. It does **not** mean every workspace’s ingress DID equals the global platform sender DID.

Audit (read-only): `WORKSPACE_ID=ws_1 npx tsx scripts/audit-mctb-three-number-identities.ts`

---

## 1. Executive verdict

**MCTB TELNYX PRIMARY PLATFORM SENDER READY — TWILIO PRESERVED** at the code and configuration layer.

- Primary PLATFORM SMS route resolves to **Telnyx** `+18666020680` (verified toll-free on Telnyx portal).
- Twilio `+18885046264` remains in the database with TFV metadata and parent-send adapter; it is **not** deleted and can be re-selected via configuration.
- No schema migration. No MCTB IA / sender-authority / Pass 1C / consent / TeXML changes.
- **Operator:** set Coolify `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmtoszkn26t6z485u3d2w3c51`, redeploy web + SMS worker, then run handset cert.

---

## 2. Previous architecture

```
senderMode = PLATFORM
  → resolveCanonicalMctbPlatformSender()
  → PhoneNumber +18885046264 (Twilio, platform_mctb_sender)
  → trySendMctbPlatformParentTwilio() (parent credentials)
  → Twilio status callback
```

Inbound: Twilio `/api/twilio/inbound` and Telnyx `/api/telnyx/messaging` both branch to `handleMctbPlatformSenderInboundCore` when `To` matches canonical platform E.164.

---

## 3. Existing Twilio path (preserved)

| Field | Value |
|-------|--------|
| E.164 | `+18885046264` |
| PhoneNumber ID | `cmufvsanf1g0v060m13730z0q` |
| Provider | `twilio` |
| Config source | `PhoneNumber` row on platform owner workspace (`MCTB_PLATFORM_OWNER_WORKSPACE_ID`) |
| TFV | `settingsJson.messagingCompliance` → `TOLL_FREE_VERIFICATION` / `APPROVED` |
| Outbound | `sendViaRegistration` → `trySendMctbPlatformParentTwilio` when canonical provider is `twilio` |
| Inbound | `/api/twilio/inbound` → platform core |
| Status | `/api/twilio/message-status` |
| STOP/HELP | `handlePlatformSenderComplianceInbound` (Transovo runtime, not Twilio-native opt-out alone) |

After demotion: `platformMctbSenderPreservedTwilio: true`, `mctbRole: customer_production` — **not** canonical until re-adopted.

---

## 4. Existing Telnyx infrastructure (reused)

| Piece | Detail |
|-------|--------|
| Inbound webhook | `POST {APP_URL}/api/telnyx/messaging` (`handleTelnyxInbound`) |
| Status events | Same route — `message.sent`, `message.delivered`, `message.delivery_failed`, etc. |
| Platform branch | `isActiveMctbPlatformSenderE164(to)` → `handleMctbPlatformSenderInboundCore({ channel: "telnyx" })` |
| Outbound adapter | `sendViaRegistration` Telnyx path when parent Twilio gate returns null |
| Messaging profile (866) | `40019fd9-524a-445a-b765-d37641e1f108` (webhook already points at `/api/telnyx/messaging`) |

No second MCTB-specific Telnyx stack was added.

---

## 5. Canonical platform sender source

**Resolver:** `src/lib/mctb/messaging/platform-sender-config.ts` → `resolveCanonicalMctbPlatformSender()`

1. `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` (preferred), Active row, `isPlatformMctbSenderPhoneRecord`
2. Else exactly one Active row with platform sender marker

**Platform sender marker:** `mctbRole === platform_mctb_sender` **or** `settingsJson.platformMctbSender === true` (dual voice ingress on same DID).

---

## 6. Provider-selection mechanism

Provider is **not** a separate global flag in code. It is read from the canonical `PhoneNumber.provider`:

- `twilio` → Model B parent Twilio send (unchanged)
- `telnyx` → workspace registration send with `authorizedPhoneNumberId` override (unchanged)

Switch primary by **which PhoneNumber row is canonical** (`MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID`), not by rewriting adapters.

Optional ops env for setup scripts only: `MCTB_PLATFORM_SENDER_PROVIDER=twilio|telnyx`.

---

## 7. New Telnyx platform sender

| Field | Value |
|-------|--------|
| E.164 | `+18666020680` |
| PhoneNumber ID | `cmtoszkn26t6z485u3d2w3c51` |
| Telnyx resource ID | `3020837399669245525` |
| Messaging profile | `40019fd9-524a-445a-b765-d37641e1f108` |
| Verification | Telnyx portal — **Toll Free Verification: Verified** (assigned number `+18666020680`) |
| Voice ingress | **Unchanged** — same DID keeps `customer_mctb` + `platformMctbSender: true` (dual marker) for `ws_1` TeXML ingress |

**Note:** Voice CFNA target and PLATFORM SMS From can share one DID; `platformMctbSender: true` does not remove `customer_mctb` ingress role.

---

## 8. Twilio preservation

- `platform-parent-twilio-send.ts` unchanged
- Twilio webhooks unchanged
- Twilio row retained with TFV-approved `settingsJson`
- `demoteTwilioPlatformMctbSenderToPreserved()` — demotes canonical role only

---

## 9. Outbound flow (Telnyx primary)

```
executeMissedCallTextSend / sendQuickSms
  → resolveMctbOutboundSmsRoute (PLATFORM)
  → resolveCanonicalMctbPlatformSender (Telnyx 866)
  → isPhoneAuthorizedForOutboundSms (A2P_10DLC APPROVED on row)
  → platform assignment gate (unchanged)
  → sendViaRegistration(sendWorkspaceId=ws_1, authorizedPhoneNumberId=866 row)
  → trySendMctbPlatformParentTwilio → null (provider telnyx)
  → Telnyx adapter send from 866 + messaging profile
```

Structured log: `platform_outbound_route_resolved` with `provider`, `fromE164`, `phoneNumberId`.

---

## 10. Inbound flow

```
Customer SMS → Telnyx → /api/telnyx/messaging
  → isActiveMctbPlatformSenderE164(+18666020680)
  → handleMctbPlatformSenderInboundCore (telnyx)
  → STOP/HELP / tenant resolution / acceptMctbInboundSmsIngress
```

Twilio inbound to `+18885046264` still works for historical threads if Twilio receives traffic.

---

## 11. Delivery / status flow

Telnyx status webhooks → `applyParsedDeliveryStatus` → same `Message` / conversation model as workspace sends. Provider message IDs are opaque strings (not Twilio `SM…` assumed).

---

## 12. STOP / HELP

Handled in Transovo: `handlePlatformSenderComplianceInbound` — keyword match, workspace opt-out, `recordPlatformMctbSenderOptOut`, assignment release. **Not** relying on Telnyx auto-replies alone for platform sender semantics.

---

## 13. Conversation correlation

Unchanged: `(consumerE164 + platformPhoneNumberId)` assignment + reply context window; not `To` alone.

---

## 14. Consent / opt-out preservation

Provider change does **not** reset consent, Press-1, or suppression. Opt-out keys remain workspace/consumer scoped.

---

## 15. Sender-authority preservation

Pass 1B PLATFORM vs WORKSPACE unchanged. `assertMctbInboxOutboundAllowed` unchanged.

---

## 16. Pass 1C controlled-response preservation

AI templates resolved before `sendViaRegistration`; Telnyx only transports approved body.

---

## 17. Human takeover / stale AI send

`validateMctbAutonomousAiOutboundBeforeSend` and takeover watermark unchanged; provider-agnostic.

---

## 18. Analytics preservation

`smsSentAt`, `BOOKING_LINK_SENT`, recovery KPIs use provider-neutral persistence — Telnyx sends must populate the same fields (verify on handset cert).

---

## 19. Configuration / secrets (names only)

| Variable | Purpose |
|----------|---------|
| `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID` | Canonical row (`cmtoszkn26t6z485u3d2w3c51` for Telnyx primary) |
| `MCTB_PLATFORM_OWNER_WORKSPACE_ID` | Platform owner (`ws_1`) |
| `MCTB_PLATFORM_SENDER_E164` | Setup/switch scripts |
| `MCTB_PLATFORM_SENDER_PROVIDER` | `twilio` \| `telnyx` for setup script only |
| `MCTB_PLATFORM_TELNYX_SENDER_E164` | Switch script default `+18666020680` |
| `MCTB_PLATFORM_TWILIO_PRESERVED_E164` | Switch script default `+18885046264` |
| `TELNYX_API_KEY` | Telnyx API |
| `TWILIO_ACCOUNT_SID` / parent token envs | Twilio preserved path |

---

## 20. How to switch back to Twilio

1. `MCTB_PLATFORM_SENDER_PROVIDER=twilio MCTB_PLATFORM_SENDER_E164=+18885046264 npx tsx scripts/setup-mctb-platform-sender.ts` (re-apply `platform_mctb_sender` on Twilio row).
2. Clear `platformMctbSender` on Telnyx 866 row (or run a future `demote-telnyx` helper).
3. Set `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmufvsanf1g0v060m13730z0q`.
4. Redeploy.

No code archaeology required.

---

## 21. Future multi-number compatibility

Consumers use `resolveCanonicalMctbPlatformSender()` only. No hard-coded E.164 in send path. Pooling / allocation is a separate project.

---

## 22. Files changed

- `src/lib/messaging/compliance/phone-number-class.ts`
- `src/lib/mctb/messaging/platform-sender-adopt.ts`
- `src/lib/mctb/messaging/outbound-sms-route.ts`
- `scripts/setup-mctb-platform-sender.ts`
- `scripts/switch-mctb-platform-sender-to-telnyx.ts` (new)
- `scripts/verify-mctb-platform-production-readiness.ts`
- `scripts/test-mctb-platform-sender-telnyx-primary.ts` (new)
- `scripts/test-mctb-platform-sender.ts`
- `scripts/test-mctb-platform-parent-twilio-gate.ts`

---

## 23. Runtime files touched

Same as §22 (no new API routes).

---

## 24. Schema changes

**None.**

---

## 25. Tests / results

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-platform-sender-telnyx-primary.ts
npx tsx scripts/test-mctb-platform-sender.ts
npx tsx scripts/test-mctb-platform-parent-twilio-gate.ts
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmtoszkn26t6z485u3d2w3c51 \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/verify-mctb-platform-production-readiness.ts
```

Switch script (DB): `scripts/switch-mctb-platform-sender-to-telnyx.ts` — demoted Twilio, adopted Telnyx, `readinessGreen` prerequisites met in agent DB run.

---

## 26. Production deployment requirements

1. Merge + deploy web (`transovo-web`) and SMS worker if outbound path changed in worker image.
2. Coolify env: `MCTB_PLATFORM_SENDER_PHONE_NUMBER_ID=cmtoszkn26t6z485u3d2w3c51` (and `MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1`).
3. Run switch script on production DB if not already applied:  
   `MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 npx tsx scripts/switch-mctb-platform-sender-to-telnyx.ts`
4. Confirm Telnyx messaging profile webhook URL (already `/api/telnyx/messaging`).
5. **Do not** change identity (2) voice ingress: switch script does **not** mutate `MissedCallTextConfig.phoneNumberId` or TeXML routes.

### §48 — No telephony migration (identity 3 only)

PLATFORM SMS sender provider switch only. Business DIDs remain workspace-specific; Transovo ingress and platform sender are infrastructure resolved on separate config paths (see **Three number identities** above).

---

## 27. Owner live-certification checklist

1. Workspace with `senderMode=PLATFORM` (e.g. cert workspace).
2. Missed call → press-1 (if `press_1`) → recovery SMS **From `+18666020680`**.
3. Reply on handset → correct tenant inbox / assignment.
4. HELP → Transovo help copy.
5. STOP last → suppression + no further PLATFORM sends from 866.
6. `Message.from` and `MissedCallEvent.metadata.outboundSmsFromE164` = `+18666020680`.
7. Analytics: `smsSentAt` set; booking link event if entitled.
8. WORKSPACE sender workspace: unchanged regression send.

---

## 28. Remaining blockers

- Coolify env pointer must match new phone ID on production servers.
- Handset PSTN/SMS cert not run in cloud agent VM.
- Twilio `+18885046264` remains available but **not** primary; historical Twilio threads may still receive Twilio status callbacks only if traffic hits Twilio.

---

## Switch script reference

```bash
MCTB_PLATFORM_OWNER_WORKSPACE_ID=ws_1 \
  NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
  npx tsx scripts/switch-mctb-platform-sender-to-telnyx.ts
```

Dry run: `DRY_RUN=1`.
