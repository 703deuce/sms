# Team Booking Assignment Algorithm

## 1. Requirement resolution

- Source: `teamBooking.requirements` on service, or legacy `collectiveStaffIds` synthesized as required specific-staff roles.
- Templates: optional `teamBooking.templateId` → `platform.teamBookingTemplates`.
- Eligibility: canonical `resolveEligibleStaff` (service `staffIds`), then location filter, then per-requirement pool rules.

## 2. Per-slot candidate generation

For each requirement at `(startsAt, endsAt)`:

- Build candidate staff ids (specific / any eligible subset / scheduling group pool).
- Filter with `filterStaffAvailableForSlot` (hours, bookings, external calendar, buffers).

## 3. Combination search

- `enumerateValidCombinations` backtracks over **required** requirements.
- **Distinct staff:** same person cannot fill two required roles unless optional duplicate rules added later.
- Fixes greedy failure: Role A {Sarah, James}, Role B {Sarah} → James+Sarah.

## 4. Lead constraint

- `preferredLeadStaffId` fixes primary requirement before search.

## 5. Tie-break among valid combinations

- Sum of per-service round-robin `counts` for assigned staff; pick lowest total (reuses routing state, not a second routing engine).

## 6. Slot generation

- Team-enabled services: slot offered only if `resolveTeamAtSlot` returns non-null.

## 7. Booking commit

- `createPlatformAppointment` re-runs `resolveTeamAtSlot`; throws if no team.
- Persists `teamStaffIds`, `teamAssignments`, `primaryStaffId` (+ `staffId` = primary).

## 8. Concurrency

- Existing atomic slot booking + busy index; team members indexed on `teamStaffIds` for conflicts.

## Not yet implemented

- Phase-specific participation windows
- Reschedule team preservation/replacement policy
- Per-staff calendar event creation audit for all team members
