# Resource runtime precedence (traced)

Public / admin slot list (`listNativeSlotsForBooking` in `booking-platform.ts`):

1. Load platform + service config
2. `generateNativeSlots` (staff, location hours, blackouts, external calendars, `excludeAppointmentId`)
3. Resolve `resourceIds` from `voiceService.config.resourceIds`
4. `filterResourceIdsForLocation` when `locationId` set
5. `filterSlotsByResourceAvailability` per remaining slot window

Booking commit (`createPlatformAppointment`):

1. Service / duration / approval / OTP gates
2. Compute `startsAt` / `endsAt`
3. `resolveResourceIdsForBookingType` (+ explicit `input.resourceIds`)
4. `assertResourcesAvailable` (optional `excludeAppointmentId`)
5. Team booking OR staff assignment (staff availability)
6. Contact + appointment row
7. `persistAppointmentResources` (delete lines for appointment → assert → insert line)

Shared slot gate (`assertSlotAvailableForBooking`):

1. Blackout / notice / max days
2. Staff conflict check on `voiceAppointment`
3. Regenerate slots (with exclude) + **resource filter**
4. Booking limits + group capacity

Reschedule (`reschedulePlatformAppointment`):

1. `withAtomicSlotBooking` + `assertSlotAvailableForBooking` (includes resources)
2. `assertResourcesAvailable` with exclude
3. Update appointment times + `appointmentServiceLine` times

Resource admin test (`testResourceAvailability`):

- Uses `countResourceUsage` + `areResourcesAvailableForSlot` (same as slot filter).
