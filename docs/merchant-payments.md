# Merchant Appointment Payments (Stripe Connect + Square)

Transovo appointment customer payments are **merchant payments** — funds settle to the connected business's Stripe or Square account. This is architecturally separate from **PlatformBilling** (Transovo SaaS subscriptions via `Workspace.stripeCustomerId`).

## Architecture

```
PlatformBilling (SaaS)          MerchantPayments (Appointments)
├── /settings/billing           ├── /settings/payments
├── stripe-billing-webhook      ├── stripe-connect.ts (Connect Express)
├── Workspace.stripeCustomerId  ├── square.ts (OAuth + Payments API)
└── transaction_type: saas_*    └── transaction_type: appointment_merchant_payment
```

## Database

- `merchant_payment_connections` — workspace OAuth/Connect state (encrypted tokens)
- `appointment_merchant_payments` — per-appointment payment records, refunds, idempotency

## Environment Variables

### Stripe (platform + Connect)

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | Yes | Platform secret (SaaS billing + Connect API calls) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Client-side if needed |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | Single webhook destination at `/api/webhooks/stripe` |

No additional Stripe credentials are required for Connect. Express onboarding uses the same `STRIPE_SECRET_KEY` via `getStripe()` — there is no separate Connect secret key or webhook secret.

### Square

| Variable | Required | Purpose |
|----------|----------|---------|
| `SQUARE_APPLICATION_ID` | Yes | Square app ID |
| `SQUARE_APPLICATION_SECRET` | Yes | OAuth token exchange |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Yes (prod) | Webhook verification |
| `SQUARE_ENVIRONMENT` | Optional | Set to `production` for live (default: sandbox) |

### Shared

| Variable | Required | Purpose |
|----------|----------|---------|
| `INTEGRATION_SECRET_KEY` | Yes (prod) | AES-256-GCM encryption for OAuth tokens at rest |
| `NEXT_PUBLIC_APP_URL` / app base URL | Yes | OAuth return URLs |

## Stripe Dashboard Configuration (still required)

1. Enable **Stripe Connect** on platform account
2. Webhook endpoint: `/api/webhooks/stripe`
3. Subscribe to events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `account.updated`
   - (existing SaaS events unchanged)
4. Connect settings: Express accounts with Stripe-hosted onboarding and Express Dashboard management

## Square Developer Console Configuration (still required)

1. Create Square application
2. OAuth redirect URL: `{APP_URL}/api/merchant-payments/square/callback`
3. Webhook endpoint: `/api/webhooks/square`
4. Subscribe to: `payment.created`, `payment.updated`
5. Request scopes: `MERCHANT_PROFILE_READ`, `PAYMENTS_WRITE`, `PAYMENTS_READ`

## Booking Flow

1. Customer books → appointment created with `pending_payment` (30-min hold)
2. **Stripe**: redirect to Connect Checkout on merchant account
3. **Square**: Square Web Payments SDK tokenizes card → server charges via Payments API
4. Webhook confirms payment → appointment → `awaiting_confirmation`
5. Abandoned checkout → `checkout.session.expired` cancels hold

## Legal / Privacy Disclosures (for future terms update)

- Transovo facilitates payments through third-party processors
- Connected businesses are merchants for their services
- Stripe/Square process card data; Transovo does not store raw card details
- Refund responsibility follows appointment policies configured by the business
- Merchant authorizes processor connection; third-party processor terms apply

## Capability Keys (entitlement-ready)

See `src/lib/merchant-payments/capabilities.ts`
