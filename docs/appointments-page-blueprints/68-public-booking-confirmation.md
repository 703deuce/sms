# Blueprint 68 — Public Booking Confirmation

**Surface:** `DoneStep` in public booking flow  
**Batch:** 8B-8

## Confirmation states

| State | Headline |
|-------|----------|
| confirmed | You're booked! |
| pending_approval | Request received |
| waitlist | You're on the waitlist |
| registered | You're registered (classes/events — future) |

## Data sources

- `createPlatformAppointment` → `pendingApproval`, `confirmationResources`, `manageUrl`, `meetingLink`
- Booking page / type `confirmationPage` overrides
- Client ICS download (no mock data)

## Actions

- Add to calendar (ICS)
- Manage booking (`manageUrl`)
- Join meeting (when link ready)
- Book another

## Remaining gaps

- Workshop/event dedicated confirmation surface (uses shared DoneStep until EVENT kind ships)
- Server-side ICS endpoint (optional; client ICS used today)
