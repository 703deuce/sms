# Page Blueprint — Forms & Documents (Batch 8B-1)

**Route:** `/appointments/booking/forms`  
**Primary user job:** Create reusable information and agreements customers complete during booking.

## Structure

1. **Intake forms** — list table + builder (`intake-forms.ts`)
2. **Contracts** — `ContractsAdminClient` (`booking-contracts.ts`)
3. **Terms** — workspace terms version editor

## Intake forms

- List columns: Name, Fields, Status, Actions
- Field types: short/long text, number, date, dropdown, checkbox, file, image, signature, agreement
- Assign from Service editor via contextual create

## Status

ABSORBED_CANONICAL_UI for intake list/builder and contracts shell. STILL_MISSING: per-form "Used by" column with live assignment query; terms version history UI; contract preview modal polish.

## Absorbed from

- `/appointments/commerce` intake templates
- Legacy intake admin routes
