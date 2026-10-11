# Appointment Reminders — Current UI Route & Navigation Map

**Pass type:** READ-ONLY inventory (no product changes)  
**As-built source:** Next.js App Router under `src/app/(app)/appointment-reminders/**`, `src/lib/products/appointment-reminders-nav.ts`, connected shells in `src/newui-transplant/connected/appointment-reminders/**`  
**Inventory date:** 2026-10-11  
**Visual verification:** CODE-INFERRED (responsive behavior taken from component classes and nav config; live browser pass on Cloud VM was unstable — not used as authority)

---

## 1. Product shell & navigation sources

| Mechanism | File / behavior |
|-----------|-----------------|
| Desktop sidebar | `buildAppointmentRemindersNav()` → `resolveProductSidebarNav()` when product shell is `appointment_reminders` |
| Mobile bottom nav (4 slots + **More**) | `buildAppointmentRemindersMobileNav()` — **More** opens full sidebar (`app-shell.tsx` → `Sidebar`) |
| Route constants | `src/lib/appointment-reminders/routes.ts` (`AR_ROUTES`) |
| Page titles | `getAppointmentRemindersPageTitle()` |
| Booking submodule nav | Hidden when `appointmentRemindersHideBookingNav()` is true (default: `isAppointmentRemindersV1Primary()`) — routes still exist |
| Shared workspace pages (keep AR shell) | `/settings/billing`, `/settings/business` (`isAppointmentRemindersSharedWorkspacePath`) |
| External shared links from AR UI | `/compliance`, `/contacts` (linked from notifications panel) |

### 1.1 Desktop sidebar (current)

When booking nav **hidden** (typical V1 AR launch):

| Label | Route | Notes |
|-------|-------|--------|
| Overview | `/appointment-reminders` | `matchExact` |
| Appointments | `/appointment-reminders/appointments` | |
| Calendar | `/appointment-reminders/calendar` | Read-only grid |
| Reminders | `/appointment-reminders/reminders` | **Children:** Activity & delivery, Sequences, Templates |
| Responses | `/appointment-reminders/responses` | |
| AI Rescheduler | `/appointment-reminders/ai-rescheduler` | |
| Analytics | `/appointment-reminders/analytics` | |
| Settings | `/appointment-reminders/settings` | Query tabs |
| Plan & Billing | `/appointment-reminders/settings?tab=billing` | Account section |
| Business Settings | `/settings/business` | **Shared** org settings |

When booking nav **visible** (env `AR_HIDE_BOOKING_NAV=0`): adds **Booking page**, **Meetings** under Booking section.

### 1.2 Mobile bottom nav (current)

When booking hidden:

| Slot | Label | Route |
|------|-------|-------|
| 1 | Home | `/appointment-reminders` |
| 2 | Appointments | `/appointment-reminders/appointments` |
| 3 | Reminders | `/appointment-reminders/reminders` |
| 4 | Settings | `/appointment-reminders/settings` |
| 5 | **More** | Opens sidebar (Calendar, Responses, AI Rescheduler, Analytics, Reminders children, Plan & Billing, Business Settings, product switcher) |

**Not in bottom nav:** Sequences, Templates, Responses, Analytics, Calendar — reachable via Reminders hub tabs, More → sidebar, or in-page links.

---

## 2. Route tree (customer-facing pages)

Legend: **R** = route URL · **T** = tab/query state · **D** = drawer/sheet (no URL) · **↪** = redirect

```
/appointment-reminders                          [R] Overview
/appointment-reminders/appointments             [R] Appointments list (+ query filters)
/appointment-reminders/calendar                 [R] Calendar (read-only)
/appointment-reminders/reminders                [R] Reminders hub — Activity & delivery
/appointment-reminders/reminders/sequences      [R] Reminders hub — Sequences
/appointment-reminders/reminders/templates      [R] Reminders hub — Templates
/appointment-reminders/reminders/sequences/[stepKey]/edit  [R] Full-page sequence step editor
/appointment-reminders/responses                [R] Responses (+ ?view=)
/appointment-reminders/held-inbound             [↪] → /responses?view=held
/appointment-reminders/analytics                [R] Analytics
/appointment-reminders/settings                 [R] Settings (+ ?tab=)
/appointment-reminders/settings?tab=sequence    [↪] → /reminders/sequences
/appointment-reminders/settings?tab=templates   [↪] → /reminders/templates
/appointment-reminders/calendars                [R] Calendars (duplicate integration surface; not in sidebar)
/appointment-reminders/calendars                [R] (same as above)
/appointment-reminders/ai-rescheduler           [R] AI Rescheduler
/appointment-reminders/pricing                  [R] Pricing / plan marketing
/appointment-reminders/setup/connect            [R] Onboarding step 1
/appointment-reminders/setup/configure          [R] Onboarding step 2
/appointment-reminders/setup/activate           [R] Onboarding step 3
/appointment-reminders/booking                  [R] Booking page (nav optional)
/appointment-reminders/booking/meetings         [R] Meetings list
/appointment-reminders/booking/meetings/new     [R] New meeting
/appointment-reminders/booking/meetings/[id]    [R] Meeting detail
/appointment-reminders/booking/services         [R] Services list
/appointment-reminders/booking/services/new       [R] New service
/appointment-reminders/booking/services/[id]      [R] Service detail
/signup/appointment-reminders                   [R] AR signup entry (auth layout)
/settings/business                              [R] Shared — Business Settings (AR shell)
/settings/billing                               [R] Shared — may duplicate billing entry
```

**Page file count:** 25 `page.tsx` files under `src/app/**/appointment-reminders/**` (includes API-adjacent app routes only in `(app)` group).

---

## 3. In-page navigation (not separate routes)

| Parent | Mechanism | States / IDs |
|--------|-----------|----------------|
| Settings | Horizontal tab bar | `scheduling`, `business`, `notifications`, `integrations`, `billing` (+ legacy `sequence`/`templates` redirect) |
| Reminders hub | Horizontal tab bar | `activity`, `sequences`, `templates` |
| Responses | Horizontal tab bar | `view=needs_attention` (default), `all`, `held` |
| Appointments | Engagement filter tabs | `all`, `upcoming`, `awaiting_confirmation`, `confirmed`, `reschedule_requested`, `cancellation_requested`, `needs_attention`, `completed` |
| Appointments | URL query filters | `q`, `date`, `reminderStatus`, `calendarId`, `page`, `pageSize`, `highlight`, `open` |
| Reminders activity | URL query filters | `q`, `status`, `horizon`, `page`, `pageSize` |
| Appointment detail | Sheet tabs | `details`, `reminders`, `activity`, `preferences` |
| Analytics | Date range | Query-driven (see analytics page) |

---

## 4. Click depth from Overview (typical)

Assumes user lands on `/appointment-reminders` (Overview). Counts **clicks/taps**; opening a drawer counts as +1 interaction.

| Destination | Path | Depth (clicks) | Desktop sidebar | Mobile bottom |
|-------------|------|----------------|-----------------|---------------|
| Appointments list | Sidebar / bottom | 1 | Yes | Yes |
| Appointment detail drawer | Appointments → row | 2 (+ drawer) | — | — |
| Calendar | Sidebar / More | 1–2 | Yes | More only |
| Reminders activity | Sidebar / bottom / link | 1 | Yes (child) | Yes (hub default) |
| Sequences | Reminders tab or sidebar child | 2 | Child link | 2 (Reminders → tab) |
| Step editor (full page) | Sequences → Edit | 3 | — | 3 |
| Templates | Reminders tab | 2 | Child | 2 |
| Responses | Sidebar / More / Overview link | 1–2 | Yes | More |
| AI Rescheduler | Sidebar / More | 1–2 | Yes | More |
| Analytics | Sidebar / More | 1–2 | Yes | More |
| Settings (scheduling default) | Sidebar / bottom | 1 | Yes | Yes |
| Settings → Integrations | Settings tab | 2 | — | 2 |
| Plan & billing | Sidebar account / Settings tab | 1–2 | Yes | More |
| Setup connect | Product onboarding / links | 2+ | No permanent nav | No |
| `/calendars` | No sidebar link | Orphan unless linked | No | No |

---

## 5. OAuth & off-app flows (customer-visible)

| Flow | Entry | Return |
|------|-------|--------|
| Microsoft calendar OAuth | Integrations tab, Setup connect, `/calendars` | `returnTo` query on `CalendarIntegrationsOpus` |
| Stripe checkout / portal | Plan & billing | External Stripe URLs |
| Export CSV | Reminders / Responses headers | `GET /api/appointment-reminders/export/*` download |

---

## 6. API routes (not pages — reference for save targets)

Settings UI persists primarily to:

- `PATCH /api/appointment-reminders/settings`
- `POST /api/appointment-reminders/settings/presets`
- `POST /api/appointment-reminders/settings/apply-template`
- `PATCH /api/integrations/calendars/:id` (integrations UI)
- `PATCH /api/appointment-reminders/operational-pause`
- Billing: `/api/appointment-reminders/billing/*`

Listed for Settings deep inventory cross-reference; not customer navigation.

---

## 7. Orphan / duplicate entry points (discoverability notes)

| Surface | Issue |
|---------|--------|
| `/appointment-reminders/calendars` | Full page exists; **not** in primary sidebar — overlaps Settings → Integrations |
| Settings `?tab=sequence` / `?tab=templates` | Redirect to Reminders hub (backward compatible) |
| `/appointment-reminders/held-inbound` | Legacy redirect to Responses held tab |
| Booking routes | Present in codebase; nav hidden by default |
| Test send / template preview | Settings notifications tab + step editor; API `GET/POST .../reminders/test` |

---

## 8. Completeness checklist (route map)

- [x] All `(app)/appointment-reminders/**/page.tsx` routes listed  
- [x] Signup AR route listed  
- [x] Shared `/settings/*` paths noted  
- [x] Tabs vs routes distinguished  
- [x] Mobile vs desktop nav documented separately  
- [ ] Live mobile overflow menu labels — CODE-INFERRED from sidebar parity  

**Next doc:** `AR-CURRENT-UI-COMPLETE-FEATURE-INVENTORY.md` (per-page controls).
