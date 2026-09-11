# Team Booking Runtime Precedence

1. Resolve service config (`AppointmentTypeConfig`)
2. Detect team mode (`isTeamBookingEnabled`)
3. Build requirements list (explicit or legacy collective)
4. Eligible staff (`staffIds`, active)
5. Location filter (`filterStaffIdsForLocation`)
6. Per-requirement candidate pools (specific / any / scheduling group)
7. Per-candidate slot availability (`isStaffAvailableAtSlot` via `filterStaffAvailableForSlot`)
8. Resource checks (existing slot loop / booking commit `assertResourcesAvailable`)
9. External calendar busy (per staff)
10. Existing appointments (`AppointmentBusyIndex`, includes `teamStaffIds`)
11. Customer lead selection (`preferredLeadStaffId`)
12. Combination enumeration (distinct staff)
13. Routing load tie-break (round-robin counts)
14. Slot offered / booking commit
15. Metadata persistence + calendar sync (primary path unchanged for secondary calendar events)
