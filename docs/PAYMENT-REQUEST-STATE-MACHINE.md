# Payment Request State Machine

## Payment status (`PaymentRequest.status`)

| Status | Meaning |
|--------|---------|
| draft | Created, checkout not yet attached |
| ready | Checkout session created |
| sent | SMS send attempted |
| delivered | Reserved — set when provider delivery confirmed |
| opened | Public link opened (first open) |
| paid | Webhook-confirmed payment |
| failed | Checkout creation failed |
| expired | Checkout expired or `expiresAt` passed |
| cancelled | Business cancelled |
| refunded / partially_refunded | Future — reuse merchant refund primitives |

## Delivery status (`deliveryStatus`)

Separate from payment: `not_sent` → `queued` → `sent` → `delivered` | `failed`

## Invalid transitions (policy)

- `cancelled` / `expired` → no new checkout without new request
- `paid` is only set from Stripe webhook (not success URL)
- SMS failure does not delete checkout; retry uses same request
