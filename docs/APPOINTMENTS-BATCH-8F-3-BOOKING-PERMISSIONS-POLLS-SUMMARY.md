# Appointments Batch 8F-3 — Booking Permissions + Meeting Polls Summary

**Date:** 2026-09-10  
**Branch:** `cursor/batch8f3-booking-permissions-polls-709b`

## Starting state (post-8F-2)

| Metric | Count |
|--------|------:|
| 8F-3 rows | 1 (`15-7`) |
| V1_ADMIN_UI_GAP | 1 |
| V1_CONTEXTUAL_FLOW_GAP | 1 (`3-20`) |
| V1_BACKEND_GAP | 0 |

## Rows resolved

| ID | Feature | Implementation |
|----|---------|----------------|
| **15-7** | Meeting polls (per-type permissions) | Per-type **Team access** editor on booking type editor; Meeting Poll create requires authorized Meeting Type; poll list/edit/finalize/delete server authorization |

## Per-type permissions

- **Model:** existing `config.permissions[]` on appointment types (`EventTypePermission` with `userId`)
- **UI:** `TypePublishingSections` — everyone vs selected team members (name, email, role); self-lockout warning
- **Placement:** Booking Type editor → Team access section
- **Team vs Staff:** Team users from `/api/team`, not bookable Staff profiles
- **Global interaction:** `canAccessEventType` / `assertEventTypeAccess` — owner bypass; empty permissions = everyone with global permission
- **Default:** empty `permissions` preserves backward-compatible open access

## Meeting polls

- **Meeting type selector:** `CreatePollModal` loads `GET /api/appointments/meeting-polls?eligibleMeetingTypes=1`
- **Ownership/visibility:** workspace-scoped polls filtered by linked Meeting Type edit access (no separate poll ACL)
- **Server authorization:** `meeting-poll-access.ts` + `requireAppointmentsAccess` on poll routes
- **Finalization:** `finalizeMeetingPollBooking` → `createPlatformAppointment` with poll winning option
- **Public participants:** unchanged — admin permission changes do not alter public vote endpoints

## Ending state

| Metric | Count |
|--------|------:|
| V1_ADMIN_UI_GAP | 0 |
| V1_CONTEXTUAL_FLOW_GAP | 1 (`3-20` → 8F-4) |
| V1_BACKEND_GAP | 0 |
| Residual implementation rows | 1 |

## Key files

- `src/components/appointments/kimi-ui/appointment-types/components/TypePublishingSections.tsx`
- `src/lib/appointments/meeting-poll-access.ts`
- `src/lib/appointments/meeting-polls.ts`
- `src/app/api/appointments/meeting-polls/route.ts`
- `src/components/appointments/kimi-ui/meeting-polls/components/CreatePollModal.tsx`
- `scripts/test-batch8f3-booking-permissions-polls.ts`

## Verification

```bash
npx tsx scripts/test-batch8f3-booking-permissions-polls.ts
node scripts/reconcile-appointments-batch8c.mjs
```
