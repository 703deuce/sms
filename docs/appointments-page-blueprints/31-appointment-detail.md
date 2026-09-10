# Blueprint 31 — Appointment Detail (`/appointments/[id]`)

**Classification:** KEEP VISUAL + EXTEND FUNCTIONALITY

## BATCH 8B-3 ABSORPTION GAPS

| Feature | Current State | Final Section | Backend | Status |
|---|---|---|---|
| Service phases | Missing | Appointment details | `service-phases.ts`, `staff-phase-occupancy.ts` | ABSORBED |
| Rooms & equipment | Missing | Appointment details | `resourceLabels` metadata | ABSORBED |
| Add-ons | Missing | Appointment details | `add-ons.ts`, `addOnIds` metadata | ABSORBED |
| Intake files | Missing | Customer information | `intakeFormResponse` | ABSORBED |
| Package/membership credits | Missing | Payments & access | `entitlementPayment` metadata | ABSORBED |
| Partial/account-credit refund | Full refund only | Payment row | `appointment-refunds.ts` | ABSORBED |
| Recurring series | Missing | Recurring series card | `recurringSeriesId` metadata | ABSORBED |
| Policy/terms snapshots | Partial | Documents & policies | `policy-snapshot.ts`, `termsAcceptance` | ABSORBED |
| Demo avatar | Hardcoded `SJ` | Customer card | Contact initials | ABSORBED |
