# Resource capacity algorithm

## Capacity source

`SchedulingResource.quantity` (integer ≥ 1). Inactive resources fail `areResourcesAvailableForSlot`.

## Required quantity per booking

Currently **1 unit per resource id** per service line. Multiple resources on a service = AND across ids. Multi-unit per booking (e.g. couples = 2 tables) is **not** stored on the line; would require repeated ids or a quantity field (GAP).

## Overlap detection

```text
used = count(lines where resourceId ∈ line.resourceIds
  AND line.startsAt < endsAt
  AND line.endsAt > startsAt
  AND appointmentId != excludeAppointmentId)
available = quantity - used
ok = used < quantity
```

## Cancelled appointments

Lines remain if not deleted; cancelled appointments should not contribute once lines are removed or appointment is excluded from active booking flows. Operational data may still show historical lines on resource detail.

## Reschedule

Exclude current `appointmentId` during assert; then update line timestamps to new window.

## persistAppointmentResources order

1. `deleteMany` for `appointmentId`
2. `assertResourcesAvailable` (with exclude = same appointment)
3. `create` line with `resourceIds`

## Concurrency

- **Per slot:** `pg_advisory_xact_lock` on `(workspaceId, serviceName, startsAt)` in `withAtomicSlotBooking`.
- **Per resource:** assert is read-count-write without row lock; two different services booking the same resource at the same instant may race until assert fails on second commit (GAP for strict resource-serialization).

## Peak usage guard (admin)

`maxConcurrentResourceUsage` sweep-line algorithm blocks capacity reduction when `peak > newQuantity` unless `forceCapacity`.
