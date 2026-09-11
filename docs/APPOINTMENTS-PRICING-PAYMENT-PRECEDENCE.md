# Appointments — Pricing & payment precedence

## Offering vs workspace default

- **Authoritative price and payment mode** live on each booking type: `voiceService.config.payment` (`AppointmentTypeConfig.payment`).
- **Workspace default** (`AppointmentPlatformConfig.commerceDefaults`) is applied in the Pricing & Payments UI when an offering has **no** explicit `payment.mode` (see `effectivePayment()` in `pricing-workspace.ts`).
- Runtime public booking merges **`commerceDefaults`** when a type has no explicit `payment.mode` (`effectivePayment` in public book route).

## Payment mode precedence (checkout)

1. `config.payment.mode` on the booked type (after editor save).
2. If `mode === "none"` and `priceCents > 0`: treat as **pay later / in-person** (no card checkout).
3. Merchant checkout uses `calculatePaymentAmounts` (`src/lib/merchant-payments/amounts.ts`) for `full` and `deposit` only.
4. Extended modes (`deposit_fixed`, `deposit_percent`, `optional`, etc.) should be normalized to `deposit`/`full` before checkout — service editor generally stores these modes on config; Connect checkout path expects `deposit` or `full`.

## Provider

- `payment.provider` on the type (`stripe` | `square`) is required when mode is not `none`.
- `validateAppointmentTypePayment` checks Connect `chargesEnabled` before allowing paid booking.

## Price adjustments at book time (public `POST /api/public/book/[slug]`)

Order observed in code:

1. Base `effectivePayment.priceCents`
2. Dynamic pricing (`evaluateSlotPrice`) — may replace `priceCents` and attach `dynamicPricing`
3. Membership (`resolveMembershipPriceAdjustment`) — reduces `priceCents`
4. Add-ons — adds to `priceCents`
5. Coupon (`validateAndApplyCoupon`) — reduces `priceCents`
6. Package/gift entitlement selection — may waive card amount via `applyBookingEntitlement` (separate from price field)
7. Deposit split — `calculatePaymentAmounts` on final `priceCents` for Stripe/Square session

## Deposits

- Deposit cannot exceed total (`validatePaymentRequirement`).
- Remaining balance stored on merchant payment record (`balanceDueCents`).
