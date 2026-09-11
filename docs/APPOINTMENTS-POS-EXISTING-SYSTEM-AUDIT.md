# Appointments POS — Existing System Audit

| Capability | Status | Notes |
|------------|--------|-------|
| `posSession` / `posLineItem` (Prisma) | WORKING | Operational **staging cart** before fulfillment |
| `checkoutPosSession` | PARTIAL | Fulfills package/gift/membership via `fulfillStorePurchase`; products via `fulfillBookingProductSale`; **no Stripe charge in checkout** |
| Appointment balance collection | PARTIAL | Added `appointment_balance` line + `collectAppointmentBalancePayment` (cash/external) |
| Stripe Connect checkout | WORKING | `createAppointmentCheckoutSession`, merchant webhooks |
| `appointmentMerchantPayment` | WORKING | Canonical transaction records |
| `calculatePaymentAmounts` | WORKING | Deposit vs full math |
| Package purchase | WORKING | `purchasePackageForContact` |
| Membership subscription | WORKING | `startMembershipSubscription` via store-checkout |
| Coupons / discounts | PARTIAL | POS discount lines + coupon redemption |
| Account credit | GAP | No POS apply path audited |
| Tax on POS cart | GAP | `taxCents = 0` in pos-cart recalc |
| Cash recording | PARTIAL | Balance collection metadata `posMethod: cash` |
| Card POS charge | GAP | Card method not completing PaymentIntent in checkout |
| Refunds | WORKING | Transactions UI + `refundStripeConnectPayment` |
| Receipt email | GAP | Not wired from POS success |
| Idempotency | PARTIAL | `idempotencyKey` on balance collection + payment record |
| Card-present terminal | N/A | Online CNP only |

**Preserved:** store-checkout, package ledger, membership lifecycle, merchant payment store.

**POS cart is not a second payment engine** — it stages lines then calls canonical fulfillment; gap is provider capture for non-balance merchandise lines.
