# Pricing & Payments — Component connection matrix

Route: `/appointments/pricing-payments`

| Section | Component | Read | Write | API | Checkout consequence | Status |
|---------|-----------|------|-------|-----|----------------------|--------|
| Header | Save | `commerceDefaults` | settings | `PATCH /api/appointments/settings` | Defaults UI only until server merge | CONNECTED_AND_WORKING |
| Collection | Default mode cards | `commerceDefaults.paymentMode` | settings PATCH | settings | Offerings without explicit payment (UI) | CONNECTED_AND_WORKING |
| Collection | Offering table | types `config.payment` | — | `GET /api/appointments/types` | Displays canonical | READ_ONLY_BY_DESIGN |
| Collection | Open editor | — | — | — | Canonical edit surface | READ_ONLY_BY_DESIGN |
| Collection | Reset to default | type config | remove `payment` | `PATCH /api/appointments/types/:id` | Type uses implicit default | CONNECTED_AND_WORKING |
| Deposits | Default fixed/% | `commerceDefaults` | settings | settings | UI default | CONNECTED_AND_WORKING |
| Deposits | Balance behavior | `balanceDueBehavior` | settings | settings | Informational until invoicing wired | INTENTIONALLY_DISABLED_WITH_REASON |
| Packages | Summary | packages/memberships APIs | — | service-booking | Checkout entitlements | READ_ONLY_BY_DESIGN |
| Discounts | Allow promo toggle | `allowPromoCodes` | settings | settings | **Not yet enforced on public UI gate** | CONNECTED_AND_WORKING |
| Discounts | Manage link | — | — | coupons page | `validateAndApplyCoupon` | READ_ONLY_BY_DESIGN |
| Providers | Stripe/Square rows | merchant status | — | `GET /api/merchant-payments/status` | `validateAppointmentTypePayment` | READ_ONLY_BY_DESIGN |
| Checkout preview | Amount math | type payment + defaults UI | — | — | Uses `calculatePaymentAmounts` | CONNECTED_AND_WORKING |
| Refunds | Links | — | — | transactions/refund API | Provider refunds | READ_ONLY_BY_DESIGN |

**Counts:** CONNECTED_AND_WORKING 6 · READ_ONLY_BY_DESIGN 6 · BROKEN 0 · PLACEHOLDER 0

**Server:** Public book merges `commerceDefaults` via `effectivePayment()` when a type has no explicit `payment.mode`.
