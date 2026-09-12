# Payment Request Event Matrix

| Event | Source | Canonical record | State change | Timeline | Conversation | Idempotency |
|-------|--------|------------------|--------------|----------|--------------|-------------|
| request_created | API | PaymentRequest | draft | event | — | idempotencyKey on create |
| checkout_created | Service | processorCheckoutId | ready | event | — | single checkout per request |
| checkout_failed | Service | smsError | failed | event | — | — |
| sms_sent | sendQuickSms | messageId | sent | event | outbound message | SMS idempotency key |
| sms_failed | sendQuickSms | smsError | sent + delivery failed | event | — | retry same request |
| link_opened | Public GET | openCount | opened | event | — | first open only |
| payment_received | Stripe webhook | paidAt, amountPaidMinor | paid | event | card updates | providerWebhookEvent |
| reminder_sent | API | reminderCount | — | event | SMS | per-reminder key |
| cancelled | API | cancelledAt | cancelled | event | card | — |
| checkout.session.expired | Stripe webhook | status | expired | event | — | webhook dedupe |
