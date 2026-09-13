# Stripe Text-to-Pay — charge model audit

**Canonical model (locked):** `DIRECT` charges (`ST-CHG-001`)

| Code path | Charge type | Object ownership | Connected account | Platform fee | Refund context | Webhook scope | Compliant? |
|-----------|-------------|----------------|-------------------|--------------|----------------|---------------|------------|
| `payment-requests/stripe-checkout.ts` | **DIRECT** | Connected account | `stripeAccount` on create | None in code | `createDirectChargeRefund` + `payment_request_refunds` | Connect events + `event.account` tenant gate | **YES** |
| `payment-requests/stripe-invoice.ts` | **DIRECT** | Connected account | `stripeAccount` on Customer/Invoice | None | Same refund path | `invoice.paid` + tenant gate | **YES** |
| `merchant-payments/stripe-connect.ts` `createStripeConnectCheckout` | **DIRECT** | Connected account | `stripeAccount` | None | `refundStripeConnectPayment` uses `stripeAccount` | `appointment_merchant_payment` metadata | **YES** |
| `appointments/service-booking/store-checkout.ts` | **DIRECT** | Connected account | `stripeAccount` | Per store config | Connected | Membership/store metadata | **YES** (not Text-to-Pay) |
| `mass-texting/stripe-checkout.ts` | **PLATFORM** | Platform account | N/A | Platform billing | Platform | Platform webhooks | N/A (not Text-to-Pay) |
| `settings/billing.ts`, `platform-subscriptions.ts` | **PLATFORM** | Platform | N/A | N/A | Platform | SaaS billing | N/A |
| `payments/stripe-premium-number-checkout.ts` | **PLATFORM** | Platform | N/A | N/A | Platform | Marketplace | N/A |

**Destination / separate charges:** Not used for Text-to-Pay or merchant appointment checkout in current codebase.

**Required change:** None for charge model — document and enforce via `STRIPE_TEXT_TO_PAY_CHARGE_MODEL` constant.
