# Transovo Unified Appointments — Feature Overlap & Consolidation Audit

**Date:** 2026-10-13  
**Status:** Read-only audit — **no source files, routes, APIs, or database models were modified** to produce this document.  
**Context:** Merged navigation (`buildUnifiedAppointmentsNav`) exposes ~25 top-level items, ~100 labeled rows, **84 unique URLs** (see `docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md`).

**Consolidation rule (for future implementation):** When two surfaces implement the same job, keep **Appointment Reminders (AR) New UI2 Opus** as the primary shell, port missing capabilities from Scheduling, reuse existing APIs/models, then remove duplicate **nav** entries — not routes/APIs until parity is proven.

---

## 1. Executive summary

### How much duplication is real?

| Category | Approx. share of merged nav | Meaning |
|----------|----------------------------|---------|
| **Exact duplicate / redirect** | ~8–10% of unique URLs | Same job, one route is already a redirect or alias (e.g. `/appointments/reminders` → AR settings). |
| **Partial overlap** | ~35–45% | Same domain object (`VoiceAppointment`, calendar sync, reminders) but different UX depth (AR = reminders/engagement-first; Scheduling = operations/booking-first). |
| **Distinct Scheduling-only** | ~40–45% | No AR equivalent UI (classes, POS, staff, workflows engine admin, etc.). |
| **Shared platform** | ~10% | `/settings/*`, `/integrations/*`, `/conversations`, `/payments` — global chrome, not product duplicates. |

### Largest consolidation opportunities (highest impact, highest risk)

1. **Calendar** — Two full calendar workspaces (AR Opus sync viewer vs Scheduling Kimi calendar with native create/edit, waitlist match, filters). **Highest UX and technical merge effort.**
2. **Appointments list / detail** — AR appointments table (reminder engagement, SMS, write-back) vs Scheduling scheduled list + `/appointments/[id]` detail (service booking, payments, segments). Same underlying appointments table; different columns and actions.
3. **Reminders vs Workflows** — AR sequences/templates/activity share **`reminder-engine`** and delivery with Scheduling, but **Scheduling workflows** (`AppointmentWorkflow` + step executions) are a **separate automation engine** (triggers, no-show paths, time-based scans). Must not collapse blindly.
4. **Analytics** — AR analytics (reminder/SMS/reschedule KPIs) vs Scheduling analytics hub (booking, commerce, service-booking reports). Complementary, not duplicate.
5. **Booking** — AR Booking Opus (link, branding, light type list) vs Scheduling booking admin (pages, branding, contracts, share, full type editors). AR is **not** a substitute for Acuity-depth booking admin.
6. **Integrations** — AR Settings → Integrations tab vs `/integrations?provider=calendar` and `/appointment-reminders/calendars` (redirect). One connection-management destination needed.
7. **Messages vs Responses** — `/conversations` (full inbox) vs `/appointment-reminders/responses` (appointment-tied SMS replies + held queue). Overlap in thread data, not in product scope.

### Recommended posture before sidebar redesign

- **Do not delete** Scheduling routes or APIs in the first consolidation pass.
- **Merge navigation** only after per-surface parity checklists pass.
- Use **AR Opus** as the visual foundation; embed Scheduling capabilities (drawers, tabs, deep links) rather than reverting to legacy Scheduling chrome.

---

## 2. Complete overlap matrix

Legend: **Opus** = New UI2 transplant under `src/newui-transplant/connected/appointment-reminders/**` and `ar-opus-*` components.

### 2.1 Overview & dashboards

| | **A. Appointment Reminders** | **B. Original Scheduling** |
|---|-------------------------------|------------------------------|
| **Route** | `/appointment-reminders` (calendar-first home) | `/appointments/overview` |
| **UI** | `ar-calendar-workspace-page.tsx` (calendar + ops strip + overview feed) | `overview-connected.tsx` → Kimi overview / pilot chrome |
| **Opus?** | Yes | Kimi / pilot (not full Opus transplant) |
| **APIs** | `/api/appointment-reminders/overview`, calendar events, sync | `/api/appointments/overview` |
| **Models** | `VoiceAppointment`, calendar connections, AR activation | Same + platform metrics, booking KPIs |
| **B-only** | Dashboard KPIs for full booking/commerce, setup wizard entry | |
| **Decision** | **Partial overlap.** Primary home should become one **Overview or Calendar** entry that composes AR readiness + optional scheduling KPIs. Keep `/appointments/overview` reachable until merged. |

### 2.2 Calendars

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders`, `/appointment-reminders/calendar` → redirect to home | `/appointments/calendar` |
| **UI** | `AppointmentRemindersCalendarWorkspacePage`, `ArCalendarOpusView` | `calendar-connected.tsx`, quick create, recurring scope, waitlist match drawer |
| **Opus?** | Yes | Kimi calendar (pilot tokens) |
| **APIs** | `GET /api/appointment-reminders/calendar/events` (`listAppointmentRemindersCalendarEvents`, import sync) | `GET /api/appointments/calendar/workspace`, calendar CRUD via appointment APIs |
| **Capabilities** | Synced external events, reminder overlays, detail drawer, native-actions endpoint | **Native create/edit**, staff/location/resource filters, drag reschedule, waitlist matching |
| **Decision** | **Partial overlap — not equivalent.** Consolidate into **one calendar** that: (1) shows unified `VoiceAppointment` + imports, (2) preserves Scheduling create/edit/reschedule, (3) keeps AR reminder/engagement strip. Scheduling calendar is **source of write** for native bookings; AR calendar today is **sync + engagement** biased. |

### 2.3 Appointments & appointment management

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/appointments` | `/appointments/scheduled`, `/appointments/list`, `/appointments/[id]`, `/appointments/new` |
| **UI** | `appointments-page.tsx` (table, engagement tabs, detail drawer) | `list-client`, `AppointmentDetailClient`, `form-client` |
| **Opus?** | Yes | Kimi / mixed components |
| **APIs** | `/api/appointment-reminders/appointments` (`loadAppointmentRemindersPage`, `createManualArAppointment`) | `/api/appointments`, `/api/appointments/[id]`, list workspace |
| **Models** | `VoiceAppointment` + reminder metadata, suppression, write-back | Same + service segments, payments, intake, class enrollments |
| **B-only** | Full create form, service/class context, video host, POS hooks on detail | |
| **A-only** | Reminder timeline per row, engagement filters, reminder suppress/contact, import-oriented columns | |
| **Decision** | **Partial overlap.** One **Appointments** destination should use **AR list UX** and add Scheduling actions (open full detail, new appointment, service context). Do not drop `/appointments/[id]` until detail parity in drawer or routed panel. |

### 2.4 Reminders, sequences, templates, activity

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/reminders`, `.../sequences`, `.../templates` | `/appointments/reminders` (**redirect** to AR settings), `/appointments/automations/templates`, `.../activity`, `/appointments/voice-reminders` |
| **UI** | `reminders-page.tsx`, `ar-reminders-sequences-page.tsx`, templates hub (Opus settings presentation) | `automations-templates-client`, activity client, voice reminders |
| **Opus?** | Yes | Legacy/Kimi automations shell |
| **APIs** | `/api/appointment-reminders/reminders`, templates library, settings presets | `/api/appointments/reminders/*`, track open/click, voice-reminders |
| **Shared backend** | `src/lib/appointments/reminder-engine.ts`, `reminder-delivery.ts`, AR eligibility + platform template policy | Same engine; Scheduling UI is thinner for sequences |
| **Decision** | **AR is canonical for SMS/email reminder product.** Scheduling automations templates/activity are **partial overlap** — merge template browsing into AR where duplicate; keep **voice-reminders** and **activity** as distinct sub-areas until mapped. `/appointments/reminders` already redirect-only (**legacy**). |

### 2.5 Workflows & general automations

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | Sequences under reminders (not general workflows) | `/appointments/workflows`, `.../new`, `.../[id]/edit`, setup templates |
| **UI** | Sequence step editor (`ar-sequence-step-editor-page.tsx`) | `workflows-list-client`, workflow builder |
| **APIs** | AR settings / sequence APIs | `/api/appointments/workflows/*`, job handlers `processAppointmentWorkflowStep`, time triggers |
| **Models** | Platform reminder workflow conflicts | `AppointmentWorkflow`, step executions (Prisma) |
| **Decision** | **Distinct functionality** — reminder sequences ≠ workflow engine. Consolidated nav label **“Workflows & Automation”** should house **both**: AR sequences + Scheduling workflow builder. Do not merge engines without explicit design. |

### 2.6 Booking (admin + public)

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/booking`, `.../meetings`, `.../services` | `/appointments/booking`, branding, forms, share, contracts; `/appointments/meetings`, `services`, `classes`, `workshops`; public `/book/[slug]/**` |
| **UI** | `booking-page-opus.tsx`, meetings/services Opus workspaces | `booking-settings-client`, `*WorkspaceConnected`, public book flow |
| **Opus?** | Yes (booking page); meetings/services Opus | Kimi connected workspaces |
| **APIs** | `/api/appointment-reminders/booking/*` | `/api/appointments/types`, service-booking APIs, `/api/public/book/[slug]/**` |
| **B-only** | Classes, workshops, packages, store checkout, routing forms, team booking, polls, AI booking admin | |
| **Decision** | **Partial overlap.** AR booking = **customer link + branding + shallow type list**. Scheduling = **full Acuity-style catalog**. Keep all B routes; progressively surface B editors from AR Booking hub. Public booking stays `/book/*`. |

### 2.7 Meetings

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/booking/meetings` (+ editor/create Opus) | `/appointments/meetings`, `/video`, `/meetings` (recaps) |
| **UI** | `ar-meetings-workspace-opus.tsx`, `ar-meeting-create-opus.tsx` | `MeetingsWorkspaceConnected` |
| **Decision** | **Partial overlap** — same meeting types, different shells. **Consolidate to one meetings workspace** (prefer Opus) backed by same `/api/appointments/types` or shared service-booking APIs. Video/recaps remain Scheduling nav children. |

### 2.8 Availability, staff, locations, resources, routing

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | Rules in AR Settings → Scheduling tab (not full availability UI) | `/appointments/availability`, `staff`, `locations`, `resources`, `routing`, restrictions |
| **Decision** | **Distinct (B-only) UI** with shared config in `loadAppointmentPlatformConfig` / availability APIs. No AR replacement — remain under **Availability** in consolidated nav. |

### 2.9 Clients, segments, contact merge

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | Contact columns on AR appointments; no dedicated clients hub | `/appointments/clients`, `[clientId]`, `segments`, `commerce/contact-merge` |
| **APIs** | Per-appointment reminder contact | `/api/appointments/clients/*`, service-booking merge |
| **Decision** | **Distinct** until AR grows a clients hub. **One Clients** nav should land on Scheduling clients UI (or Opus-wrapped) using same CRM records as contacts product. |

### 2.10 Messages & responses

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/responses` (held inbound deprecated) | `/conversations`, `/campaigns` (in scheduling nav) |
| **UI** | `ar-responses-opus.tsx` | Kimi inbox (`kimi-conversations-connected`) |
| **APIs** | `/api/appointment-reminders/responses`, conversations by appointment | `/api/conversations`, mass texting |
| **Decision** | **Partial overlap.** **Messages & Responses** should link: full inbox + AR filtered appointment replies. Do not remove mass SMS campaigns from platform; gate by entitlement. |

### 2.11 Analytics & reporting

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/analytics` | `/appointments/analytics` (+ booking, reminders, automations, reports), `/appointments/reports/service-booking` |
| **UI** | `analytics-page.tsx` (Opus) | `analytics-shell` sections |
| **APIs** | `/api/appointment-reminders/analytics` | `/api/appointments/analytics`, export |
| **Decision** | **Partial overlap** — complementary metrics. One **Analytics & Reports** hub with tabs: Reminders (AR), Booking, Commerce, Service booking. Keep all API endpoints. |

### 2.12 Calendar integrations

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | Settings → Integrations; `/appointment-reminders/calendars` → redirect | `/integrations?provider=calendar`, `/settings/calendar`, `/appointments/integrations` (hub) |
| **Runtime** | `import-sync.ts`, connection sync, Microsoft subscriptions, AR write-back | Same connection store; `bookAppointment` write on create |
| **Decision** | **Partial overlap** — one **Integrations** destination (AR Opus integrations tab + full integrations directory). No second OAuth flow. |

### 2.13 Payments & billing

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | AR Settings → Plan & billing (`/api/appointment-reminders/billing/*`) | `/payments`, `/appointments/pricing-payments`, POS, Stripe/Square service-booking |
| **Decision** | **Distinct** — workspace subscription (AR) vs **customer** payments (Scheduling/commerce). Consolidated nav **Commerce** must not merge with AR billing. |

### 2.14 Settings & business configuration

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/settings?tab=*` | `/settings/business`, `/appointments/setup`, `policies`, `enterprise` |
| **UI** | `reminder-settings-opus.tsx`, billing Opus | Global settings + scheduling setup client |
| **Decision** | **Partial overlap** — AR owns reminder/scheduling **rules** and activation; Scheduling setup/policies remain until ported into AR settings tabs or **Settings** subtree. |

### 2.15 Setup & onboarding

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/setup/connect|configure|activate` | `/appointments/setup` |
| **Decision** | **Partial overlap** — merge into one guided setup: connect calendar (AR) → activate reminders → optional booking/commerce setup (Scheduling). |

### 2.16 AI Rescheduler

| | **A. AR** | **B. Scheduling** |
|---|----------|-------------------|
| **Routes** | `/appointment-reminders/ai-rescheduler` | (no dedicated equivalent) |
| **Decision** | **Distinct (AR-only)** — keep as first-class nav item. |

---

## 3. Unique Scheduling features (must remain available)

No complete AR equivalent today (access via `/appointments/**` and related APIs):

- **Booking types:** services, classes, workshops, packages, memberships, gift certificates (API), categories, coupons  
- **Operations:** staff, locations, resources, availability schedules, routing rules, team booking, team pages, meeting polls, routing forms  
- **Revenue:** point of sale, pricing-payments hub, commerce hub, client wallet, payment plans  
- **Retention:** waitlist, recalls, recall campaigns, no-show recovery  
- **CRM:** clients directory, segments, client restrictions, contact merge  
- **Documents:** forms-documents builder, contracts, policies  
- **Automation:** appointment workflow builder (non-sequence), automation activity, voice-reminders  
- **Reporting:** service-booking reports, analytics subsections  
- **Admin:** enterprise scheduling, types editor legacy routes, service-booking admin hub  
- **Public:** `/book/[slug]/**`, manage/reschedule/cancel tokens, client portal  

---

## 4. Navigation inventory (merged sidebar)

Full machine-readable list: **`docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md`** (regenerate: `npx tsx scripts/generate-unified-sidebar-menu-doc.ts`).

### Classification summary (every top-level group)

| Top-level (current) | URL anchor | Equivalent? | Classification | Recommended final home |
|--------------------|------------|-------------|----------------|------------------------|
| Calendar (AR) | `/appointment-reminders` | Scheduling `/appointments/calendar` | Partial overlap | **Calendar** |
| Appointments (AR) | `/appointment-reminders/appointments` | `/appointments/scheduled` | Partial overlap | **Appointments** |
| Reminders (AR) | `/appointment-reminders/reminders/*` | Scheduling automations/reminders | Partial + legacy redirect | **Reminders** |
| Responses | `/appointment-reminders/responses` | `/conversations` (subset) | Partial overlap | **Messages & Responses** |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` | — | Distinct | **AI Rescheduler** |
| Analytics (AR) | `/appointment-reminders/analytics` | `/appointments/analytics` | Partial overlap | **Analytics & Reports** |
| Settings (AR) | `/appointment-reminders/settings` | `/settings/*`, scheduling setup | Partial overlap | **Settings** |
| Booking page (AR) | `/appointment-reminders/booking` | `/appointments/booking` | Partial overlap | **Booking** (hub) |
| Meetings (AR) | `.../booking/meetings` | `/appointments/meetings` | Partial overlap | **Booking → Meetings** |
| Plan & Billing | AR settings billing tab | `/settings/billing` | Shared platform | **Settings → Billing** |
| Home (Scheduling) | `/appointments/overview` | AR calendar home | Partial overlap | **Overview** (optional) or fold into Calendar |
| Booking (Scheduling) | `/appointments/services` | AR booking | Partial overlap | **Booking** |
| Calendar (Scheduling) | `/appointments/calendar` | AR calendar | Partial overlap | **Calendar** (merge) |
| Availability | `/appointments/availability` | AR settings rules only | Distinct | **Availability** |
| Clients | `/appointments/clients` | — | Distinct | **Clients** |
| Messages | `/conversations` | AR responses | Partial overlap | **Messages & Responses** |
| Reminders (Scheduling) | `/appointments/reminders` | AR | Legacy redirect | Remove from nav when redirect stable |
| Workflows | `/appointments/workflows` | AR sequences | Distinct engines | **Workflows & Automation** |
| Meetings (Scheduling) | `/video`, `/meetings` | AR meetings | Partial | **Meetings** or under Booking |
| Payments | `/payments` | pricing-payments | Distinct (customer $) | **Commerce** |
| Analytics (Scheduling) | `/appointments/analytics` | AR analytics | Partial | **Analytics & Reports** |
| Integrations | `/integrations` | AR integrations tab | Partial overlap | **Integrations** |
| Settings (Scheduling) | `/settings/business` etc. | AR settings | Shared / partial | **Settings** |
| Help | `/getting-started` | — | Shared platform | Help (footer) |

---

## 5. Proposed consolidated sidebar (target ~14 primary destinations)

Not an instruction to delete routes — **navigation destination map** only.

```
Overview                    → /appointment-reminders (or future unified dashboard)
Calendar                    → merged AR + Scheduling calendar (native + synced)
Appointments                → unified list + detail (AR UX + Scheduling depth)
Booking
  Services · Meetings · Classes · Workshops
  Booking pages · Forms · Team booking · Polls · Routing forms
Availability
  Staff · Locations · Resources · Routing · Restrictions
Clients
  Segments · Contact merge
Messages & Responses
  Inbox · Appointment replies (AR)
Reminders
  Activity · Sequences · Templates
Workflows & Automation
  Workflow builder · Automation activity · Voice reminders
AI Rescheduler
Commerce
  Packages · Memberships · Pricing · POS · Coupons
Analytics & Reports
  Reminders · Booking · Commerce · Service booking
Integrations
Settings
  Scheduling rules · Business · Notifications · Billing · Global settings
```

All **84 current URLs** remain reachable via hub children or deep links until each merge is certified.

---

## 6. Implementation plan (safest sequence)

### Phase 0 — Governance (current)

- [x] Merged nav exposes all surfaces (`UNIFIED_APPOINTMENTS` flag).
- [x] Overlap audit (this document).
- [ ] Sign-off on consolidation matrix per row.

### Phase 1 — Data & API alignment (no nav cuts)

- Document single canonical appointment row (`VoiceAppointment`) for both UIs.
- Ensure native create paths consistently call `bookAppointment` / `createPlatformAppointment` / `createManualArAppointment` with same write-back rules.
- Unify calendar event feed API (read model) for both calendars — **backend first**, two UIs still OK.

### Phase 2 — Calendar merge (highest risk)

- Opus calendar shell + Scheduling quick-create, filters, waitlist drawer.
- Regression: import sync, reminder overlays, drag reschedule, Microsoft/Google write-back.

### Phase 3 — Appointments merge

- AR list + link to Scheduling detail or expanded drawer (payments, intake, class enrollment).
- Preserve AR reminder actions on same row.

### Phase 4 — Reminders / workflows nav grouping

- Nav-only grouping; engines stay separate.
- Redirect `/appointments/automations/templates` to AR templates if parity proven.

### Phase 5 — Analytics & integrations hubs

- Tabbed Opus analytics; single integrations entry.

### Phase 6 — Nav deduplication

- Remove duplicate top-level items from `buildUnifiedAppointmentsNav` only after checklist per surface.
- Keep redirects from old URLs indefinitely where external links exist.

### Dependencies & regression risks

| Risk | Mitigation |
|------|------------|
| Losing native calendar create | Do not ship calendar merge without Scheduling E2E tests |
| Reminder eligibility breaks on imported events | AR eligibility tests + import-sync fixtures |
| Workflow jobs stop | Do not touch `AppointmentWorkflow` handlers during reminder UI merge |
| Commerce/POS regression | Keep `/appointments/point-of-sale` direct until Commerce hub exists |
| Entitlements (`appointments.read` vs `appointment_reminders.read`) | Unify auth helpers or dual-check during transition |

---

## 7. No-code-change confirmation

This audit was prepared by **reading** routes, components, and API handlers in the repository. **No application source, routes, APIs, Prisma models, or navigation builders were modified** as part of authoring this document.

*(Separate engineering work on branch `cursor/unified-appointments-restore-f350` already landed merged nav code earlier; that is outside this audit commit scope.)_

---

## Appendix — Key file index (overlap pairs)

| Area | AR (primary target) | Scheduling (capability source) |
|------|---------------------|--------------------------------|
| Calendar | `newui-transplant/connected/appointment-reminders/ar-calendar-workspace-page.tsx` | `features/appointments/kimi/calendar/calendar-connected.tsx` |
| Appointments | `newui-transplant/connected/appointment-reminders/appointments-page.tsx` | `components/appointments/list-client.tsx`, `form-client` |
| Reminders | `reminders-page.tsx`, `ar-reminders-sequences-page.tsx` | `automations-templates-client`, `appointments/reminders/page.tsx` (redirect) |
| Workflows | (sequences only) | `components/appointments/workflows-list-client.tsx` |
| Booking | `booking-page-opus.tsx` | `components/appointments/booking-settings-client.tsx`, `features/appointments/kimi/**` |
| Analytics | `analytics-page.tsx` | `components/appointments/analytics-shell` |
| Settings | `reminder-settings-opus.tsx` | `settings/*`, `appointments/setup` |
| Integrations | settings tab + `calendars-page` redirect | `/integrations`, `lib/calendar/import-sync.ts` |

**Shared runtime (reuse, do not fork):** `src/lib/calendar/import-sync.ts`, `src/lib/voice/calendar/booking.ts`, `src/lib/appointments/reminder-engine.ts`, `src/lib/appointment-reminders/**`, `src/lib/appointments/service-booking/**`.
