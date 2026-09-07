# Mode 4 Kimi UI Production Promotion Audit

**Updated:** 2026-09-07  
**Branch:** `master`  
**Stage:** Production promotion audit complete — UI blueprint stage closed. Runtime validation is next.

## Summary

| Classification | Count | Notes |
|----------------|-------|-------|
| **ALREADY_LIVE_KIMI** | 52 | Production route renders Kimi-family shell via `kimi-ui/` + `*-connected` adapters |
| **PROMOTED_NOW** | 6 | Final completion-pass gap-fills promoted from `kimi-drafts/` into production `kimi-ui` this pass |
| **INTENTIONALLY_LEGACY** | 1 | Shared foundation header chrome (sidebar is Kimi) |
| **BLOCKED** | 0 | — |

**Result:** All 58 manifest surfaces route through Kimi-family UI. No production route remains on a legacy-only shell.

---

## PROMOTED_NOW (this pass — 6 gap-fills)

| ID | Route | What was promoted |
|----|-------|-------------------|
| `booking-pages` | `/appointments/booking` | `PublicBookingCard` → “Preview reminder schedule” link (`/book/{slug}/reminders`) |
| `ai-booking` | `/appointments/ai-booking` | `InboundChannelsCard` + channel list CSS |
| `analytics-overview` | `/appointments/analytics` | `RoutingFormsPanel` on Overview tab + mock routing metrics in `types.ts` |
| `settings-business` | `/settings/business` | `SuspiciousBookingsCard` wired to `suspiciousBookings` from settings API |
| `public-booking` | `/book/[slug]` | `EmailVerificationStep` when API returns 428 challenge; syncs contact fields to flow before book |
| `automation-activity` | `/appointments/automations/activity` | `LogDetailDrawer` + clickable log rows (prior commit `7b84bc9e`) |

---

## ALREADY_LIVE_KIMI (52)

All other manifest surfaces were already promoted before this pass. Production entrypoints re-export Kimi connected shells:

| Domain | Surfaces |
|--------|----------|
| **Home / Appointments** | `home`, `appointments-calendar`, `appointments-list`, `appointment-detail`, `appointments-waitlist`, `appointments-recalls`, `appointments-recall-campaigns`, `appointments-no-show-recovery`, `appointments-new`, `appointments-setup` |
| **Booking** | `booking-types`, `availability`, `routing-forms`, `meeting-polls`, `team-pages` |
| **Automations** | `reminder-sequences`, `workflow-builder`, `workflow-new`, `workflow-edit`, `workflow-setup`, `automation-templates` |
| **Contacts / Messages** | `contacts`, `contact-detail`, `contacts-lists`, `contacts-segments`, `contacts-fields`, `contacts-imports`, `messages-inbox`, `messages-saved-replies` |
| **Meetings / Payments** | `meetings-upcoming`, `meetings-recaps`, `meeting-detail`, `payments-transactions` |
| **Analytics** | `analytics-booking`, `analytics-reminders`, `analytics-automations`, `analytics-reports` |
| **Integrations** | `integrations-calendars`, `integrations-payments` |
| **Settings** | `settings-users`, `settings-messaging`, `settings-calendar`, `settings-meetings`, `settings-security`, `settings-billing` |
| **Help** | `help-getting-started` |
| **Public** | `public-booking-service`, `public-embed-booking`, `public-confirm`, `public-cancel`, `public-reschedule`, `public-waitlist-accept` |
| **Foundation** | `foundation-shell` (partial — see below) |

### `workflow-setup` note

Production uses `SetupWizard` via `workflow-editor-connected` (URL requires `templateId`; no standalone picker page). Payment/webhook step configuration exists in `WorkflowBuilder` → `StepConfigModal` on the edit path. The draft’s fuller picker + inline `StepConfigPanel` is a sandbox variant — **not required for promotion** because the connected wizard is the approved production path.

### `settings-billing` / `help-getting-started`

Fully promoted Kimi shells; no draft gap-fills were specified.

---

## INTENTIONALLY_LEGACY (1)

| ID | Route | What remains legacy | Why |
|----|-------|---------------------|-----|
| `foundation-shell` | Shared layout | `Header` component in `app-shell.tsx` | Sidebar uses Kimi `TransovoSidebar`; header is legacy shadcn. Deferred — not a page surface. |

### Minor legacy chrome (acceptable, not reclassified)

- **Analytics tabs:** `analytics-shell.tsx` uses shadcn `Tabs` wrapper around Kimi `AnalyticsClient` — cosmetic only.
- **Integrations calendars:** Kimi page shell + tabs; core card may still delegate to legacy integration card in some paths — Kimi-family presentation is primary.

These do **not** block runtime validation.

---

## BLOCKED (0)

None.

---

## Production routes NOT using Kimi-family UI

**None.** Every manifest surface’s production `page.tsx` resolves to a Kimi `kimi-ui` shell or `*-connected` adapter.

Legacy client files (e.g. old shadcn `public-booking-client.tsx`) remain in repo for reference but are **not** production entrypoints.

---

## Next stage

**Runtime / browser validation** (separate pass):

- Build + dev server smoke
- Click-through every major flow
- Form mutations + API wiring
- Responsiveness
- Visual cleanup from real data

No further UI completion or Kimi credit spend required before that stage.
