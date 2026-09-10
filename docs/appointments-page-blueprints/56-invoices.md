# Blueprint 56 — Invoices (`/payments/invoices`)

**Classification:** KEEP VISUAL + EXTEND API-FIRST FUNCTIONALITY

## BATCH 8B-6 ABSORPTION GAPS

| Feature ID | Feature | Final Section | Backend | Status |
|---|---|---|---|---|
| 8-27 | Invoices | List + create | `booking-invoices.ts` | ABSORBED_CANONICAL_UI |
| — | Void invoice | Row actions | `voidInvoice` | ABSORBED_CANONICAL_UI |
| — | Copy pay link | Row actions | `regenerateInvoicePayToken` | ABSORBED_CANONICAL_UI |
| — | Due date on create | Create form | `booking-invoices.ts` | ABSORBED_CANONICAL_UI |
| — | Status / search filters | List controls | list API | ABSORBED_CANONICAL_UI |

## COMMERCE ABSORPTION

`InvoicesPanel` in service-booking admin → redirect-only stub pointing to `/payments/invoices`.

## REMAINING GAPS

- Email send invoice modal (BACKEND_GAP if no mailer wired)
- Partial payment recording for offline payments
- Invoice detail drawer with payment history
