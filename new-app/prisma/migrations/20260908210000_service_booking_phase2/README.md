# Service booking phase 2 schema

Applied to the development database on 2026-09-08 via `npx prisma db push` after adding cross-competitor expansion models.

For fresh environments, run:

```bash
npx prisma db push
# or replay this migration after fixing shadow DB:
# npx prisma migrate deploy
```

## Tables introduced

| Table | Purpose |
|-------|---------|
| `customer_field_definitions` | Workspace-scoped custom field schema for contacts |
| `client_wallet_accounts` | Per-contact stored-value wallet balance |
| `client_wallet_ledger_entries` | Wallet credit/debit ledger |
| `loyalty_programs` | Loyalty program configuration |
| `loyalty_ledger_entries` | Points earn/redeem ledger |
| `dynamic_pricing_rules` | Time/demand/type-based slot pricing rules |
| `waitlist_priority_rules` | Scoring rules for waitlist promotion |
| `appointment_treatment_records` | SOAP-style treatment notes per appointment |
| `pos_sessions` | Point-of-sale cart sessions |
| `pos_line_items` | POS session line items |
| `class_seat_maps` | Seat layout for class occurrences/series |
| `class_seat_reservations` | Reserved seats on a map |
| `class_check_ins` | QR/token class check-in records |

## Workspace relations added

`customerFieldDefinitions`, `clientWalletAccounts`, `loyaltyPrograms`, `dynamicPricingRules`, `waitlistPriorityRules`, `appointmentTreatmentRecords`, `posSessions`, `classSeatMaps`, `classCheckIns`

## API routes

- `/api/appointments/service-booking/custom-fields`
- `/api/appointments/service-booking/client-wallet`
- `/api/appointments/service-booking/loyalty`
- `/api/appointments/service-booking/dynamic-pricing`
- `/api/appointments/service-booking/waitlist-priority`
- `/api/appointments/service-booking/treatment-records`
- `/api/appointments/service-booking/pos-cart`
- `/api/appointments/service-booking/class-check-in`
- `/api/appointments/service-booking/seat-selection`
- `/api/appointments/service-booking/global-search`
