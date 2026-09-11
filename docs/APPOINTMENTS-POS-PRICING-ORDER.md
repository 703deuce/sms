# POS Pricing Order

POS cart totals today:

1. Sum of line `totalCents` (quantity × unit price)
2. Tax: **not applied** in POS session (`taxCents = 0`) — use canonical tax at provider checkout when integrated
3. Discount lines: negative `unitPriceCents` rows; coupon redemption on checkout when `referenceId` set
4. Appointment balance lines: **server revalidated** amount via `getManageAppointmentPaymentSummary` at collect time (not list price)

Canonical booking checkout (public) order remains per `pricing-workspace.ts` / `booking-entitlements`:

1. Base offering price
2. Dynamic pricing / membership adjustment
3. Package redemption (may waive card)
4. Coupon
5. Deposit split via `calculatePaymentAmounts`

POS should converge mixed carts on shared checkout orchestration in a future pass; balance lines already avoid re-charging deposits.
