# POS Parity Audit

| Capability | Status |
|------------|--------|
| CUSTOMER SEARCH | PASS |
| NEW CUSTOMER QUICK CREATE | GAP |
| APPOINTMENT BALANCE COLLECTION | PARTIAL |
| SERVICE SALE | PARTIAL (line only, no booking) |
| PACKAGE SALE | PASS (fulfill on checkout) |
| MEMBERSHIP SALE | PARTIAL (fulfill; subscription via store-checkout) |
| PRODUCT SALE | PASS if products exist |
| DISCOUNTS | PARTIAL |
| MEMBERSHIP PRICING | GAP in POS cart |
| PACKAGE REDEMPTION | GAP |
| ACCOUNT CREDIT | GAP |
| TAX | GAP |
| CARD PAYMENT | GAP for cart; PASS for appointment checkout URL path |
| CASH PAYMENT | PARTIAL (balance lines) |
| EXTERNAL/MANUAL | PARTIAL |
| PARTIAL PAYMENT | PARTIAL (balance collect amount validated) |
| SPLIT TENDER | GAP |
| TIPS | PARTIAL (line kind exists) |
| RECEIPTS | GAP |
| EMAIL RECEIPTS | GAP |
| REFUNDS | PASS via Transactions |
| OPEN BALANCE VIEW | PASS |
| IDEMPOTENCY | PARTIAL |
| CARD-PRESENT TERMINAL | N/A |
