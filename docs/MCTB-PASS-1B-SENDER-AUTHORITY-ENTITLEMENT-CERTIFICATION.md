# MCTB Pass 1B — Sender Authority, Entitlements & Inbox Safety

## 1. Executive verdict

**MCTB PASS 1B BLOCKED — SENDER AUTHORITY REMEDIATION DECISION REQUIRED**

Pass 1 shell/handoff work is preserved. **Inbox UI gating, centralized capability resolver, server-side inbox send rejection for platform sender, booking-link gating, Saved Replies gating, free-tier existing-consent API enforcement, and manual-send → takeover (customer A2P path)** are implemented and covered by `scripts/test-mctb-pass-1b-sender-authority.ts`.

**Blocker:** MCTB AI Lead Recovery still generates and sends **arbitrary model-authored SMS** on the Transovo platform sender (`handleMctbCustomerSmsReply` → `leadRecovery.reply` → `sendMctbCustomerOutboundSms` / `resolveMctbOutboundSmsRoute` with `senderMode: PLATFORM`). UI gating does not fix this runtime policy gap. Smallest safe remediation requires a product/engineering decision (approved-response catalog vs constrained runtime) — **not attempted in Pass 1B** to avoid certified pipeline changes without sign-off.

---

## 2. Sender authority source of truth

| Signal | Source |
|--------|--------|
| Sender mode | `missedCallTextConfig.senderMode` — `PLATFORM` \| `WORKSPACE` (`src/lib/agents/missed-call-text-back/config.ts`, `types.ts`) |
| Platform sender identity | `resolveCanonicalMctbPlatformSender()` (`src/lib/mctb/messaging/platform-sender-config.ts`) |
| Workspace-owned sender | `resolveMctbSmsSender()` + `isPhoneAuthorizedForOutboundSms()` (`sms-sender.ts`, `outbound-sms-route.ts`) |
| Outbound route | `resolveMctbOutboundSmsRoute()` — sets `senderMode`, `phoneNumberId`, compliance regime |

**Not inferred from** displayed From number in Inbox alone.

---

## 3. Platform sender detection

`config.senderMode === "PLATFORM"` → capabilities use `platform_responses_only` when `isPhoneAuthorizedForOutboundSms(platform.phoneNumberId)` is true.

---

## 4. Customer-owned A2P detection

`config.senderMode === "WORKSPACE"` **and** `isMctbSetupMessagingReady()` (approved phone + no blocking compliance actions) **and** per-number `isPhoneAuthorizedForOutboundSms`.

---

## 5. Sender readiness detection

- **Platform:** canonical platform phone authorized for outbound (TFV/A2P per number class).
- **Workspace:** `isMctbSetupMessagingReady` + authorized workspace phone via outbound route loop.

---

## 6. Plan / entitlement source

| Capability | Authority |
|------------|-----------|
| Paid vs free | `hasActiveMctbPaidEntitlement()` (`src/lib/mctb/entitlement.ts`) |
| Booking link | `hasMctbAiBookingEntitlement()` + paid + sender ready |
| Existing consent | Paid + `isExistingConsentModeEligible({ messagingReady })` — API also blocks free |
| Trial SMS limits | `getMctbEntitlement()` (runtime sends — unchanged) |

No `plan === "free"` in React components.

---

## 7. Central capability resolver

- **Server:** `resolveMctbInboxCapabilities`, `resolveMctbInboxCapabilitiesForConversation` (`src/lib/mctb/inbox/resolve-inbox-capabilities.ts`)
- **Pure derive (tests):** `deriveMctbInboxCapabilitiesFromInputs` (`capabilities-derive.ts`)
- **API:** `GET /api/mctb/inbox/capabilities?conversationId=`
- **Client hook:** `useMctbInboxCapabilities` for MCTB threads in `ConversationsThreadArea`

---

## 8. Free capability matrix (platform sender)

| Capability | Allowed |
|------------|---------|
| Press-1 / recovery visibility | Yes |
| Existing consent | No (paid gate) |
| Booking link | No |
| Freeform composer / Saved Replies | No |
| Messaging authority | `platform_responses_only` |

---

## 9. Paid + platform sender matrix

| Capability | Allowed |
|------------|---------|
| Existing consent | Only if workspace `messagingReady` (typically customer A2P setup) |
| Booking link | If `hasMctbAiBookingEntitlement` + sender ready |
| Freeform composer / Saved Replies | **No** |
| AI two-way (runtime) | **Yes today — arbitrary text (BLOCKER)** |

---

## 10. Customer-owned A2P matrix

| State | Composer | Saved Replies | Booking (if entitled) |
|-------|----------|---------------|------------------------|
| Ready + paid | Full shared composer | Yes | Yes |
| Not ready | Hidden / unavailable messaging | No | No |

---

## 11. Inbox composer behavior

- **Full two-way:** unchanged shared `ConversationsComposer`.
- **Platform / not entitled:** `smsEnabled={false}` — **notes only**, concise authority hint (no disabled ghost composer).
- **Saved Replies:** hidden unless `canUseSavedReplies`.

---

## 12. Platform approved-response architecture

**No customer-selectable approved-response catalog exists** for owner-initiated platform SMS (`hasApprovedPlatformResponses: false`). Recovery automation uses templates/runtime elsewhere; **owner inbox cannot pick approved actions yet** — only visibility + handoff controls.

---

## 13. Saved Replies gating

Platform sender: picker hidden. Customer A2P ready: shared picker unchanged.

---

## 14. Booking-link gating

UI: `mctbBookingEnabled` from capabilities. API: `POST /api/contacts/actions` `send_booking_link` checks `canUseBookingLink` (conversation-scoped when `conversationId` present).

---

## 15. Existing-consent gating

`PATCH/POST` MCTB setup: free workspaces rejected when setting `existing_consent`. Paid still requires messaging ready + attestation (existing checks preserved).

---

## 16. AI Recovery outbound behavior

**Path:** Inbound SMS → `handleMctbCustomerSmsReply` → `handleMctbLeadRecoveryInboundSms` → `leadRecovery.reply` (model/policy) → `sendMctbCustomerOutboundSms` / durable job → `resolveMctbOutboundSmsRoute` → platform or workspace send.

**Platform:** Arbitrary AI-generated reply text can be sent today when automation active and not `human_active`/`resolved`.

**Workspace A2P:** Same pipeline; broader entitlement assumed by product once sender is customer-owned.

---

## 17. Server-side send authorization

`PATCH /api/inbox/[id]` reply action → `assertMctbInboxOutboundAllowed` → **403** for MCTB threads without `canUseFreeformMessaging` (platform sender arbitrary body rejected).

Non-MCTB conversations: unchanged (gate returns ok when not MCTB product source).

---

## 18. Human takeover vs messaging authority

Recovery panel: automation ownership (take over / resume). Composer: **separate** `messagingAuthority` — human active does not grant platform freeform SMS.

---

## 19. Manual-send → takeover trace

`PATCH` inbox reply → `ensureMctbHumanOwnershipBeforeManualSend` → `takeOverMctbConversation` when automation in AI-active states, **before** `sendQuickSms`.

Applies to MCTB conversations with freeform allowed (customer A2P). Platform path has no manual SMS.

---

## 20. Race-safety finding

Takeover runs immediately before send; **does not serialize with in-flight AI outbound jobs**. A reply already being generated may still deliver one message after staff sends. Full race safety would need transactional coupling with the lead-recovery send queue — **deferred** (reported, not redesigned).

---

## 21. Compliance precedence

`applyConversationComplianceOverrides` — `UNSUBSCRIBED` contact → `opted_out`, all send capabilities false. Existing suppression/opt-out pipelines unchanged.

---

## 22. Files changed (Pass 1B)

- `src/lib/mctb/inbox/capabilities-types.ts`
- `src/lib/mctb/inbox/capabilities-derive.ts`
- `src/lib/mctb/inbox/resolve-inbox-capabilities.ts`
- `src/lib/mctb/inbox/manual-send-takeover.ts`
- `src/lib/mctb/inbox/is-mctb-conversation-record.ts`
- `src/app/api/mctb/inbox/capabilities/route.ts`
- `src/app/api/inbox/[id]/route.ts`
- `src/app/api/mctb/setup/route.ts`
- `src/app/api/contacts/actions/route.ts`
- `src/components/inbox/conversations-thread-area.tsx`
- `src/components/inbox/conversations-composer.tsx`
- `src/components/mctb/inbox/use-mctb-inbox-capabilities.ts`
- `scripts/test-mctb-pass-1b-sender-authority.ts`

---

## 23. Tests / results

```bash
npx tsx scripts/test-mctb-pass-1b-sender-authority.ts  # OK
npx tsx scripts/test-mctb-pass-1-shell-inbox.ts        # OK
```

**Pass 1 report failures (re-checked):**

- `test-product-shell.ts` — `visibleProductShells` expects `appointments` + `mctb` but env returns `mctb` + `ai_after_hours`. **Unrelated** to Pass 1 nav; does not contradict shell separation.
- `test-mctb-booking-simplification.ts` — fails on missing `src/app/(app)/appointments/page.tsx`. **Unrelated** to MCTB booking-link-only policy.

---

## 24. Schema changes

**NONE**

---

## 25. Runtime / certified files changed

**None** in TeXML, CFNA, Press-1, eligibility engine, or `customer-sms` send content generation.

**Narrow API/lib only** for inbox authorization and setup consent plan gate.

---

## 26. Remaining blockers

1. **Platform AI arbitrary SMS** — runtime policy (Section 16–18).
2. **Approved platform owner responses** — no catalog to expose in Inbox.
3. **Manual-send vs AI race** — partial mitigation only.

---

## 27. Deferred Pass 2+

Missed Calls redesign, AI Recovery page simplification (Pass 3), Setup redesign (Pass 4).

---

## 28. Owner certification required

- [ ] Free + platform: no SMS composer, no saved replies, no booking button
- [ ] Paid + platform: booking only when entitled; still no freeform composer
- [ ] Customer A2P: full composer; manual send triggers takeover
- [ ] API rejection: arbitrary platform-sender inbox POST returns 403
- [ ] Free cannot enable existing_consent via setup API
- [ ] Confirm AI Recovery on platform sender behavior vs product rule (blocker above)
