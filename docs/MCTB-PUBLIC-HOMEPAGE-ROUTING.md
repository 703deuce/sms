# MCTB public homepage routing (site-level)

**Authority for marketing routing.** Read before changing `/` or `/appointments` public pages.

## Structure

| URL | Page |
|-----|------|
| `/` | Missed Call Text Back marketing homepage |
| `/appointments` | Appointments marketing (preserved; not redesigned) |

## App vs marketing

- `/appointments` (no session) → Appointments marketing page.
- `/appointments` (session) → middleware redirects to `/appointments/overview` or `/appointments/list` (legacy list query params).
- Authenticated Appointments app routes remain under `/appointments/*` except the public marketing slug.

## Do not

- Redirect `/` to `/appointments`.
- Redesign the Appointments marketing page when moving it.
- Collapse MCTB + Appointments into one generic hero.
