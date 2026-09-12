# Calendar navigation return context

When the operational Calendar launches a deeper screen, it passes an internal `returnTo` query parameter.

## Allowed destinations

`sanitizeReturnTo()` only permits paths under:

- `/appointments/calendar`
- `/appointments/overview`
- `/appointments/scheduled`
- `/appointments/waitlist`
- `/conversations`
- `/appointments/clients`
- `/appointments/point-of-sale`
- `/appointments/forms-documents`

External URLs, protocol-relative URLs, and `..` segments are rejected.

## Calendar state in `returnTo`

`returnTo` for Calendar includes URL-synced state: `view`, `date`, filters (`staff`, `location`, `resource`, `type`, `status`, `q`).

## UI

Destination pages render **← Back to Calendar** when `returnTo` points at `/appointments/calendar`.
