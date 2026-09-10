# Page Blueprint — Forms & Documents (Batch 8B-1)

**Route:** `/appointments/booking/forms`  
**Status:** Batch 8B-1 implemented (new canonical page)  
**Primary user job:** Manage intake, contracts, and terms for booking.

## Sections

| Section | Component |
|---------|-----------|
| Intake templates | `FormsDocumentsClient` → IntakeTemplatesSection |
| Contract templates | `ContractsAdminClient` (reused) |
| Terms | TermsSection (version + body) |

## Gap records

| FEATURE ID | AUDIT GAP | FINAL SECTION | BACKEND | UI CONTROL | STATUS |
|------------|-----------|---------------|---------|------------|--------|
| 2-20 | Intake on type | Intake templates | `intake-forms.ts` | Full template CRUD + field types | ABSORBED_CANONICAL_UI |
| 2-42 | Contracts + e-sign | Contracts | `booking-contracts.ts` | ContractsAdminClient | ABSORBED_CANONICAL_UI |
| — | Terms versioning | Terms | settings API | Version + text editor | ABSORBED_CANONICAL_UI |
| — | File/image field types | Intake | intake types | file, image in builder | ABSORBED_CANONICAL_UI |

## Remaining

- Legacy `/appointments/commerce` intake tab preserved  
- Contextual assign from Service editor — ALREADY_PRESENT (`TypeIntakeFormsSection`)
