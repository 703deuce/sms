# STRIPE CONNECT TEXT-TO-PAY — CONFORMANCE AUDIT

**Date:** 2026-09-13  
**Rulebook:** `STRIPE-CONNECT-TEXT-TO-PAY-RULES.md`  
**Charge model audit:** `STRIPE-TEXT-TO-PAY-CHARGE-MODEL-AUDIT.md`

## Canonical stack

| Layer | Path |
|-------|------|
| Stripe client | `src/lib/stripe/client.ts` (`getStripe()` singleton) |
| Text-to-Pay connector | `src/lib/stripe-connect/*` |
| Payment requests | `src/lib/payment-requests/service.ts`, `stripe-checkout.ts` |
| Merchant checkout (appointments) | `src/lib/merchant-payments/stripe-connect.ts` |
| Webhooks | `src/lib/payments/stripe-webhook-handler.ts` |
| Connection store | `src/lib/merchant-payments/connection-store.ts` |

## Conformance matrix (summary)

| Rule ID | Requirement | Before | After | Location |
|---------|-------------|--------|-------|----------|
| ST-AUTH-001 | Platform key + `stripeAccount` | COMPLIANT | COMPLIANT | `stripe-checkout`, `stripe-connect.ts` |
| ST-AUTH-003 | No new runtime on OAuth bearer token | PARTIAL (unused import) | COMPLIANT | Legacy fields documented in capabilities |
| ST-CHG-001 | Direct charges for Text-to-Pay | COMPLIANT | COMPLIANT | Charge model audit |
| ST-CONN-001 | Capability ≠ connected | **NON_COMPLIANT** | **COMPLIANT** | `getStripeTextToPayCapabilities` |
| ST-CHK-001 | Checkout on connected account | COMPLIANT | COMPLIANT | `createDirectChargeCheckoutSession` |
| ST-IDEM-001 | Idempotency on checkout create | **MISSING** | **COMPLIANT** | `t2p-checkout:{id}` |
| ST-PAY-001 | PAID only when `payment_status=paid` | **NON_COMPLIANT** | **COMPLIANT** | `handlePaymentRequestCheckoutCompleted` |
| ST-PAY-001 | Success URL not authority | **RISK** (`?paid=1`) | **COMPLIANT** | Success URL → `?return=1` only |
| ST-WHK-001 | Signature verification | COMPLIANT | COMPLIANT | `verifyAndParseStripeWebhook` |
| ST-WHK-002 | Event id dedupe | COMPLIANT | COMPLIANT | `providerWebhookEvent` |
| ST-WHK-004 | `event.account` tenant validation | **MISSING** | **COMPLIANT** | `tenant-validation.ts`, webhook authorize |
| ST-INV-001 | Send Invoice on connected account | **NOT_WIRED** | **COMPLIANT** | `stripe-invoice.ts`, `invoice.ts` |
| ST-RFD-001 | Connected-account refunds + ledger | **MISSING** | **COMPLIANT** | `refunds.ts`, `payment_request_refunds` |
| ST-REC-001 | Single PAID reconciliation | **PARTIAL** | **COMPLIANT** | `reconcile.ts` |
| ST-ARCH-102 | LLM money mutations | COMPLIANT | COMPLIANT | No agent Stripe imports |

## Mechanical checks

```bash
npx tsx scripts/test-stripe-text-to-pay-conformance.ts
npx tsx scripts/test-stripe-text-to-pay-provider-completion.ts
npx tsx scripts/test-payment-requests.ts
```

## Final report

| Flag | Value |
|------|--------|
| `STRIPE_RULEBOOK_COMPLETE` | **YES** |
| `EXISTING_CONNECTOR_AUDITED` | **YES** |
| `CANONICAL_CHARGE_MODEL` | **DIRECT** |
| `CHARGE_MODEL_CONSISTENT` | **YES** (Text-to-Pay paths) |
| `CONNECTED_ACCOUNT_AUTH_CURRENT` | **YES** (platform key + acct) |
| `LEGACY_OAUTH_TOKEN_DEPENDENCY` | **Documented / unused for API** |
| `ONE_CANONICAL_STRIPE_CLIENT` | **YES** |
| `CHECKOUT` | **CONNECTED_AND_WORKING** |
| `PAYMENT_LINKS` | **INTENTIONALLY_LIMITED** (not per-SMS default) |
| `STRIPE_SEND_INVOICE` | **CONNECTED_AND_WORKING** |
| `STRIPE_CONNECTED_ACCOUNT_REFUNDS` | **CONNECTED_AND_WORKING** |
| `STRIPE_EVENT_ACCOUNT_TENANT_VALIDATION` | **CONNECTED_AND_WORKING** |
| `STRIPE_WEBHOOK_DEDUPE` | **CONNECTED_AND_WORKING** |
| `STRIPE_DUPLICATE_PAYMENT_CONFIRMED_EVENTS` | **0** (reconcile service) |
| `PAYMENT_LINKS` | **INTENTIONALLY_NOT_DEFAULT** |
| `WEBHOOKS` | **CONNECTED_AND_WORKING** |
| `PAID_FROM_VERIFIED_PROVIDER_STATE_ONLY` | **YES** |
| `PAID_FROM_SUCCESS_URL` | **NO** |
| `CROSS_WORKSPACE_STRIPE_MUTATIONS` | **0** (tenant gate) |
| `UNAPPROVED_STRIPE_PAYMENT_BYPASSES` | **0** (Text-to-Pay uses connector) |
| `UNRESOLVED_STRIPE_NON_COMPLIANCE` | **0** |

## Approved non–Text-to-Pay Stripe usage

Platform billing, mass texting, marketplace, and SaaS subscriptions intentionally use **platform-account** Checkout — out of Text-to-Pay scope but listed in charge model audit.
