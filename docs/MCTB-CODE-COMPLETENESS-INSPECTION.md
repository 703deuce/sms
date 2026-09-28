# MCTB code completeness inspection

**Purpose:** Answer whether a paying customer can do everything MCTB promises end-to-end — not whether individual tests or capability resolvers pass.

**Method:** Trace customer UI → action → API → persistence → runtime → provider → persisted result → visible state. Search for stubs, dead controls, and billing/runtime disconnects.

**Branch reference:** Fixes from the first implementation pass are on `cursor/mctb-commercial-launch-continue-f350` (commit `e169c432`).

---

## Executive answer

**No — PSTN is not the only gap.**

Core Free/Recovery MCTB (voice ingress, recovery SMS, inbox, consent modes, pause, exclusions, usage limits at runtime) is largely **implemented end-to-end**. The biggest **product** holes are commercial **purchase + UX wiring** for add-ons, **Own Sender** onboarding/checkout, **manual messaging gating** on Platform sender, and a few **setup/cert alignment** items.

**AI Recovery** has a real inbound runtime (`handleMctbLeadRecoveryInboundSms` → policy → `executeLeadRecoveryActions` → `finalizeMctbOutboundSms`). The weak link was **customers could not buy/enable it through billing**, not missing SMS logic.

---

## What was fixed in the first implementation pass (`e169c432`)

- Commercial add-ons were entitlement-ready in Stripe webhooks but **not purchasable** (`mctb_ai_recovery` / `mctb_own_sender` missing from billing catalog; `parseCheckoutSelection` mis-parsed them as an MCTB tier).
- **`/mctb/setup/missed-call-rules`** was a redirect only; legacy editor restored (New UI still uses recovery transplant on that URL).
- Recovery save label did not match browser cert expectations.
- Monthly recovery usage was not shown in Setup UI (runtime enforcement already existed).
- AI Booking **Upgrade** button had no handler.

---

## 1. Free plan — trace summary

| Capability | Verdict | Production chain (representative) |
|------------|---------|-----------------------------------|
| Onboarding / business line / forward target | **E2E** | `POST /api/mctb/onboarding`, `getProductionMctbForwardTargetE164`, wizard + `mctb-setup-phone-wiring` |
| Press-1 TeXML | **E2E** | `docs/MCTB_FINAL_PRODUCTION_PIPELINE.md`, `src/lib/mctb/texml-ingress/*` |
| Pause / resume | **E2E** | Schedule in workspace custom fields + `MctbSetupPauseControl` → `POST /api/mctb/setup` |
| Exclusions | **E2E** | `/api/mctb/exclusions` + setup exclusions views |
| Triggers, delay, cooldown | **E2E** | `updateMissedCallTextConfig` via setup; missed-call-rules page restored in `e169c432` |
| 25 recovery allowance | **Runtime yes; UI improved** | `reserveMctbRecoveryUsage` in `send.ts` + `recovery-usage.ts`; Setup overview shows used/limit from `capabilities` on setup GET |
| Platform template + send | **E2E** | `resolveMctbRecoveryOpenerTemplate` + `sendQuickSms` in `send.ts` |
| Inbound reply / STOP / HELP | **E2E** | `src/lib/agents/missed-call-text-back/customer-sms.ts` |
| Conversations | **E2E** | `ensureMctbRecoveryConversation`, `/mctb/conversations` → shared inbox with `product=mctb` |
| Missed call list/detail | **E2E** | `/api/mctb/missed-calls`, detail routes + views |
| Voicemail | **Mostly E2E** | Operational inbox + setup greeting (spec 05); verify provider callbacks per environment |
| Analytics | **Real DB** | `loadMctbAnalytics` from `missedCallEvent` and related tables |
| Email notifications | **E2E** | Handoff config + `deliverMctbHandoffNotifications` |

---

## 2. Recovery paid

| Area | Verdict | Notes |
|------|---------|--------|
| Upgrade / entitlement | **E2E** | `mctb_starter` (etc.) via `platform-subscriptions` → `recoveryPaid` in `commercial-entitlements.ts` |
| Existing consent | **E2E** | Setup UI + `recordWorkspaceExistingConsentAttestation`; runtime TeXML branch per mode |
| Booking/request links | **E2E** | Booking-links CRUD, `defaultLinkUrl` in setup, `template-vars.ts` / send pipeline |
| Urgent rules | **E2E** | `classifyMctbUrgentReply`, `process-inbound-reply.ts`, notifications matrix; Test Urgent Rules in New UI (`action: test_urgent_rules` on handoff POST) |
| Normal vs urgent orchestration | **E2E** | `deliverMctbHandoffNotifications` + urgency flags on events |

**Gap:** Cert workspace bootstrap for existing consent can still return 500 if DB seed is incomplete (data/ops, not missing product logic).

---

## 3. AI Recovery

| Step | Verdict | Code |
|------|---------|------|
| Enable + settings | **UI + API** | `ai-recovery-settings-page.tsx` → `POST /api/mctb/ai-recovery/settings` → `saveLeadRecoveryConfig` |
| Inbound reply → AI | **Runtime** | `customer-sms.ts` → `handleMctbLeadRecoveryInboundSms` (`lead-recovery/conversation-runtime.ts`) |
| Intent / policy / send | **Runtime** | `intent-agent`, `policy-engine`, `action-runtime.ts`, `finalizeMctbOutboundSms` |
| Booking link in conversation | **Runtime** | `resolveBookingUrl` in `action-runtime.ts` + `mctbBookingLink` rows |
| Disable stops future AI | **Yes** | `config.enabled` / `policyHealth` gates in `conversation-runtime.ts` |
| Customer can buy SKU | **Was broken — fixed in `e169c432`** | Webhooks knew `mctb_ai_recovery`; catalog/checkout did not. Catalog + `parseCheckoutSelection` fixed; AI Booking Upgrade calls `/api/platform/billing/checkout` |

Entitlement gate tests alone never proved purchase; the missing link was **billing catalog + checkout metadata**, not the SMS brain.

---

## 4. Own Sender

| Step | Verdict | Code |
|------|---------|------|
| Select Platform vs WORKSPACE | **E2E** | `mctb-setup-phone-wiring` → `POST /api/mctb/setup` (`senderMode`, `smsPhoneNumberId`) |
| Runtime outbound resolve | **E2E** | `outbound-sms-route.ts` / `send.ts` `senderRoute` |
| Platform locks custom opener | **E2E** | `canEditRecoveryOpener`, `resolveMctbRecoveryOpenerTemplate` PLATFORM branch |
| Number search/purchase + TFV submit | **E2E** | `mctb-number-drawer-host` → `/api/numbers/premium/*`, `POST /api/mctb/tfv` |
| Purchase add-on | **Partially fixed** | Entitlement grants in webhook; catalog SKU added in `e169c432`. Phone UI still shows **hint text only** — needs checkout CTA (e.g. `mctb_own_sender`) like AI Booking |
| Live Stripe price IDs | **External** | Live catalog uses placeholders until `platform-billing-catalog-sync` / real prices |

Toll-free / 10DLC provider flows reuse shared numbers/compliance stack. The **commercial Own Sender purchase path** was incomplete until catalog/checkout wiring.

---

## 5. Sender switching

**E2E** for persist + runtime: setup POST → `missedCallTextConfig.senderMode` / `sms_phone_number_id` → `resolveMctbSmsSender` on send. Platform remains active until WORKSPACE is approved + entitled (`capabilities.ts`).

---

## 6. Custom messaging

| Piece | Verdict |
|-------|---------|
| Custom recovery template (WORKSPACE) | **E2E** — text-back setup POST + runtime template resolution |
| Platform disables edit/send custom opener | **E2E** — setup GET `canEditRecoveryOpener`, API strips template on PLATFORM POST |
| Manual inbox composer for Platform | **GAP** — `manualTwoWayMessaging` exists only in `capabilities.ts`; inbox composer (`kimi-conversations-connected`) does **not** gate on MCTB sender mode / capability |

---

## 7. Booking / request links

**E2E** for configure → persist → template vars → recovery send. AI path uses the same link store in `action-runtime.ts`. Not a capability-flag-only fiction.

---

## 8. Conversations

Real thread + MCTB context; composer block is permission/closed-thread only, **not** Platform-sender policy.

**Gap:** Enforce `manualTwoWayMessaging` / Platform sender rules on manual outbound from inbox.

---

## 9. Missed calls

List/detail APIs backed by `missedCallEvent` lifecycle fields (not hard-coded demo rows in production views).

---

## 10. Voicemail

Recording → storage → inbox UI; treat provider callback health as deploy/ops verification.

---

## 11. Analytics

`src/lib/mctb/analytics.ts` aggregates real events; overview tier-2 `leadRecovery` loads via `/api/mctb/overview-enrichment`.

---

## 12. Setup

Most sections load/save via `/api/mctb/setup`, handoff, onboarding, exclusions. Recovery save label aligned for cert. **New UI** still merges triggers into recovery on the missed-call-rules URL (legacy editor restored for non–Stage-2).

---

## 13. Numbers / A2P / toll-free

Drawer purchase + TFV API are real. Own Sender **purchase CTA** on Phone setup still missing (hint only).

---

## 14. Notifications

Handoff recipients + matrix + urgent test — wired in New UI `setup-pages.tsx`.

---

## 15. Compliance / Consent log

`MctbConsentLogView` → `/api/mctb/consent-log` → `loadConsentLogRows`.

---

## 16. Onboarding

`POST /api/mctb/onboarding` + provision paths; trial ingress is a separate automated path.

---

## 17. Incomplete implementation markers

- No widespread `TODO` / `mock` in `src/lib/mctb` product trees; landing mockups are marketing-only.
- **Dead control found:** AI Booking Upgrade (no handler) — fixed in `e169c432`.

---

## 18. Buttons / actions

Primary dead control was AI Booking Upgrade — fixed. Own Sender upgrade on Phone remains text-only.

---

## 19. APIs vs UI

Roughly 30 `/api/mctb/*` routes; customer UIs exist for setup, overview, handoff, lead-recovery, ai-recovery, booking-links, etc. Debug/admin routes (`admin-test/bootstrap`, `lead-recovery/simulate`) are intentional non-customer surfaces.

---

## 20. Runtime config authority

`setup-field-authority.ts` documents persistence; runtime reads `missedCallTextConfig` + solution config — single authoritative path for triggers, consent mode, sender mode.

---

## What still blocks “paying customer tomorrow”

1. **Own Sender checkout CTA** on Phone/Numbers (catalog fixed; UI still hint-only).
2. **Inbox manual send gating** for Platform sender (`manualTwoWayMessaging`).
3. **Real Stripe price IDs** for `mctb_ai_recovery` / `mctb_own_sender` (placeholders in live catalog until sync).
4. **Deploy + cert seed** for consent POST 500 / legacy redirects (branch ahead of production).
5. **Handset PSTN** for both consent modes (cannot be done in cloud VM).
6. **Optional:** Split trigger editor out of New UI recovery page to match page specs 09/12 fully.

---

## Bottom line

A green test for a capability is not the same as proving every customer-facing feature is implemented end-to-end. Core MCTB recovery is largely real; commercial add-on **purchase wiring** and **Platform manual messaging policy** were the main code gaps identified. First pass fixed billing/catalog/checkout for AI Recovery and Own Sender SKUs, missed-call-rules route, recovery usage on Setup overview, cert-aligned save label, and AI Booking Upgrade checkout.

**Suggested next implementation (highest value):** Own Sender checkout on Phone setup + MCTB-aware inbox composer gating for Platform mode.
