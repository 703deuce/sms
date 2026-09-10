# Batch 8D-7 — Backend Gap Closure Summary

**Generated:** 2026-09-10  
**Branch:** `cursor/batch8d7-backend-gap-closure-709b`

## Starting state (post–8D-6)

| Metric | Count |
|--------|------:|
| **V1_BACKEND_GAP** | **5** |

### Starting rows

| ID | Feature (ledger) | Gap | Classification |
|----|------------------|-----|----------------|
| 8-25 | Products for sale | POS tax engine | PAYMENT_CALCULATION_MISSING |
| 9-6 | Seat selection / maps | Invoice email send | EMAIL_DELIVERY_MISSING |
| 9-7 | Event admission tickets | Invoice PDF export | DOCUMENT_GENERATION_MISSING |
| 12-3 | Workflow from template | Backend incomplete | DOMAIN_LOGIC_MISSING |
| 13-2 | Staff-initiated AI book | Poll → appointment booking | CROSS_DOMAIN_TRANSACTION_MISSING |

## Ending state

| Metric | Count |
|--------|------:|
| **V1_BACKEND_GAP** | **0** |
| Resolved | 5 |
| Reclassified | 0 |

## Implementations

### 8-25 — POS tax

- **Files:** `src/lib/appointments/service-booking/pos-tax.ts`, `phase2/pos-cart.ts`, `types.ts` (`posSalesTax` config)
- **Behavior:** Server-authoritative tax from workspace `posSalesTax.rateBps` on taxable line kinds; integer-cent rounding; persisted on `PosSession.taxCents`
- **Tests:** `scripts/test-batch8d7-backend-gaps.ts` (tax math)

### 9-6 — Invoice email delivery

- **Files:** `booking-invoices.ts` (`sendInvoiceEmail`, `rotateInvoicePayToken`), `invoices/[id]/send/route.ts`, `invoices-client.tsx`
- **Behavior:** Validates customer email, rotates secure pay token, sends transactional email via Brevo/stub, persists delivery metadata on invoice

### 9-7 — Invoice PDF

- **Files:** `invoice-pdf.ts`, `booking-invoices.ts` (`buildInvoicePdf`), `invoices/[id]/pdf/route.ts`, `invoices-client.tsx`
- **Behavior:** On-demand PDF 1.4 from authoritative invoice snapshot; workspace-scoped download with auth

### 12-3 — Workflow from template

- **Files:** `appointment-workflows/service.ts` (`installWorkflowFromTemplate`), `workflows/route.ts` (`action: install-template`)
- **Behavior:** Idempotent template install (returns existing workflow when template already installed)

### 13-2 — Poll → booking

- **Files:** `meeting-polls.ts` (`finalizeMeetingPollBooking`), `meeting-polls/route.ts` (`action: finalize`), `MeetingPollsClient.tsx`
- **Behavior:** Revalidates poll/option, creates canonical appointment via `createPlatformAppointment` + atomic slot booking, links `bookedAppointmentId`, idempotent on repeat finalize

## Focused tests

```bash
npx tsx scripts/test-batch8d7-backend-gaps.ts
# Batch 8D-7 backend gap tests: PASS
```

## Ledger / queue

- `node scripts/reconcile-appointments-batch8c.mjs` — **V1_BACKEND_GAP: 0**
- Residual queue updated; backend rows removed from implementation queue

## Not in scope (this batch)

- Master browser certification
- Route retirement / convergence pass
- Full provider certification
