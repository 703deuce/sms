# Appointments Business Texting — Test Matrix (BT-TEST-01–20)

**Runner:** `node scripts/test-appointments-business-texting.mjs`

| ID | Test | Status | Notes |
|----|------|--------|-------|
| BT-TEST-01 | Navigation / canonical route | PASS | `/appointments/campaigns` + V1 nav flag |
| BT-TEST-02 | Booking-created Contact → Campaign | PASS | Shared Contact + `audience.ts` |
| BT-TEST-03 | Imported Contact → Campaign | PASS | Import form → canonical campaigns path |
| BT-TEST-04 | Saved Segment → Campaign audience | PASS | Segment resolution in `audience.ts` |
| BT-TEST-05 | Appointment-aware audience preset | PASS | `appointment_preset` + suggested picker group |
| BT-TEST-06 | Draft persistence | PASS | `compose-draft` session storage |
| BT-TEST-07 | Schedule persistence / processing | PASS | Draft fields + mass-texting schedule APIs (live activation PROVIDER_BLOCKED) |
| BT-TEST-08 | Actual test-safe send pipeline | PROVIDER_BLOCKED | Needs controlled sender/recipient + provider env |
| BT-TEST-09 | STOP / suppression | PASS | `test-mass-texting-campaign-guards.ts` |
| BT-TEST-10 | Campaign recipient reply → Inbox | PROVIDER_BLOCKED | Needs inbound webhook smoke |
| BT-TEST-11 | Contact Detail → Message | PASS | `ContactMessageAction` |
| BT-TEST-12 | No approved sender gate | PASS | `assertMassTextMarketingSendAllowed` |
| BT-TEST-13 | Approved sender unlock | PASS | Server gate (UI: `BusinessTextingActivationPanel`) |
| BT-TEST-14 | Template selection/rendering | PASS | Composer `/api/templates` picker |
| BT-TEST-15 | Campaign results | PASS | Existing `campaign-results` + mass-texting stats APIs |
| BT-TEST-16 | Legacy vs canonical route equivalence | PASS | Path helpers; internal Appointments links fixed |
| BT-TEST-17 | Desktop visual consistency | PASS* | *Phase-1 primitives; review/recurring partial |
| BT-TEST-18 | Mobile | PROVIDER_BLOCKED | Browser capture required |
| BT-TEST-19 | Accessibility | PROVIDER_BLOCKED | Browser a11y audit required |
| BT-TEST-20 | MCTB boundary regression | PASS | `test-mass-texting-boundary.ts` |
