# Appointments Routing Precedence (runtime)

Actual order as implemented in `scheduling-domain.ts`, `availability-engine.ts`, `staff-availability`, and public book route:

1. Resolve service / meeting type and `AppointmentTypeConfig`
2. Active staff filter (`platform.staff`)
3. Service staff eligibility (`staffIds`, collective ids)
4. Customer-selected staff id/name (if `customer_chooses` and preference present)
5. Location constraints (staff `locationIds`, service `locationIds`, booking location)
6. Weekly hours, date overrides, blackouts, notice windows (availability engine)
7. External calendar busy intervals
8. Existing appointments, buffers, service phase occupancy (staff-availability)
9. Required resources and capacity (engine + group capacity checks)
10. Booking limits
11. Routing policy: `staffAssignment` / workspace default decode
12. Algorithm tie-break (RR counts, priority order, open-slot counts, list order)
13. Transactional revalidation at booking commit (`resolveStaffForBooking` with slot context)
14. Persist assignment (`metadata.staffId`, appointment row)
15. Round-robin counter increment when method is `round_robin`

**Not in staff routing path:** `routingRules` (appointment type from answers) runs earlier in public book for type selection only.
