# STRIPE CONNECT TEXT-TO-PAY PROVIDER RULESET

**Authority:** Text-to-Pay runtime + `src/lib/stripe-connect/*` + `src/lib/payment-requests/*` + `src/lib/merchant-payments/stripe-connect.ts`

Official references:

- [Connect OAuth](https://docs.stripe.com/connect/oauth-standard-accounts)
- [Connect authentication (Stripe-Account header)](https://docs.stripe.com/connect/authentication)
- [Direct charges](https://docs.stripe.com/connect/direct-charges)
- [Checkout Sessions with Connect](https://docs.stripe.com/connect/checkout)
- [Payment Links with Connect](https://docs.stripe.com/connect/payment-links)
- [Invoices with Connect](https://docs.stripe.com/connect/invoices)
- [Webhooks (Connect)](https://docs.stripe.com/connect/webhooks)
- [Idempotent requests](https://docs.stripe.com/api/idempotent_requests)

---

## Architecture — ST-ARCH-001

```
Operator / SMS → PaymentRequest service → stripe-connect/checkout → getStripe() + stripeAccount
→ Stripe Connect (direct charge on acct_xxx)
→ Webhook (verified) → reconcile PaymentRequest → PAYMENT_CONFIRMED activity
```

**LLM agents must not create Stripe objects, amounts, or refunds.**

---

## Authentication — ST-AUTH-001 … ST-AUTH-003

| Rule | Requirement |
|------|-------------|
| ST-AUTH-001 | Server calls use **platform** `STRIPE_SECRET_KEY` + **`stripeAccount: acct_...`** (SDK) / `Stripe-Account` header |
| ST-AUTH-002 | Canonical ID is **`merchantAccountId` / `acct_...`** persisted on `merchantPaymentConnection` |
| ST-AUTH-003 | Do **not** build new Text-to-Pay on deprecated Connect OAuth **access_token** for API calls; legacy token fields may exist but are unused |

Transovo uses **Express Connect** onboarding (`accounts.create` + Account Links) — relationship is the connected account ID.

---

## Charge model — ST-CHG-001

**Default: DIRECT CHARGES** for SaaS Text-to-Pay (business is merchant; objects live on connected account).

| Model | Text-to-Pay default |
|--------|---------------------|
| Direct | **YES** |
| Destination | Documented, not default |
| Separate charges & transfers | **NO** for Text-to-Pay |

Constant: `STRIPE_TEXT_TO_PAY_CHARGE_MODEL = "direct"` (`stripe-connect/constants.ts`).

---

## Capabilities — ST-CONN-001

`getStripeTextToPayCapabilities(workspaceId)` returns payment readiness separate from “connected”.

States include `STRIPE_CONNECTED_NOT_PAYMENT_READY` when `charges_enabled` or `card_payments` inactive.

UI and runtime share this service.

---

## Primary modes — ST-MODE-001

| Mode | Text-to-Pay launch | Implementation |
|------|-------------------|----------------|
| **Checkout Session** | **Primary** per-request SMS link | `createDirectChargeCheckoutSession` |
| **Invoice (Send Invoice)** | **Supported** — `deliveryMethod: invoice` | `createAndSendDirectChargeInvoice` + `createPaymentRequestStripeInvoice` |
| **Payment Link** | **SUPPORTED_PROVIDER_CAPABILITY** | **INTENTIONALLY_NOT_DEFAULT** — not launch Text-to-Pay UI |
| **PaymentIntent / Elements** | Only if embedded UI required | PCI via Stripe.js |

---

## Checkout Session — ST-CHK-001

| Field | Rule |
|-------|------|
| Endpoint | `POST /v1/checkout/sessions` |
| Scope | `{ stripeAccount: acct_xxx }` |
| mode | `payment` |
| line_items | `price_data` for dynamic amounts (avoid orphan Product explosion) |
| metadata | `transovo_payment_request_id`, `workspace_id`, `transaction_type` |
| idempotency | `t2p-checkout:{paymentRequestId}` |

**Prohibited:** Creating platform-account Checkout for a direct-charge merchant payment.

---

## Payment success — ST-PAY-001 (absolute)

| Source | May set PAID? |
|--------|----------------|
| Verified webhook + `payment_status=paid` | **YES** |
| `checkout.session.async_payment_succeeded` | **YES** |
| Success URL / `?return=1` | **NO** |
| Browser / frontend | **NO** |

`isCheckoutSessionPaid()` gates `handlePaymentRequestCheckoutCompleted`.

Async methods: `checkout.session.completed` with unpaid `payment_status` → `payment_processing` event only.

---

## Webhooks — ST-WHK-001 … ST-WHK-003

| Rule | Requirement |
|------|-------------|
| ST-WHK-001 | Verify `Stripe-Signature` on raw body |
| ST-WHK-002 | Dedupe `event.id` (`providerWebhookEvent`) |
| ST-WHK-003 | Connect events include `event.account` — resolve workspace via `merchantAccountId` |
| ST-WHK-004 | **Tenant authorization:** `event.account` → canonical connection → workspace; PaymentRequest must belong to that workspace. Metadata is correlation only. |

Critical events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_succeeded`, `account.updated`, `account.application.deauthorized`.

Implementation: `src/lib/stripe-connect/tenant-validation.ts`, `authorizePaymentRequestConnectEvent` in webhook handler.

---

## Send Invoice — ST-INV-001

| Step | Rule |
|------|------|
| Customer | Stripe Customer on **connected account** (`getOrCreateStripeCustomerForContact` or ephemeral create) |
| Items | `invoiceItems.create` on connected account |
| Invoice | `collection_method: send_invoice`, finalize, `sendInvoice` |
| Persist | `processorInvoiceId`, `processorHostedInvoiceUrl`, `collectionMethod: invoice` on PaymentRequest |
| PAID | `invoice.paid` / `invoice.payment_succeeded` with `status=paid` only — via `reconcilePaymentRequestPaid` |
| States | draft/open/paid/void/uncollectible — do not mark Transovo `sent` as Stripe `paid` |

---

## Refunds — ST-RFD-001

Direct charge refunds: `createDirectChargeRefund` → `stripe.refunds.create(..., { stripeAccount: acct_xxx })`.

Ledger: `payment_request_refunds` — never overwrite original payment row; update `amountRefundedMinor` + `partially_refunded` / `refunded`.

Application fee: `STRIPE_TEXT_TO_PAY_REFUND_APPLICATION_FEE_POLICY = NOT_APPLICABLE` (no application fees on Text-to-Pay today).

API: `POST /api/payment-requests/{id}/refund`

---

## Reconciliation — ST-REC-001

Single paid transition: `reconcilePaymentRequestPaid` — prevents duplicate `payment_received` from `checkout.session.completed` + `async_payment_succeeded`.

---

## Money — ST-MONEY-001

Integer minor units only (`amountMinor`). Central parsing via `parseAmountToMinor`.

---

## Public redirect — ST-LINK-001

Customer URL: `/p/{publicToken}` → API records **LINK_OPENED** → redirect to Stripe Checkout URL retrieved in **connected account context**.

---

## Normalized errors — ST-ERR-001

`StripeTextToPayError` codes in `stripe-connect/errors.ts`. No raw Stripe errors in SMS.

---

## PCI — ST-PCI-001

No raw card data on Transovo servers. Hosted Checkout / Invoice pages only for Text-to-Pay launch.

---

## Source of truth — ST-RULE-105

| Stripe | Transovo |
|--------|----------|
| PaymentIntent/Checkout/Invoice state | PaymentRequest, SMS, conversation activity |
| Capabilities | Entitlement / UI readiness |
| Browser | **Not** payment success |

---

## Definition of done

See `STRIPE-CONNECT-TEXT-TO-PAY-CONFORMANCE-AUDIT.md`.
