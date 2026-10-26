# Clean parity gaps (Phase 18)

Adds general-platform appointment parity tables:

- `booking_contract_templates` / `signed_booking_contracts` — e-signature contracts
- `booking_invoices` / `booking_invoice_line_items` — service invoices
- `booking_products` — simple products-for-sale catalog
- `scheduling_resource_groups` — pooled resource selection
- `class_admission_tickets` — event/class ticket QR admission

Applied via `npx prisma migrate deploy`.
