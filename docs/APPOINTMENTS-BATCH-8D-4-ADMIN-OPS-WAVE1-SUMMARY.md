# Batch 8D-4 — Operations / Admin Residual Completion (Wave 1)

**Date:** 2026-09-10  
**Branch:** `cursor/batch8d4-admin-ops-wave1-709b`  
**Base:** Batch 8D-3 post-absorption ledger (89 `V1_ADMIN_UI_GAP`)

## Admin gap summary

| Metric | Value |
|--------|-------|
| Starting `V1_ADMIN_UI_GAP` | 89 |
| Rows in this batch (operational cluster) | 27 |
| Resolved (`V1_COMPLETE`) | 25 |
| Reclassified | 0 |
| Ending `V1_ADMIN_UI_GAP` | **64** |

Two batch rows were not counted in the starting 89 (`1-1`, `10-5` were `V1_MOCK_OR_PLACEHOLDER`); both are now `V1_COMPLETE`.

### Batch worksheet (all closed)

| ID | Surface | Feature / gap | New status |
|----|---------|---------------|------------|
| 1-1 | Overview | Date picker → calendar deep link; KPIs from overview API | V1_COMPLETE |
| 2-8 | Calendar | Staff/service colors + filter drawer | V1_COMPLETE |
| 2-9 | Calendar | Drag-reschedule with PATCH validation | V1_COMPLETE |
| 2-11 | Calendar | Availability overlay toggle + unavailable blocks | V1_COMPLETE |
| 4-14 | Calendar | Consumes authoritative staff/service color config | V1_COMPLETE |
| 6-7 | Calendar / List | Reschedule via calendar drag + list availability modal | V1_COMPLETE |
| 6-1 | Appointments list | Pending approval tab + approve/decline | V1_COMPLETE |
| 3-2 | Appointment detail | Recurring series section | V1_COMPLETE |
| 3-3 | Appointment detail | Service phases timeline | V1_COMPLETE |
| 3-4 | Appointment detail | Resource labels + group/requirement display | V1_COMPLETE |
| 6-9 | Appointment detail | Internal notes panel | V1_COMPLETE |
| 6-11 | Appointment detail | Reminder schedule timeline | V1_COMPLETE |
| 6-13 | Appointment detail | Multi-service lines | V1_COMPLETE |
| 6-14 | Appointment detail | Policy snapshot at booking | V1_COMPLETE |
| 11-7 | Appointment detail | Per-appointment reminder timeline | V1_COMPLETE |
| 3-8 | Waitlist | Priority rules settings panel | V1_COMPLETE |
| 3-9 | Waitlist | Priority rank in admin table | V1_COMPLETE |
| 7-20 | Waitlist | Offer accept / notify flow | V1_COMPLETE |
| 9-10 | Waitlist | Class capacity-full waitlist entries | V1_COMPLETE |
| 10-1 | Waitlist | Admin queue | V1_COMPLETE |
| 10-2 | Waitlist | Public-joined entries visible in admin | V1_COMPLETE |
| 10-3 | Waitlist | Preferences (staff/date/time) in row | V1_COMPLETE |
| 10-4 | Waitlist | Send offer + notification runtime | V1_COMPLETE |
| 10-5 | Waitlist | Offer modal with slot picker + expiry | V1_COMPLETE |
| 10-6 | Waitlist | Auto-fill semantics label from settings | V1_COMPLETE |
| 10-7 | Waitlist | Party size column + capacity validation | V1_COMPLETE |
| 10-8 | Waitlist | Priority rules panel | V1_COMPLETE |

## Calendar

**Completed:** filter drawer (staff, booking types, locations, status), active filter count, staff/service color resolution from settings + types, availability overlay from weekly hours, drag-reschedule via `PATCH /api/appointments/:id`, recurring/class badges, unavailable blocks, deep link `?date=YYYY-MM-DD`.

**Backend:** `/api/calendar/events`, `/api/appointments/settings`, `/api/appointments/types`, availability engine for overlay.

**Remaining (not in batch):** external calendar busy blocks (provider sync not wired to calendar events API) — classify in a future wave if a ledger row appears.

## Appointments list

**Completed:** `pendingApproval=1` API filter, Pending approval tab, approve/decline via `POST /api/appointments/booking/approval`, row quick actions, reschedule modal uses `/api/appointments/availability`.

**Remaining:** bulk export/status change only if future ledger rows require and backend supports.

## Appointment detail

**Completed:** real customer initials (no hardcoded avatar), service phases, resources, add-ons, recurring, policy snapshot, payment summary, terms, package/membership/credit display, approval actions, reminder timeline, internal notes, activity from metadata timeline.

**Backend:** enriched `getAppointment()` in `appointments-service.ts`.

**Remaining:** `paymentsConnected` / `videoProvisioned` still optimistic defaults when provider state unavailable — no new ledger row this batch.

## Waitlist

**Completed:** priority rank column, priority settings panel (`/api/appointments/service-booking/waitlist-priority`), offer modal with slot selection, auto-fill label from `waitlistAutoFill` setting, party size, offer expiry display.

**Backend:** `waitlist.ts`, `waitlist-priority.ts`, `autoFillWaitlistSlot` semantics surfaced in UI.

## Overview

**Completed:** date button opens native date picker → navigates to `/appointments/calendar?date=`; KPIs already from `/api/appointments/overview` and `/api/appointments/analytics`.

## Files touched (high level)

- `src/features/appointments/kimi/calendar/*`
- `src/components/appointments/kimi-ui/calendar/*`
- `src/features/appointments/kimi/list/list-connected.tsx`
- `src/components/appointments/kimi-ui/list/*`
- `src/features/appointments/kimi/detail/map-detail.ts`
- `src/components/appointments/kimi-ui/detail/*`
- `src/components/appointments/kimi-ui/waitlist/*`
- `src/features/appointments/kimi/overview/*`
- `src/components/appointments/kimi-ui/overview/page.tsx`
- `src/lib/appointments/appointments-service.ts`
- `src/lib/calendar/workspace-calendar-events.ts`
- `src/app/api/appointments/route.ts`
- `scripts/reconcile-appointments-batch8c.mjs`

## Validation

- `node scripts/reconcile-appointments-batch8c.mjs` — PASS (64 admin gaps remaining)
- Appointments-related `tsc` — no errors in touched files
- Browser UAT / production certification — **not run** (per batch scope)

## Next wave (8D-5)

Group remaining 64 `V1_ADMIN_UI_GAP` rows by domain from the regenerated ledger — do not assume page ownership from stale counts.
