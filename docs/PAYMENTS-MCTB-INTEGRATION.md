# Payments MCTB Integration

- MCTB does **not** auto-create payment requests on missed calls
- Recovery conversations expose the same **Request Payment** action
- `missedCallId` + `sourceType: mctb_conversation` preserved on PaymentRequest
- No `/mctb/payments` product surface; canonical route `/payments`
