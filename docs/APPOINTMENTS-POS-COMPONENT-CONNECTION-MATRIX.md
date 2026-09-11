# POS Component Connection Matrix (summary)

| Component | API | Domain |
|-----------|-----|--------|
| Customer search | GET `/api/contacts` | Contacts |
| Add catalog line | POST pos-cart `add_line` | posSession |
| Add balance | POST pos-cart `appointment_balance` line | manage-payments on checkout |
| Take payment | POST pos-cart `checkout` | fulfillStorePurchase + collectAppointmentBalancePayment |
| Open balances | GET point-of-sale/workspace | getManageAppointmentPaymentSummary |
| Transactions link | — | `/payments/transactions` |

**Connected:** 6 | **GAP:** card capture for catalog, account credit, tax, receipts
