# Client Portal Parity Audit

| Capability | Status |
|------------|--------|
| Client login | PASS (email OTP) |
| Passwordless / magic link | PASS |
| Upcoming / past / cancelled | PASS |
| Appointment detail | PASS |
| Reschedule | PARTIAL (manage link + datetime; not full slot UI in `/client`) |
| Cancel | PASS |
| Rebook / book new | PASS (prefilled book URL) |
| Service/Class/Workshop/Meeting display | PARTIAL (offeringKind field; limited copy) |
| Join video | PASS when link in metadata |
| Forms to complete | GAP |
| Document signing | GAP (use manage flow) |
| Package balance | PASS |
| Membership status | PASS |
| Open balance / pay | PASS |
| Payment history | PARTIAL |
| Invoices | GAP |
| Account credit | PASS |
| Saved payment methods | GAP on `/client` (legacy token page only) |
| Profile edit | PASS (no email change) |
| Business branding | PARTIAL (`settingsJson.bookingBranding`) |
| Mobile portal | PASS (bottom nav, cards) |
| Tenant isolation | PASS (design); E2E BLOCKED |
| Resource authorization | PASS (design); E2E BLOCKED |
