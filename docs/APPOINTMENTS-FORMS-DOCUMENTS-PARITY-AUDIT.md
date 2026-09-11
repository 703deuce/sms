# Forms & Documents — Competitive Parity Audit

Runtime-verified where noted. Route: `/appointments/forms-documents`. Builder: shared `IntakeFormFieldBuilder` (same implementation as service-booking intake admin).

| Capability | Result | Notes |
|------------|--------|-------|
| Custom questions | PASS | `IntakeForm` JSON fields; builder + public Info step |
| Required fields | PASS | Client validation in `use-public-booking-flow`; server saves answers |
| Multiple choice | PASS | `select`, `radio`, `multiselect` types |
| Checkbox / consent | PASS | `checkbox`, `agreement` |
| File upload | PASS | `file` + `/intake-upload` public API |
| Image upload | PASS | `image` + upload API |
| E-signature (intake) | PASS | `signature` field type on intake forms |
| Waivers (intake) | PASS | Inferred kind + signature/agreement fields |
| Contracts / agreements | PARTIAL | Formal templates: `BookingContractTemplate` + `/appointments/contracts`; intake agreements separate |
| Assign to multiple offerings | PASS | `intakeFormIds[]` on type config; assignment modal PATCH |
| Service assignment | PASS | Service customer setup + Forms assignments |
| Class assignment | PASS | `intakeFormIds` on class metadata |
| Workshop assignment | PASS | Same as class |
| Meeting assignment | PASS | Types with `bookingTypeKind: MEETING` in assignment index |
| During-booking completion | PASS | Active forms on type shown in public booking Info step |
| Post-booking completion | GAP | Metadata UI exposes timing; runtime does not collect after book |
| Due before appointment | GAP | Not enforced in runtime |
| Completion tracking | PARTIAL | Unsigned `SignedBookingContract` rows; intake pending not fully derived |
| Submission history | PASS | `IntakeFormResponse` + workspace submissions table |
| Contact history | PARTIAL | Responses store `contactId`; contact UI linkage not expanded in this pass |
| Appointment history | PARTIAL | Manage-appointment + appointment detail intake; not unified chip on all views |
| Document version snapshots | PASS | `formVersion` on responses; contract `bodySnapshot` + `templateVersion` |
| Mobile completion | PASS | Public Info step responsive (existing booking UI) |
| Conditional logic | PARTIAL | Builder stores `conditionalOn`; public renderer may not hide fields — verify |
| Multi-step forms | N/A | No page-break field in schema |
