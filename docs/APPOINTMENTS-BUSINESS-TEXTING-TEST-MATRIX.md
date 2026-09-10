# Appointments Business Texting — Test Matrix (BT-TEST-01–20)

**Runners:**
- Static: `node scripts/test-appointments-business-texting.mjs`
- Browser: `DEV_AUTH_BYPASS=1 node scripts/test-appointments-business-texting-browser.mjs`

| ID | Test | Status | Notes |
|----|------|--------|-------|
| BT-TEST-01 | Navigation / canonical route | PASS | `/appointments/campaigns` + V1 nav flag |
| BT-TEST-02 | Booking-created Contact → Campaign | PASS | Shared Contact + `audience.ts` |
| BT-TEST-03 | Imported Contact → Campaign | PASS | Import wizard + canonical path helper |
| BT-TEST-04 | Saved Segment → Campaign audience | PASS | Segment resolution in `audience.ts` |
| BT-TEST-05 | Appointment-aware audience preset | TEST_ENVIRONMENT | Static + API wired; picker render slow in dev |
| BT-TEST-06 | Draft persistence | PASS | `compose-draft` session storage |
| BT-TEST-07 | Schedule persistence / processing | PASS | Draft fields + mass-texting schedule APIs |
| BT-TEST-08 | Actual test-safe send pipeline | **PROVIDER_BLOCKED** | Requires controlled sender + provider credentials |
| BT-TEST-09 | STOP / suppression | PASS | `test-mass-texting-campaign-guards.ts` |
| BT-TEST-10 | Campaign recipient reply → Inbox | **PROVIDER_BLOCKED** | Requires inbound provider webhook |
| BT-TEST-11 | Contact Detail → Message | PASS | Browser: `/conversations?contactId=` |
| BT-TEST-12 | No approved sender gate | PASS | `assertMassTextMarketingSendAllowed` |
| BT-TEST-13 | Approved sender unlock | PASS | Server gate + `BusinessTextingActivationPanel` |
| BT-TEST-14 | Template selection/rendering | PASS | Composer `/api/templates` picker |
| BT-TEST-15 | Campaign results | PASS | Browser: completed campaign detail |
| BT-TEST-16 | Legacy vs canonical route equivalence | PASS | 4/4 pairs browser |
| BT-TEST-17 | Desktop visual consistency | PASS | Review, recurring, filters migrated |
| BT-TEST-18 | Mobile | **PASS** | 390px list + create; not PROVIDER_BLOCKED |
| BT-TEST-19 | Accessibility | **PASS** | Labels, focus, segment toggle; not PROVIDER_BLOCKED |
| BT-TEST-20 | MCTB boundary regression | PASS | `test-mass-texting-boundary.ts` |

## Classification rules (enforced)

- **Only BT-TEST-08 and BT-TEST-10** may be `PROVIDER_BLOCKED`
- **BT-TEST-18 and BT-TEST-19** must run locally → PASS or FAIL (never PROVIDER_BLOCKED)
- `TEST_ENVIRONMENT` when fixture/dev prevents full proof (not a product defect)

## Gate semantics

| Gate | Value |
|------|-------|
| `BUSINESS_TEXTING_PRODUCT_IMPLEMENTATION_COMPLETE` | YES (0 FAIL) |
| `BUSINESS_TEXTING_PROVIDER_CERTIFIED` | NO |
| `BUSINESS_TEXTING_ABSORPTION_COMPLETE` | YES |
| `READY_TO_RESUME_FINAL_PRODUCT_CERTIFICATION` | YES |
