# Unified Appointments — complete New UI2 migration (execution contract)

**Status:** IN PROGRESS — not complete until every gate in §10 is satisfied.

**Branch:** `cursor/unified-appointments-restore-f350` (PR open until full migration + release gate).

**Product rule:** Do **not** remove, defer, disable, or reduce any existing Scheduling functionality during this migration. Parity first; simplification only after New UI2 is complete.

## Non-negotiable completion definition

The migration is **complete** only when **all** of the following are true:

### Visual & routing

1. Every **retained** Unified Appointments route (`/appointments/**`, `/appointment-reminders/**`, and unified-nav-linked platform routes) renders **native New UI2** visual components — including dynamic routes, detail pages, nested editors, modals, drawers, and configuration screens.
2. **Zero** `opus_partial` and **zero** `legacy_kimi` rows in `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md` for retained routes (no matrix exclusions to hide unfinished work).
3. No Kimi/Scheduling **visual** shells render in unified mode (`UNIFIED_APPOINTMENTS=1`).
4. No `SchedulingOpusBody`, `SchedulingOpusEmbed`, or `scheduling-opus-scope` (or equivalent CSS disguises) in the **rendered** unified frontend.
5. One dark Opus shell + `buildUnifiedAppointmentsNav()` on all unified scheduling surfaces.

### Functional parity

6. **Functional parity:** Every original field, action, validation, filter, sort, bulk action, status change, export, permission, and workflow on each retained page remains available through the new UI. No placeholder controls, no links to unmigrated legacy pages.

### Backend & data

7. All backend capabilities preserved; connected pages use real APIs (no mock data).
8. Nonvisual hooks, domain types, and API clients may be reused; **legacy visual modules must not appear in the unified render tree**.

### Verification

9. **Recursive visual dependency audit:** `npx tsx scripts/audit-unified-legacy-visual-imports.ts` exits **0** — inspects **transitive** `@/` imports from each route’s Opus entry, not only `page.tsx` direct imports.
10. **Production build** succeeds (`npm run build` or CI equivalent) in a provisioned environment.
11. **Browser verification** of rendered pages and critical interactions (forms, drawers, workflows, responsive layout). Any blocked verification is recorded as **incomplete**, not passed.
12. `docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json` updated as work proceeds; a route is **complete** only when New UI2 is implemented, backend-connected, and functionally verified.

### Legacy source in repo

13. Old frontend **files** may remain in the repository for rollback/comparison; they must **not** be imported by the unified product render tree.

Partial wrapper passes, nav-only changes, and “pick another cluster” are **not** acceptable stopping points.

## Authoritative inventories

- `docs/UNIFIED-APPOINTMENTS-FEATURE-OVERLAP-AUDIT.md`
- `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md`
- `docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md`
- `docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json`

## Verification commands

```bash
npx tsx scripts/audit-unified-legacy-visual-imports.ts
npx tsx scripts/generate-unified-migration-remaining-checklist.ts
npx tsx scripts/generate-unified-frontend-migration-matrix.ts
npm run build
```

## PR / merge

Do **not** merge until §10 is fully satisfied. Internal commits are fine; the unit of completion is the **entire application**.
