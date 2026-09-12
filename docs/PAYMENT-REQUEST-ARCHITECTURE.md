# Payment Request Architecture

One canonical **PaymentRequest** engine serves:

- Standalone `/payments`
- Conversations (Request Payment action)
- MCTB recovery conversations (via conversation, `mctb_conversation` source)
- Future Appointments (`appointments-hook.ts`)

## Layers

1. **Domain** — `PaymentRequest`, `PaymentRequestEvent` (Prisma)
2. **Service** — `src/lib/payment-requests/service.ts`
3. **Processor** — `stripe-checkout.ts` (Stripe Connect checkout sessions)
4. **Messaging** — `messaging.ts` + `sendQuickSms`
5. **Public URL** — `/p/{publicToken}` → open tracking → redirect to hosted Checkout
6. **Webhooks** — `stripe-webhook-handler.ts` routes `transovo_payment_request` metadata

## Processor abstraction

First release: Stripe only. Fields are processor-generic (`processorCheckoutId`, `processorPaymentIntentId`).

## Coexistence with booking payments

`AppointmentMerchantPayment` remains the booking ledger. PaymentRequest tracks manual solicitations; both share Connect + webhook infrastructure.
