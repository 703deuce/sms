# Appointment Reminders — frontend integration pass report

**Branch:** `cursor/ar-frontend-complete-f350`  
**Date:** 2026-10-10  
**Scope:** Customer-operable UI on `newui-transplant` Opus stack (production). `newui2/` remains reference-only — not a second app.

---

## 1. Routes modified

| Route | Change |
|-------|--------|
| `/appointment-reminders` | KPI strip aligned to spec (upcoming, awaiting confirmation, confirmed, needs attention); header actions |
| `/appointment-reminders/appointments` | Engagement status tab bar; `engagement` query filter; existing table/drawer/import/manual |
| `/appointment-reminders/reminders` | Unchanged shell (already Opus operational ledger) |
| `/appointment-reminders/settings` | Six-section settings IA with URL `?tab=` |
| `/appointment-reminders/setup/configure` | Full configure form + live SMS preview |
| `/appointment-reminders/setup/connect` | Unchanged (integrations Opus) |
| `/appointment-reminders/setup/activate` | Unchanged readiness checklist |
| `/appointment-reminders/analytics` | Unchanged (already Opus) |
| `/appointment-reminders/calendar` | Unchanged |

**API**

- `GET /api/appointment-reminders/templates/library?summaries=1` — paginated template browser (306 catalog, server-side filter)
- `GET /api/appointment-reminders/appointments?engagement=` — engagement category filter
- Overview loader — engagement KPI counts

---

## 2. Opus components reused / promoted

Production kit (`src/newui-transplant/components/app/kit.tsx`, `opus-tables`, `simple-select`, `ui/sheet`, `ui/input`, MCTB weekly-hours pattern):

| New AR component | Role |
|------------------|------|
| `ar-template-library-browser.tsx` | 306-template browser + preview sheet |
| `ar-business-profile-panel.tsx` | Business identity + merge variable preview |
| `ar-weekly-hours-editor.tsx` | Business hours for skip-outside-hours rules |
| `ar-notifications-responses-panel.tsx` | Defaults, confirmation, sender readiness, send test |
| `ar-integrations-settings-panel.tsx` | Microsoft 365 + sources (wraps `CalendarIntegrationsOpus`) |
| `ar-setup-configure-panel.tsx` | Onboarding step 2 full configure + preview |

**Design system:** No new parallel design system. `newui2/components/app/primitives.tsx` patterns already live in `newui-transplant/components/app/kit.tsx`.

---

## 3. Legacy removal

- Settings no longer uses a single mixed tab bar (sequence / preview / presets / test only).
- Primary nav: **Settings** replaces “Reminder Settings”; calendar connections + held SMS moved under **More** (integrations also on Settings → Integrations).
- Appointment drawer: wider sheet (600–720px), tabbed sections (no legacy `@/components/appointments` on reminder path).

Booking routes under `/appointment-reminders/booking/*` still use mixed legacy where not in this pass scope.

---

## 4. New customer controls

| Control | Settings tab / surface | Persistence |
|---------|----------------------|-------------|
| Business name, phone, address, directions, logo, brand color, prep instructions | Business profile | `PATCH /api/appointment-reminders/settings` (`businessDisplayName`, `businessPhone`, `businessAddress`, `reminderEmailBranding`, `reminderPreferences`) |
| Weekly business hours + timezone | Scheduling & rules | `weeklyHours`, `timezone` on platform config |
| Template library browse (all 306) | Templates | Read library API; apply via sequence editor / presets |
| Starter pack (industry, tone, timing) | Templates | `POST /api/appointment-reminders/settings/presets` |
| Default channel, confirmation skip, send test | Notifications & responses | `reminderPreferences` + `POST /api/appointment-reminders/reminders/test` |
| Microsoft calendar manage | Integrations | Existing calendar integration APIs |
| Engagement filters | Appointments | `engagement` query → in-memory filter on loaded rows |
| Email on appointment | Drawer → Preferences | `PATCH .../reminder-contact` (`email` field already supported) |
| Onboarding configure (business, industry, tone, schedule, channels) | Setup step 2 | Settings PATCH + presets POST |

---

## 5. Runtime wiring

- Business profile fields feed `merge-context` via existing `businessDisplayName`, `businessPhone`, `businessAddress`, branding URLs.
- `weeklyHours` consumed by reminder discovery / `shouldSkipStepNow` (skip outside hours — skipped, not delayed).
- Template library unchanged engine — browser is catalog UI only.
- Platform SMS lock still enforced in step editor and preview.

---

## 6. Onboarding

Step 2 is a **full form** (business, industry, tone, schedule preset, channels) with **live SMS preview**, not a single “apply starter pack” button.

---

## 7. Mobile / responsive

- Settings tab strip scrolls horizontally.
- Template browser stacks filter column on narrow viewports.
- Appointment sheet full width on mobile, wider on desktop.
- Appointments engagement tabs scroll horizontally.

---

## 8. Automated tests run

| Command | Result |
|---------|--------|
| `npm run test:ar-scheduling-policy` | PASS |
| `npm run test:ar-reminder-template-library` | PASS (306 templates) |

Full production build not re-run in this session (pre-existing TS noise in unrelated AR AI modules).

---

## 9. Remaining gaps (honest)

| Item | Notes |
|------|--------|
| Overview **Needs attention** dedicated table | KPIs + links exist; full 5-column attention table not added separately (data overlaps appointments `needs_attention` filter) |
| CSV import **3-step** wizard | Still single-sheet paste; backend import unchanged |
| **Recipient preference** searchable table in Settings | Links to Contacts; no duplicate AR contacts grid |
| **Tone** changing copy | Tone stored; library bodies are industry/message-type — not tone-variant text unless preset engine adds it |
| Apply template from browser **directly to a step** | Browser preview; “Use in reminder step” hook optional — apply via sequence editor industry/message type |
| Overview **product status strip** (calendar/SMS/email/activation/sync) | Partially covered by existing calendar panel + readiness pill; not a new 5-link strip component |
| **Drag-and-drop** sequence order | Not added (execution order remains timing-based) |

---

## 10. Governing doc

Customer UI coverage assessment (pre-pass): `docs/AR-51-CUSTOMER-UI-COVERAGE-ASSESSMENT.md`  
51-feature reconciliation: `docs/AR-51-FEATURE-RECONCILIATION-2026-10-10.md`
