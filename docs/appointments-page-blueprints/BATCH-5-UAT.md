# Batch 5 UAT — Booking Dependencies + Booking Pages

| ID | Test | Status | Notes |
|----|------|--------|-------|
| R1 | Create room | UAT_PENDING | |
| R2 | Service requirement / capacity | UAT_PENDING | Requires public booking |
| R3 | Resource group | UAT_PENDING | |
| R4 | Quick create from service | UAT_PENDING | |
| R5 | Mobile / keyboard | UAT_PENDING | |
| F1 | Create intake form | UAT_PENDING | |
| F2 | File upload booking | UAT_PENDING | |
| F3 | Validation | UAT_PENDING | |
| F4 | Contract flow | UAT_PENDING | |
| F5 | Terms acceptance | UAT_PENDING | |
| F6 | Quick create forms | UAT_PENDING | |
| L1 | Create location | UAT_PENDING | |
| L2 | Custom hours | UAT_PENDING | |
| L3 | Service assignment | UAT_PENDING | |
| L4 | Staff assignment | UAT_PENDING | |
| L5 | Rooms at location | UAT_PENDING | |
| L6 | Quick create location | UAT_PENDING | |
| S1 | Create staff | UAT_PENDING | |
| S2 | Service eligibility | UAT_PENDING | |
| S3 | Location sync | UAT_PENDING | |
| S4 | Availability | UAT_PENDING | |
| S5 | Calendar connection | PROVIDER_BLOCKED | |
| S6 | Quick create staff | UAT_PENDING | |
| B1 | General booking settings | UAT_PENDING | |
| B2 | Branding | UAT_PENDING | |
| B3 | Terminology | UAT_PENDING | |
| B4 | Share links | UAT_PENDING | |
| B5 | QR code | UAT_PENDING | |
| B6 | Embed | UAT_PENDING | |
| B7 | Single-use links | UAT_PENDING | |
| B8 | Custom domain | ENV_BLOCKED | |
| B9 | Mobile / keyboard | UAT_PENDING | |

## Redirects verified

- `/appointments/resources` → `/appointments/rooms-equipment`
- `/appointments/contracts` → `/appointments/forms-documents?tab=contracts`
- `/appointments/booking/share` → `/appointments/booking?section=share`
- `/appointments/booking/branding` → `/appointments/booking?section=branding`
