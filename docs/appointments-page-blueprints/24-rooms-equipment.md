# Page Blueprint — Rooms & Equipment (Batch 8B-1)

**Route:** `/appointments/booking/rooms-equipment`  
**Primary user job:** Tell Transovo which physical rooms and equipment bookings require.

## Structure

1. **Items** — table: Name, Type, Quantity, Used by, Status, Actions
2. **Groups** — resource pools (`resource-pools.ts`)

## Backend

- Items: `resources.ts`, `SchedulingResource.quantity`
- Groups: `resource-pools.ts`
- Availability: `resource-availability.ts` (runtime)

## Contextual create

- From Service editor: `ServiceResourceQuickCreate` (name, type, location, quantity) → auto-select, preserve draft

## Status

ABSORBED_CANONICAL_UI for items table, groups, quantity edit. STILL_MISSING: full edit drawer with location picker on main page; group "Used by" column; location-contextual create from Locations page.

## Absorbed from

- `/appointments/resources` parity admin
