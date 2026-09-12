# Payments Messaging Integration

Payment requests send SMS via **`sendQuickSms`** (same as inbox quick send).

- **Platform mode**: when `resolveAppointmentOutboundSmsRoute` returns a route → Transovo-certified sender, compliant template prefix `Transovo: {business}…`
- **Business mode**: workspace messaging registration ready → `{business}: Payment request…`
- Preview: `POST /api/payment-requests/preview-message` → `resolvePaymentRequestMessaging`
- Opt-out/suppression enforced inside `sendQuickSms`
- Partial failure: PaymentRequest + checkout remain; `smsError` set; retry via `POST …/retry-message`
