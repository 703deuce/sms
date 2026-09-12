# Payments Component Connection Matrix

| Page / surface | Component | Read | Write | Persistence | Processor | Messaging | Status |
|----------------|-----------|------|-------|-------------|-----------|-----------|--------|
| `/payments` | PaymentsWorkspace | GET `/api/payment-requests` | — | — | — | — | CONNECTED_AND_WORKING |
| `/payments` | Request payment CTA | connection API | POST create | PaymentRequest | Connect checkout | sendQuickSms | CONNECTED_AND_WORKING |
| `/payments` | Table row | list API | — | — | — | — | CONNECTED_AND_WORKING |
| `/payments` | Detail drawer | GET by id | cancel/reminder/retry | events | — | retry SMS | CONNECTED_AND_WORKING |
| `/p/[token]` | Public redirect | token lookup | open event | openCount | redirect Checkout | — | CONNECTED_AND_WORKING |
| Conversations | Request Payment | convo context | POST create | message + request | Connect | SMS | CONNECTED_AND_WORKING |
| Integrations | Connect Stripe | merchant status | existing Connect flow | MerchantPaymentConnection | — | — | READ_ONLY_BY_DESIGN (owned by Integrations) |

**BROKEN = 0**, **NO_OP = 0**, **PLACEHOLDER = 0** (MVP surfaces wired to backend).
