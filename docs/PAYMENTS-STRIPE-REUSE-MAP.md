# Payments Stripe Reuse Map

| Existing component | Current use | Text-to-Pay use | Reused as-is? | Modified? |
|--------------------|-------------|-----------------|---------------|-----------|
| `getStripe()` | All Stripe API | PaymentRequest checkout | Yes | No |
| `MerchantPaymentConnection` | Appointments Connect | Same connected account | Yes | No |
| `createStripeConnectCheckout` pattern | Booking checkout | Mirrored in `payment-requests/stripe-checkout.ts` | Pattern | New thin wrapper |
| `stripe-webhook-handler.ts` | Platform + booking | Routes `transovo_payment_request` | Yes | Extended |
| `STRIPE_WEBHOOK_SECRET` | Signature verify | Same | Yes | No |
| `AppointmentMerchantPayment` | Booking ledger | Not merged with PaymentRequest | N/A | No |
| `create-link.ts` / `PaymentLink` | Campaign links | Legacy; not Text-to-Pay engine | No | No |
| Integrations `/integrations/payments` | Connect OAuth | Payments gated state | Yes | No |

**DUPLICATE_STRIPE_INFRASTRUCTURE = 0**
