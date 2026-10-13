# Unified Appointments — New UI2 migration (one-page status & contract)

**Last updated:** 2026-10-13  
**Branch:** `cursor/unified-appointments-restore-f350`  
**PR:** https://github.com/703deuce/sms/pull/655 — **do not merge until complete**

**Product rule:** Do **not** remove, defer, disable, or reduce any existing Scheduling functionality during this migration. Keep **everything** for now. Simplify the product only **after** the full New UI2 migration is finished and verified.

**Status:** **INCOMPLETE** — execution contract approved; implementation in progress.

---

## 1. Objective (one complete assignment)

Deliver **one** Unified Appointments application with:

- One dark **New UI2 Opus** application shell
- One unified, **collapsible** navigation (`buildUnifiedAppointmentsNav()`)
- Opus **calendar** as product home, **Agenda** default
- Every retained admin page rebuilt with **native New UI2** components (not wrappers)
- Every editor, drawer, dialog, form, table, and config screen in New UI2
- All existing **backend** capability preserved and connected
- **No** legacy Kimi frontend rendered in unified mode (`UNIFIED_APPOINTMENTS=1`)
- **No** unfinished placeholders or links to unmigrated legacy UIs

Internal commits are fine. **Do not** declare completion or merge the PR until the full release gate below is satisfied.

**Not acceptable as final UI:**

- `SchedulingOpusBody` / `SchedulingOpusEmbed` around legacy clients
- `OpusDataSurface` containing old Kimi UI
- `scheduling-opus-scope` CSS hiding duplicate headers
- Opus headers above legacy forms/tables only
- Nav hubs that link to unmigrated pages
- `opus_partial` or `legacy_kimi` relabeled as complete

**Allowed:** Reuse nonvisual hooks, API clients, domain types, business logic. Legacy **source files** may remain in the repo for rollback; they must **not** be in the unified **render tree**.

---

## 2. Completion gate (all must be true)

### Visual & routing

1. Every retained route under `/appointments/**`, `/appointment-reminders/**`, and unified-nav-linked platform routes uses **native New UI2** visuals — including dynamic routes, detail pages, nested editors, modals, drawers, configuration screens.
2. **Zero** `opus_partial` and **zero** `legacy_kimi` in `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md` for retained routes (no matrix exclusions to hide unfinished work).
3. No Kimi/Scheduling visual shells in unified mode.
4. No `SchedulingOpusBody`, `SchedulingOpusEmbed`, or `scheduling-opus-scope` (or equivalent) in the rendered unified frontend.
5. One dark Opus shell + unified nav on all unified scheduling surfaces.

### Functional parity

6. Every original field, action, validation, filter, sort, bulk action, status change, export, permission, and workflow on each retained page remains available in the new UI. No placeholder controls; no links to unmigrated legacy pages.

### Backend

7. All backend capabilities preserved; connected pages use real APIs (no mock data).

### Verification

8. **Recursive visual dependency audit:** `npx tsx scripts/audit-unified-legacy-visual-imports.ts` exits **0** (transitive `@/` imports from each route’s Opus entry — not just `page.tsx` direct imports).
9. **Production build** succeeds (`npm run build` or CI).
10. **Browser verification** of rendered pages and critical interactions (forms, drawers, workflows, responsive). Blocked checks recorded as **incomplete**, not passed.
11. `docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json` updated as work proceeds; a route is complete only when New UI2 is implemented, backend-connected, and functionally verified.

---

## 3. Authoritative docs & commands

| Resource | Path |
|----------|------|
| Execution contract (full) | `docs/UNIFIED-APPOINTMENTS-MIGRATION-EXECUTION-CONTRACT.md` |
| Feature overlap audit | `docs/UNIFIED-APPOINTMENTS-FEATURE-OVERLAP-AUDIT.md` |
| Migration matrix | `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md` |
| Sidebar inventory | `docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md` |
| Machine checklist | `docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json` |

```bash
npx tsx scripts/audit-unified-legacy-visual-imports.ts
npx tsx scripts/generate-unified-migration-remaining-checklist.ts
npx tsx scripts/generate-unified-frontend-migration-matrix.ts
npm run build
```

---

## 4. Current metrics (honest snapshot)

| Metric | Value |
|--------|--------|
| Retained admin `page.tsx` routes (`/appointments` + `/appointment-reminders`) | **117** (93 + 24) |
| Routes claimed **verified native** in checklist (grows as work lands) | **11** (see checklist JSON) |
| Routes still pending full native + verification | **~106** |
| Matrix nav rows (approx.) | **~12** Opus complete · **~39** Opus partial · **~26** Legacy Kimi |
| Transitive legacy visual audit | **FAIL** — ~**39** routes with violations, ~**47** unique files |
| Production build (recent agent run) | **Not run** |
| Browser verification (recent agent run) | **Not run** |
| PR merge | **Blocked** |

Regenerate checklist for latest numbers:

```bash
npx tsx scripts/generate-unified-migration-remaining-checklist.ts
```

---

## 5. What was wrong before (why screenshots looked broken)

- Two shells: dark Opus on some routes vs gray legacy sidebar on others (unified flag / nav split).
- “Opus migration” often meant: **nav + Opus page header + legacy Kimi body** (`SchedulingOpusBody`, scope CSS).
- Classes/workshops still used `ClassesWorkspaceConnected` / pilot CSS (`appt-overview-pilot`, `reference.css`).
- Detail pages, editors, forms, wizards largely **not** migrated.
- Partial passes reported as “shipped” while matrix still showed `opus_partial`.

---

## 6. Recent implementation (same assignment, not “done”)

On branch `cursor/unified-appointments-restore-f350` (PR #655):

**Enforcement**

- Execution contract + **transitive** legacy visual audit script
- Checklist generator with per-route status and audit summary

**Native New UI2 (examples — not the whole product)**

- `/appointments/team-booking` → `src/newui-transplant/connected/scheduling/team-booking-opus.tsx` (full section parity; `useTeamBookingWorkspace` only — no `TeamBookingWorkspaceConnected`)
- Contact merge → `contact-merge-opus.tsx` with `ArOpusPage` (no `SchedulingOpusBody`)

**Still wrapper / legacy heavy**

- `scheduling-admin-surfaces-opus.tsx` (many routes still legacy clients inside Opus chrome)
- `classes-workspace-opus.tsx` / `workshops-workspace-opus.tsx` (still embed connected Kimi workspaces)
- Analytics shells, AR calendar partials, most commerce/admin clients, all staff/location/package **detail** routes, workflow editor, forms builder, etc.

---

## 7. Audit failure categories (typical)

When `audit-unified-legacy-visual-imports.ts` fails, common reasons:

| Reason | Meaning |
|--------|---------|
| `kimi-ui-visual-tree` | Import under `components/appointments/kimi-ui/` |
| `kimi-connected-shell` | `features/appointments/kimi/*-connected` |
| `kimi-pilot-css` | Pilot/reference CSS from Kimi UI |
| `pilot-shell-class` | `appt-overview-pilot`, `bookable-workspace-pilot`, `ws-pilot` |
| `legacy-workspace-connected` | `*WorkspaceConnected` / team-booking legacy shell |
| `scheduling-opus-body-wrapper` | `SchedulingOpusBody` |
| `forbidden-wrapper-module` | `scheduling-opus-body.tsx`, `scheduling-opus-embed.tsx` |

Goal: **exit code 0** for the entire route inventory.

---

## 8. Route coverage scope (must all finish)

**Calendar** — Opus calendar, Agenda default; quick create, native detail, edit/reschedule, drag, recurring scope, waitlist, filters, imported events — no legacy calendar drawer in unified mode.

**Appointments** — List, create, detail, edit, cancel, reschedule, service/meeting context, staff/location/resource, intake/documents, payments, class/workshop enrollment, recurring, reminder/response history.

**Booking** — Hub, services/meetings editors, classes/workshops + editors/enrollment, booking pages, branding/share, team booking, team pages, routing forms, polls, AI booking, forms/contracts, categories/restrictions.

**Availability** — Schedules, staff/locations/resources + editors, routing rules, restrictions, capacity/conflicts.

**Clients** — Directory, detail, segments, contact merge, restrictions, history.

**Messages** — Inbox, appointment responses, conversation detail (New UI2; entitlements preserved).

**Reminders** — Overview, activity, sequences, templates, voice reminders + editors.

**Workflows** — List, create, editor, templates, activity, automation config (engine unchanged).

**AI Rescheduler** — Keep Opus; align related settings/dialogs.

**Commerce** — Hub, packages/memberships + editors, pricing/POS/coupons/categories, payment plans, balances, commerce detail screens; Stripe/Square logic unchanged.

**Analytics** — AR + scheduling analytics, commerce/service reports, filters/exports.

**Integrations** — Calendar connections, M365/Google, directory, scheduling integrations, disconnect/status.

**Settings** — Scheduling, business, policies, notifications, setup, enterprise, related editors.

Plus **every nested** `/appointments/**/[id]`, `.../new`, `.../edit`, builder, and wizard route in the repo tree — not only the 13 top-level nav items.

---

## 9. Reference pattern for native bookables

Use **`ar-meetings-workspace-opus.tsx`** / **`ar-services-workspace-opus.tsx`** / **`staff-directory-opus.tsx`**:

- `ArOpusPage`, `PageHeader`, `Panel`, `OpusDataSurface`, New UI2 `Button`/`Tabs`
- Data hooks from `features/appointments/kimi/**/use-*` or APIs
- Section editors may use shared section components + Opus CSS skin (e.g. `ar-services-editor-opus.css`) — **not** full Kimi pilot shell

---

## 10. Final report template (use only when §2 is satisfied)

- Total retained administration routes: ___
- Total fully migrated + verified routes: ___
- Total remaining legacy visual routes: **0**
- Editors/drawers/dialogs migrated: ___
- Missing functional capabilities: **none** (or list)
- `audit-unified-legacy-visual-imports.ts`: **PASS**
- Tests: ___
- `npm run build`: **PASS**
- Browser verification: **PASS** (or blocked: ___)
- PR merge: approved only after above

Until then, state clearly: **Migration incomplete.**

---

## 11. Copy-paste summary for stakeholders

We are executing **one** full frontend migration of Unified Appointments to New UI2 Opus — not phased “slices.” We are **not** removing Scheduling features during the rebuild. Completion requires native UI on every retained route, functional parity, transitive legacy-import audit at zero, production build, and browser verification. PR #655 stays open. Current state: ~117 route pages, transitive audit **failing** (~47 legacy-touched files in Opus trees), majority of admin surfaces still partial or legacy. Team booking and contact-merge chrome are early native wins; most of booking, commerce, analytics, calendar, and all detail/editor routes remain.
