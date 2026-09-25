# MCTB Pass 3 — AI Recovery simplification

## 1. Executive verdict

**PASS — implementation complete.** Customer-facing AI Lead Recovery complexity is replaced by a single configuration page at `/mctb/ai-recovery`. Runtime (policy engine, lead snapshot, platform controlled responses, handoff) is unchanged. Legacy `/mctb/ai-lead-recovery` redirects with query preservation.

## 2. Page contract

| Item | Value |
|------|--------|
| Archetype | Configuration / settings |
| Primary job | Tell Transovo what AI Recovery should know and collect |
| Section order | Status → Business information → Information to collect → Booking link (when entitled) |
| Primary action | Save changes (`POST /api/mctb/ai-recovery/settings`) |
| Result surfaces | None (links to Inbox / Missed Calls) |
| States | Loading skeleton, error+retry, partial (business summary always optional), saving/saved |

## 3. Before / after

| Before | After |
|--------|--------|
| `/mctb/ai-lead-recovery` — scenarios, policies, providers, test drawer, launch-hidden AI_BOOK/TTP | `/mctb/ai-recovery` — four sections, no prompt/model/voice/follow-up |
| Nav: “AI Lead Recovery” | Nav: “AI Recovery” |

## 4. Existing config source

- **Storage:** `workspace.customFieldsConfig.mctb.leadRecovery`
- **Load/save:** `loadLeadRecoveryConfig` / `saveLeadRecoveryConfig` (`src/lib/mctb/lead-recovery/config.ts`)
- **Simplified save:** `buildAiRecoverySavePatch` + `POST /api/mctb/ai-recovery/settings`

## 5. Runtime enable/disable

- **Field:** `leadRecovery.enabled`
- **Inbound gate:** `handleMctbCustomerSmsReply` → `loadLeadRecoveryConfig`; returns when `!enabled` or `policyHealth === "DISABLED"` (`customer-sms.ts`, `conversation-runtime.ts`)
- **Off path:** `applyLaunchAiRepliesSetting(workspaceId, false)` sets `enabled: false` and handoff `responseMode: "notify_only"`

## 6. Business information ownership

- **Canonical:** Company Brain via `loadBusinessBrain` / `loadMctbApprovedBusinessInformation`
- **UI:** Read-only summary + link to `/settings/business` (not a second editable copy on this page)

## 7. Information-to-collect registry

| UI label | Runtime field |
|----------|----------------|
| Name | `NAME` |
| What they need | `REASON` (+ `ISSUE_DESCRIPTION` on SERVICE_REQUEST when enabled) |
| Service location | `ADDRESS` |
| Urgency | `URGENCY` |
| Best time to call back | `CALLBACK_TIME` + `CALLBACK_NUMBER` |

Synced into `collectCapabilities` and `intentPolicies[].collect` for GENERAL_INQUIRY, SERVICE_REQUEST, UNKNOWN, CALLBACK_REQUEST, EMERGENCY_OR_URGENT, and fallback policy.

**Custom questions:** Not exposed — no end-to-end customer custom field registry beyond existing `LeadRecoveryCollectField` enum.

## 8. Booking link source

- **Persistence:** `leadRecovery.bookingLinkId` → `mctbBookingLink` table
- **API:** `/api/mctb/booking-links` (reuse)
- **Runtime:** `SEND_BOOKING_LINK` in intent policies when enabled + entitled (no `AI_BOOK` in launch patch)

## 9. Entitlement behavior

- **Gate:** `hasMctbAiBookingEntitlement` + `hasActiveMctbPaidEntitlement` (same as Pass 2 missed-call booking action)
- **Free / not entitled:** Booking section omitted (not disabled clutter)

## 10. PLATFORM behavior

- Copy only: managed recovery responses; no template editor on this page
- Pass 1C platform response registry unchanged

## 11. WORKSPACE A2P behavior

- Copy reflects connected messaging number; save path does not force platform templates

## 12. Messaging-not-ready

- Banner when AI Recovery on and `isMctbSetupMessagingReady` false; links to Setup phone

## 13. AI_BOOK legacy handling

- Stripped from `actionCapabilities` and intent `actions` on simplified save
- `loadLeadRecoveryConfig` may still derive `AI_BOOK` booking mode if `aiBooking.enabled` in DB — dormant runtime preserved; UI never exposes direct booking

## 14–17. Removed / hidden from launch UI

Direct booking, follow-up timers, Text-to-Pay, prompt/model/voice/CRM/takeover controls — not on canonical page. Old `ai-lead-recovery-page.tsx` remains in repo but is no longer routed.

## 18. Callback preference

Collected via `CALLBACK_TIME` / `CALLBACK_NUMBER` toggles only; no callback queue on this page.

## 19. Onboarding

No separate wizard-only AI Recovery store found; onboarding does not write a conflicting config path.

## 20. Legacy routes

- `/mctb/ai-lead-recovery` → `/mctb/ai-recovery` (query preserved)
- `MCTB_ROUTES.aiRecovery` canonical; `aiLeadRecovery` deprecated alias

## 21. `/mctb/voice-agent`

Still the Voice AI Agent entry under **AI Receptionist** nav when `hasVoice`. Not linked from simplified AI Recovery page. Runtime preserved; Pass 6 can reconcile redirect vs Voice shell.

## 22. Files changed (presentation)

- `src/app/(app)/mctb/ai-recovery/page.tsx`
- `src/app/(app)/mctb/ai-lead-recovery/page.tsx` (redirect)
- `src/components/mctb/ai-recovery/ai-recovery-settings-page.tsx`
- `src/lib/mctb/ai-recovery/simplified-fields.ts`
- `src/lib/mctb/ai-recovery/sync-collection-config.ts`
- `src/app/api/mctb/ai-recovery/context/route.ts`
- `src/app/api/mctb/ai-recovery/settings/route.ts`
- `src/lib/mctb/routes.ts`, `src/lib/products/mctb-nav.ts`, `src/lib/mctb/overview.ts`
- `src/components/mctb/home/mctb-home-sections.tsx`, `setup-recovery-view.tsx`
- `scripts/test-mctb-pass-3-ai-recovery.ts`

## 23. Runtime files changed

None (engine preserved).

## 24. Schema changes

**NONE**

## 25. Tests / results

- `npx tsx scripts/test-mctb-pass-3-ai-recovery.ts` — OK
- `npx tsx scripts/test-mctb-pass-2-missed-calls.ts` — OK

## 26. Deferred

- Full visual polish (Mode 4)
- Overview policy-health copy tuned for simplified booking (still links to AI Recovery)
- Optional merge of `ai-lead-recovery-page.tsx` removal after bookmark sunset

## 27. Owner certification checklist

- [ ] AI Recovery on/off persists and stops new automated recovery replies when off
- [ ] Field toggles persist and affect collection in live SMS thread
- [ ] Business summary matches Company Brain; edit link works
- [ ] Paid entitled: booking link saves and `SEND_BOOKING_LINK` fires on booking intent
- [ ] Free: no booking section
- [ ] Legacy URL redirects
- [ ] No AI_BOOK / follow-up / TTP / prompt UI on canonical page
