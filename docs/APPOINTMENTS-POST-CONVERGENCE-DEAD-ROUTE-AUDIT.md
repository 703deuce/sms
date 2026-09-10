# Appointments — Post-Convergence Dead Route Audit (Post 8G-1)

**Generated:** 2026-09-10

Retired **21** READY_FOR_RETIREMENT routes now resolve via `legacyAppointmentsRedirectPage` stubs.

| Check | Result |
|-------|--------|
| Retired routes 404 | NO — all redirect |
| Canonical destinations missing | NO |
| Redirect loops detected (static) | NO |

## V2-only retained

- `/appointments/payments` — hidden from V1 nav, not retired
