# Payments — Existing Infrastructure Audit

Mechanical audit performed before Text-to-Pay / PaymentRequest implementation.

## Stripe

| Item | Finding |
|------|---------|
| SDK | `stripe` npm package via `src/lib/stripe/client.ts` (`getStripe()`, Stripe **v** pinned in package.json) |
| Client init | Singleton `getStripe()` from `STRIPE_SECRET_KEY` |
| Env vars | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (no second secret key) |
| Webhook | Canonical `POST /api/webhooks/stripe` → `src/lib/payments/stripe-webhook-handler.ts` |
| Signature | `verifyAndParseStripeWebhook` uses `stripe.webhooks.constructEvent` |
| Connect | `src/lib/merchant-payments/stripe-connect.ts` — Express accounts, `MerchantPaymentConnection` |
| Connect onboarding | `POST /api/merchant-payments/stripe/connect`, Integrations UI `/integrations/payments` |
| Checkout (booking) | `createStripeConnectCheckout` with `transaction_type: appointment_merchant_payment` |
| Legacy platform links | `src/lib/payments/create-link.ts` — platform-account Checkout (campaign/messaging), **not** Connect |
| Idempotency | `providerWebhookEvent.providerEventId` dedupe; appointment `idempotencyKey` on `AppointmentMerchantPayment` |

## Current payment domain

| Model | Role |
|-------|------|
| `MerchantPaymentConnection` | Workspace Stripe/Square Connect |
| `AppointmentMerchantPayment` | Booking/deposit/full payment ledger |
| `PaymentLink` | Legacy SMS payment links (platform Stripe session) |
| **New** `PaymentRequest` | Canonical Text-to-Pay solicitation lifecycle |

Booking checkout remains on `AppointmentMerchantPayment`; Text-to-Pay uses `PaymentRequest` + shared Connect checkout + shared webhook router.

## Integrations

- Merchant payments panel: `src/features/integrations/kimi/payments/payments-connected.tsx`
- Route: `/integrations/payments`
- Payments product reads connection via `getMerchantConnection(workspaceId, "STRIPE")`

## Messaging

- Outbound SMS: `src/lib/sms/send-quick.ts` (`sendQuickSms`)
- Inbox API: `POST /api/sms/send` with `inboxCompose`
- Platform route pattern: `resolveAppointmentOutboundSmsRoute` (HP-certified platform sender)
- Opt-out: `suppression` + contact `UNSUBSCRIBED`/`BLOCKED`
- Templates: `mergeTemplate` in send-quick; payment preview uses `resolvePaymentRequestMessaging`

## Conversations

- Models: `Conversation`, `ConversationMessage`
- MCTB threads: `productSource`, `missedCallEventId`
- Request Payment: `ConversationPaymentActions` in thread composer area

## MCTB

- No automatic payment on missed call
- Recovery → conversation → Request Payment (shared engine, `sourceType: mctb_conversation`)

## Auth / tenant

- APIs use `requireSession` + `resolveWorkspaceId`
- PaymentRequest rows scoped by `workspaceId`

## Text-to-Pay reuse decision

- **Reuse** Connect checkout pattern from `merchant-payments/stripe-connect.ts`
- **Extend** canonical webhook handler (no second webhook server)
- **Do not** add new Stripe env vars or second Connect onboarding in Payments UI
