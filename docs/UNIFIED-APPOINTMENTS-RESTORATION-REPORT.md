# Unified Appointments restoration — implementation report

**Date:** 2026-10-13  
**Branch:** `cursor/unified-appointments-restore-f350`

## What shipped (Phase 1 + audit)

### Navigation

- **Single shell:** `appointment_reminders` (no second product switcher entry).
- **Merged sidebar:** `buildUnifiedAppointmentsNav()` = full AR tree + full `buildAppointmentsV1Nav()` with scheduling modules enabled (workflows, meetings, classes, commerce).
- **Flags:** `isUnifiedAppointmentsExperience()` — on by default when `APPOINTMENT_REMINDERS_V1_PRIMARY` and not `APPOINTMENTS_V1_PRIMARY`; override with `UNIFIED_APPOINTMENTS=0|1`.
- **AR booking nav:** visible in unified mode (`appointmentRemindersHideBookingNav()` false).
- **Extended scheduling children:** staff, restrictions, categories, coupons, service-booking hub, setup, policies, enterprise, scheduled list, new appointment, recall campaigns, no-show recovery.

### Routing / chrome

- `/appointments/**`, `/meetings`, `/video`, `/payments` (and shared messaging paths) resolve to **AR shell** with unified nav when unified mode is on.
- New UI shell enabled for `/appointments/**` under unified mode.
- Access guards allow `/appointments` platform paths without SMS entitlement bounce (same as appointments-primary).
- Product label in switcher context: **Appointments** (not “Appointment Reminders”) when unified.

### Docs

- `docs/SCHEDULING-PLATFORM-INVENTORY-AUDIT.md` — read-only inventory (from audit).
- `docs/UNIFIED-APPOINTMENTS-CALENDAR-SYNC-AUDIT.md` — answers to the 10 sync questions with code pointers.

## Automated check

```bash
npx tsx -e "
import { collectNavHrefs } from './src/lib/nav.ts';
import { buildUnifiedAppointmentsNav } from './src/lib/products/unified-appointments-nav.ts';
console.log('href count', collectNavHrefs(buildUnifiedAppointmentsNav()).length);
"
```

**Result:** 84 distinct hrefs in merged nav (run on 2026-10-13).

## Calendar sync (Phase 2 — audit only, no pipeline rewrite)

See `docs/UNIFIED-APPOINTMENTS-CALENDAR-SYNC-AUDIT.md`.

**Native create → Outlook/Google:** supported via `bookAppointment` when calendar connected.  
**AR async write-back:** Microsoft-only today.  
**Import + dedupe:** `import-sync.ts`.  
**G↔O direct:** not implemented.

## Remaining gaps / not validated in this pass

- Browser smoke of every restored page (Phase 3–4).
- Google AR write-back parity with Microsoft.
- End-to-end Microsoft OAuth + create-in-Transovo + appear-in-Outlook (requires manual OAuth).
- Per-workspace `schedulingModules` from DB not yet wired into unified nav (uses full unified defaults).

## Files touched

- `src/lib/products/unified-appointments.ts`
- `src/lib/products/unified-appointments-nav.ts`
- `src/lib/products/resolve-product-nav.ts`
- `src/lib/products/product-shell.ts`
- `src/lib/products/appointments-routes.ts`
- `src/lib/products/access-guards.ts`
- `src/lib/products/newui-shell.ts`
- `src/lib/products/appointments-nav.ts`
- `src/lib/appointment-reminders/ar-launch-nav.ts`
- `src/newui-transplant/lib/nav.ts`
- `src/components/layout/app-shell.tsx`
