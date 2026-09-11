# Appointments — Checkout pricing order (audited)

Source: `src/app/api/public/book/[slug]/route.ts` (book action) + `src/lib/merchant-payments/amounts.ts` + `src/lib/appointments/service-booking/booking-entitlements.ts`.

| Step | Mechanism | Field affected |
|------|-----------|----------------|
| 1 | Type config | `payment.priceCents`, `payment.mode` |
| 2 | Dynamic pricing rules | `priceCents`, `dynamicPricing` metadata |
| 3 | Membership benefit | `priceCents` ↓ |
| 4 | Add-ons | `priceCents` ↑ |
| 5 | Coupon code | `priceCents` ↓, `couponDiscountCents` |
| 6 | Package / gift selection | Waives `amountDue` via entitlement (ledger) |
| 7 | Deposit math | `amountDueCents`, `balanceDueCents` for provider session |

**Not in server book path today:** workspace `commerceDefaults` (UI-only merge), tax lines (invoice supports `taxCents`; public book does not add tax), pay-what-you-want at book unless configured on type.

**Stacking:** Membership adjustment runs before coupon. Package redemption is mutually exclusive with card pay for the covered amount. Document exact Package+Membership+Discount combinations in QA — do not assume triple stack without test proof.
