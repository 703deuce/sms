# Unified Appointments — complete New UI2 migration (execution contract)

**Status:** IN PROGRESS — not complete until every item in §10 of this document is true.

**Branch:** `cursor/unified-appointments-restore-f350` / open PRs on unified appointments work.

## Non-negotiable completion definition

The migration is **complete** only when:

1. Every retained Unified Appointments administration route renders **native New UI2** visual components.
2. Every editor, detail page, form, drawer, modal, and dialog is migrated.
3. No Kimi/Scheduling **visual** shells render in unified mode (`UNIFIED_APPOINTMENTS=1`).
4. No `SchedulingOpusBody`, `SchedulingOpusEmbed`, or `scheduling-opus-scope` CSS hiding legacy chrome.
5. All backend capabilities remain wired; no mock data on connected pages.
6. One dark Opus shell + `buildUnifiedAppointmentsNav()` everywhere for `/appointment-reminders/**` and `/appointments/**`.
7. Migration matrix has **zero** `opus_partial` or `legacy_kimi` for retained routes.
8. `scripts/audit-unified-legacy-visual-imports.ts` reports **zero** violations on gated route entrypoints.

Partial wrapper passes, nav-only changes, and “pick another cluster” are **not** acceptable stopping points.

## Authoritative inventories

- `docs/UNIFIED-APPOINTMENTS-FEATURE-OVERLAP-AUDIT.md`
- `docs/UNIFIED-APPOINTMENTS-FRONTEND-MIGRATION-MATRIX.md` (regenerate after changes)
- `docs/UNIFIED-APPOINTMENTS-SIDEBAR-MENU.md`
- `docs/UNIFIED-APPOINTMENTS-MIGRATION-REMAINING-CHECKLIST.json` (machine checklist)

## Verification commands

```bash
npx tsx scripts/audit-unified-legacy-visual-imports.ts
npx tsx scripts/generate-unified-frontend-migration-matrix.ts
npm run build   # when environment allows
```

## Internal staging (not user-facing “done”)

Engineering may land work in commits, but **PR merge** waits for the full contract above.
