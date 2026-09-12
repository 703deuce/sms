# Payments Conversations Integration

- **UI**: `ConversationPaymentActions` in `conversations-thread-area.tsx` (Request Payment)
- **Prefill**: conversationId, phone, name, contactId, missedCallId
- **Engine**: `POST /api/payment-requests` with `sourceType: conversation` or `mctb_conversation`
- **Cards**: `GET /api/payment-requests/by-conversation/:id` rendered above composer
- **Persistence**: outbound SMS + `conversationMessage` row on send
