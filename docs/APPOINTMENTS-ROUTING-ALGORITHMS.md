# Appointments Routing Algorithms

## Candidate filtering (all methods)

Routing never runs before eligibility. Candidates must pass:

1. Active staff in workspace
2. Assigned to service (`staffIds` / service eligibility)
3. Optional customer-selected staff lock
4. `filterStaffAvailableForSlot` at commit time: weekly hours, overrides, location, existing bookings, external calendar busy, resources, buffers, service phases (via shared staff-availability stack)

## Round Robin (Transovo default implementation)

**Definition:** *Least assigned in service window* using persistent counters, not strict A→B→C rotation.

- Key: `serviceName` in `platform.roundRobinState`
- For each assignment among slot-available pool: choose staff with minimum `counts[staffId]` (default 0)
- Tie-break: first staff in filtered pool iteration order (stable pool order from eligible list)
- On assign: increment selected staff count and persist `roundRobinState`
- Manual bookings: counted only if `staffRouting.countManualTowardBalance` (stored; runtime hook pending)
- Cancellations: counted only if `staffRouting.countCancelledTowardBalance` (stored; runtime hook pending)
- Reschedules: do not automatically decrement counts unless product policy added later
- Concurrent bookings: each assignment reads/increments state sequentially via platform save (revalidate slot before commit)

## Priority

**Definition:** Walk ordered staff ids; first who passes slot availability wins.

- Order: `svcCfg.staffPriorityOrder` → `staffRouting.workspaceStaffPriorityOrder` → `svcCfg.staffIds`
- Staff not in list appended after, in pool order
- Unavailable staff skipped; no fallback to ineligible staff

## Maximize availability (Least loaded — open slots)

Among slot-available staff, pick highest `countStaffOpenSlots` for next 14 local days.

## First eligible (`any_eligible`)

Among slot-available staff, return first in eligible list order.

## Customer chooses

If `preferredStaffId` set: only that staff if eligible and slot-available; routing algorithm not applied.

## Public "Any available"

Customer experience flag (`allowAnyAvailable` / workspace `customer_may_choose_or_any`). Slot pooling uses availability engine union of eligible staff; assignment uses service auto method at selected time.
