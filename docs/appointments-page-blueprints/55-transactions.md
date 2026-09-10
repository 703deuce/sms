# Blueprint 55 — Transactions (`/payments/transactions`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-6 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 8-30 | Refunds (full / partial / wallet) | Refund modal | `appointment-refunds.ts` | ABSORBED_CANONICAL_UI |
| 8-31 | Refund to original method | Refund modal | merchant payments | ABSORBED_CANONICAL_UI |
| 8-32 | Refund to account credit | Refund modal destination | `client-wallet.ts` | ABSORBED_CANONICAL_UI |
| 8-34 | Payment transaction ledger | List + drawer | `transactions.ts` | ABSORBED_CANONICAL_UI |
| 17-5 | Stripe Connect | Integrations only | merchant payments | ALREADY_PRESENT |
| 17-6 | Square payments | Integrations only | merchant payments | ALREADY_PRESENT |

## AUDIT CORRECTIONS (NOT ON TRANSACTIONS)

| Feature ID | Correct destination |
|---|---|
| 2-11 | Booking Type editors (Pricing & Access) |
| 5-18, 8-29 | Customer Portal / customer payment context |
| 17-5, 17-6 | Integrations → Payments (connect/disconnect) |

## USER FLOW

List → drawer detail → refund (original method or account credit) → related appointment/contact links.

## REMAINING GAPS

- POS / package / membership / invoice source rows when backend expands beyond appointments
- Saved-card management (PORTAL_WAVE_PENDING)
- Send payment link from drawer (needs real API, not mock)
