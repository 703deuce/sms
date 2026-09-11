# Resource occupancy interval

## Default (whole appointment)

- **Source:** `appointmentServiceLine.startsAt` / `endsAt` for each line where `resourceIds` contains the resource.
- **Slot offer:** Full service duration from `voiceService.durationMinutes` (or phase-resolved duration when phases enabled).
- **Consumption:** `countResourceUsage` counts overlapping lines where `startsAt < windowEnd && endsAt > windowStart`.

## Service phases

When `ServicePhaseTemplate` rows exist with `resourceIds`, `service-phases.ts` calls `assertResourcesAvailable` per phase window (phase start + `durationMinutes`). Occupancy for enforcement during phased booking follows those intervals, not necessarily the full appointment length.

## Buffers

Staff/service buffers apply in availability engine; resource overlap uses line times only (buffers not automatically added to resource lines unless line times include them).

## Pools

- **Quantity pool:** One `SchedulingResource` id; `quantity` caps concurrent overlapping lines referencing that id.
- **Member pool (`SchedulingResourceGroup`):** Booking stores concrete member id(s) after `resolveResourcePool`; each member is `quantity: 1` typically.

## Allocation timing

- **Slot display:** All configured `resourceIds` on the service must pass `areResourcesAvailableForSlot`.
- **Commit:** `assertResourcesAvailable` then `persistAppointmentResources` writes lines.
- **Pool `any_one`:** Member chosen at pool resolution time (commit path using `resolveResourcePool`).
