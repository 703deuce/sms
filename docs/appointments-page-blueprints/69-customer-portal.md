# Blueprint 69 — Customer Portal (`/portal/[token]`)

**Batch:** 8B-9  
**Route:** `/portal/[token]` (slug entry → OTP → session token)  
**Distinction:** Account-wide self-service — not Public Booking, not Manage Appointment.

## Sections

| Section | Content |
|---------|---------|
| Home | Next appointment, book CTA, package/membership/credit/balance-due summaries |
| Appointments | Upcoming / past filters, manage links, meeting join, waitlist |
| Packages & Memberships | Credits, expiration, credit history, gift balances, redemption history |
| Payments & Credit | Account credit, saved card display, payment history, invoices, pay balance |
| Documents | Intake, terms, contracts (customer-safe) |
| Profile | Name, phone; email read-only; household read-only when authorized |

## Auth

- Workspace slug → email OTP (`/api/public/portal/login/[slug]`)
- Session token → full portal payload (`resolveClientPortalSession`)
- Sign out revokes session
- Financial data requires verified session (not cookie-only)

## Backend

- `client-portal.ts` + `portal-customer-payload.ts`
- Wallet: `/api/public/portal/[token]/wallet`
- Payment methods: `/api/public/portal/[token]/payment-methods`
- Profile: `/api/public/portal/[token]/profile`

## Remaining gaps (post 8B-9)

- Add/remove saved card UI (Stripe Elements) — display only unless setup flow wired in portal
- Membership pause/cancel self-service — view only unless backend exposes customer actions
- Dependent booking switch — household display only
- Invoice pay links from portal list — use manage/pay routes where token available
- Meeting recap customer view — when shared-recap API exists
