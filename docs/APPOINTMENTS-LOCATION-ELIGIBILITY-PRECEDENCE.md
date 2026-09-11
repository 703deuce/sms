# Location Eligibility Precedence

Traced from `availability-engine.ts` and `location-scheduling.ts`.

1. **Service offered at location** — `locationOffersType` / service `locationIds` (empty = all active locations).
2. **Staff at location** — `filterStaffIdsForLocation` when `locationId` set on slot request.
3. **Weekly hours** — `resolveLocationWeeklyHours(locationId)` else named schedule else platform hours.
4. **Date overrides** — platform `dateOverrides` applied in engine.
5. **Staff availability / calendars** — staff-availability layer after hours window.
6. **Resources** — `filterResourceIdsForLocation` when resources required.
7. **Routing / team booking** — candidate staff filtered by location in routing simulators.

Final slot = intersection of all layers; location hours alone do not guarantee a slot.
