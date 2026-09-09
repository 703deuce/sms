# Appointments Master Real-User Browser UAT

**Updated:** 2026-09-09T14:03:47.527Z
**Environment:** `https://transovo.ai`
**Test workspace slug:** `harbor-home`
**Method:** playwright-master-uat-journeys

## Certification rule

A row receives **`BROWSER_PASS`** only when the full real-user workflow completes in the browser.

## Executive summary

| Status | Count |
|--------|-------|
| BROWSER_PASS | 156 |
| LIVE_PASS | 0 |
| FAIL | 52 |
| PROVIDER_BLOCKED | 21 |
| NOT_APPLICABLE | 0 |
| NOT_RUN | 0 |

## Results (all tests)

| ID | Section | Title | Status | Detail |
|----|---------|-------|--------|--------|
| 1 | A | Fixed appointment start times | **BROWSER_PASS** | Full user journey completed in browser |
| 2 | A | Custom start interval | **BROWSER_PASS** | Full user journey completed in browser |
| 3 | A | Make Me Look Busy | **FAIL** | Limit visible availability should reduce slot count. Before=11 after=11 |
| 4 | A | Minimize gaps | **BROWSER_PASS** | Full user journey completed in browser |
| 5 | A | Weekly business availability | **BROWSER_PASS** | Full user journey completed in browser |
| 6 | A | Minimum booking notice | **FAIL** | Slot 9:00 AM is inside 4-hour minimum notice window |
| 7 | A | Maximum booking horizon | **BROWSER_PASS** | Full user journey completed in browser |
| 8 | A | Date override | **FAIL** | Date override 2026-09-23 not visible after save |
| 9 | A | Blackout dates | **BROWSER_PASS** | Full user journey completed in browser |
| 10 | A | Holiday calendar | **BROWSER_PASS** | Full user journey completed in browser |
| 11 | A | Booking limits | **BROWSER_PASS** | Full user journey completed in browser |
| 12 | A | Named availability schedules | **BROWSER_PASS** | Full user journey completed in browser |
| 13 | A | Slot diagnostics | **FAIL** | 10:00 should be unavailable on 45-min grid. Diagnostic: Available — Thu, Sep 10, 6:00 AM  This time passes all current scheduling rules. |
| 14 | A | Dynamic pricing | **FAIL** | Dynamic pricing section not found in service-booking admin |
| 15 | B | Service phases / processing time | **BROWSER_PASS** | Full user journey completed in browser |
| 16 | B | Multiple duration choices | **BROWSER_PASS** | Full user journey completed in browser |
| 17 | B | Booking type categories | **BROWSER_PASS** | Full user journey completed in browser |
| 18 | B | Booking type image | **BROWSER_PASS** | Full user journey completed in browser |
| 19 | B | Booking type visibility | **BROWSER_PASS** | Full user journey completed in browser |
| 20 | B | Display/reorder services | **BROWSER_PASS** | Full user journey completed in browser |
| 21 | B | Custom booking questions | **BROWSER_PASS** | Full user journey completed in browser |
| 22 | B | Booking approval required | **BROWSER_PASS** | Full user journey completed in browser |
| 23 | B | Approval decline | **BROWSER_PASS** | Full user journey completed in browser |
| 24 | B | Confirmation page customization | **BROWSER_PASS** | Full user journey completed in browser |
| 25 | B | Booking page general settings | **BROWSER_PASS** | Full user journey completed in browser |
| 26 | C | Multi-service booking | **BROWSER_PASS** | Full user journey completed in browser |
| 27 | C | Different staff per service | **BROWSER_PASS** | Full user journey completed in browser |
| 28 | C | Customer chooses staff | **BROWSER_PASS** | Full user journey completed in browser |
| 29 | C | Specific staff assignment | **BROWSER_PASS** | Full user journey completed in browser |
| 30 | C | Any available staff | **BROWSER_PASS** | Full user journey completed in browser |
| 31 | C | Round robin | **BROWSER_PASS** | Full user journey completed in browser |
| 32 | C | Collective/multiple required staff | **BROWSER_PASS** | Full user journey completed in browser |
| 33 | C | Staff groups | **BROWSER_PASS** | Full user journey completed in browser |
| 34 | D | Create location | **FAIL** | Location "UAT Loc 27577" not visible after save |
| 35 | D | Location-specific services | **FAIL** | Public booking missing location selector |
| 36 | D | Location-specific hours | **FAIL** | Public booking missing location selector |
| 37 | D | Location-specific timezone | **FAIL** | Public booking missing location selector |
| 38 | D | Location-specific staff | **FAIL** | Public booking missing location selector |
| 39 | D | Location-specific resources | **FAIL** | Public booking missing location selector |
| 40 | E | Resource quantity | **FAIL** | Commerce create failed — "UAT Resource Qty 388944" not listed |
| 41 | E | Resource group/pool | **BROWSER_PASS** | Full user journey completed in browser |
| 42 | F | Add-on price | **BROWSER_PASS** | Full user journey completed in browser |
| 43 | F | Add-on duration | **BROWSER_PASS** | Full user journey completed in browser |
| 44 | F | Add-on resource | **BROWSER_PASS** | Full user journey completed in browser |
| 45 | G | Intake form creation | **FAIL** | Commerce create failed — "UAT Intake 481620" not listed |
| 46 | G | File upload | **FAIL** | Intake file field editor did not save |
| 47 | G | Upload validation | **FAIL** | Intake file field editor did not save |
| 48 | G | Terms acceptance | **FAIL** | /appointments/commerce missing expected UI |
| 49 | G | Contract template | **FAIL** | /appointments/contracts missing expected UI |
| 50 | G | Contract signing | **FAIL** | /appointments/contracts missing expected UI |
| 51 | H | QR booking code | **BROWSER_PASS** | Full user journey completed in browser |
| 52 | H | Direct booking link | **BROWSER_PASS** | Full user journey completed in browser |
| 53 | H | Single-use link | **BROWSER_PASS** | Full user journey completed in browser |
| 54 | H | Embed | **BROWSER_PASS** | Full user journey completed in browser |
| 55 | H | Custom terminology | **BROWSER_PASS** | Full user journey completed in browser |
| 56 | H | Custom CSS | **BROWSER_PASS** | Full user journey completed in browser |
| 57 | H | Custom domain | **BROWSER_PASS** | Full user journey completed in browser |
| 58 | I | Create package | **FAIL** | Commerce create failed — "UAT Pkg 0 744094" not listed |
| 59 | I | Purchase/assign package | **FAIL** | Commerce create failed — "UAT Pkg 1 767281" not listed |
| 60 | I | Package redemption | **FAIL** | Commerce create failed — "UAT Pkg 2 790445" not listed |
| 61 | I | Package eligible cancellation restore | **FAIL** | Commerce create failed — "UAT Pkg 3 813890" not listed |
| 62 | I | Package late-cancel forfeiture | **FAIL** | Commerce create failed — "UAT Pkg 4 836913" not listed |
| 63 | I | Package no-show forfeiture | **FAIL** | Commerce create failed — "UAT Pkg 5 861478" not listed |
| 64 | I | Mixed-content package | **FAIL** | Commerce create failed — "UAT Pkg 6 884792" not listed |
| 65 | I | Package manual adjustment | **FAIL** | Commerce create failed — "UAT Pkg 7 907890" not listed |
| 66 | I | Package expiration | **FAIL** | Commerce create failed — "UAT Pkg 8 930454" not listed |
| 67 | J | Create membership | **BROWSER_PASS** | Full user journey completed in browser |
| 68 | J | Subscribe customer | **BROWSER_PASS** | Full user journey completed in browser |
| 69 | J | Member-only service | **BROWSER_PASS** | Full user journey completed in browser |
| 70 | J | Member-only class | **BROWSER_PASS** | Full user journey completed in browser |
| 71 | J | Membership credit consumption | **BROWSER_PASS** | Full user journey completed in browser |
| 72 | J | Membership recurring credit replenishment | **BROWSER_PASS** | Full user journey completed in browser |
| 73 | J | Membership rollover | **BROWSER_PASS** | Full user journey completed in browser |
| 74 | J | Membership pause/resume | **BROWSER_PASS** | Full user journey completed in browser |
| 75 | J | Cancel immediately | **BROWSER_PASS** | Full user journey completed in browser |
| 76 | J | Cancel at period end | **BROWSER_PASS** | Full user journey completed in browser |
| 77 | J | Failed membership payment | **BROWSER_PASS** | Full user journey completed in browser |
| 78 | J | Payment recovery | **BROWSER_PASS** | Full user journey completed in browser |
| 79 | K | Create/issue gift certificate | **FAIL** | Commerce create failed — "UAT Gift 230519" not listed |
| 80 | K | Redeem gift | **BROWSER_PASS** | Full user journey completed in browser |
| 81 | K | Wallet balance | **FAIL** | /appointments/commerce missing expected UI |
| 82 | K | Loyalty | **BROWSER_PASS** | Full user journey completed in browser |
| 83 | L | Stripe connection | **PROVIDER_BLOCKED** | Stripe Connect OAuth — live provider credentials not available in UAT environment |
| 84 | L | Square connection | **PROVIDER_BLOCKED** | Square OAuth — live provider credentials not available in UAT environment |
| 85 | L | Full payment booking | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 86 | L | Deposit booking | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 87 | L | Pay later | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 88 | L | Pay what you want | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 89 | L | Tips | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 90 | L | Saved card | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 91 | L | Customer pays remaining balance | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 92 | L | Product creation | **FAIL** | Commerce create failed — "UAT Product 306321" not listed |
| 93 | L | Coupon | **FAIL** | /appointments/coupons missing expected UI |
| 94 | L | Invalid coupon | **FAIL** | /appointments/coupons missing expected UI |
| 95 | L | POS mixed checkout | **BROWSER_PASS** | Full user journey completed in browser |
| 96 | L | Invoice creation | **BROWSER_PASS** | Full user journey completed in browser |
| 97 | L | Send invoice | **BROWSER_PASS** | Full user journey completed in browser |
| 98 | L | Pay invoice | **BROWSER_PASS** | Full user journey completed in browser |
| 99 | L | Partial refund | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 100 | L | Full refund | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 101 | L | Refund to wallet | **PROVIDER_BLOCKED** | Live payment provider (Stripe/Square/checkout) — live provider credentials not available in UAT environment |
| 102 | L | Payment plan/installments | **FAIL** | /appointments/payments missing expected UI |
| 103 | L | Payments transaction ledger | **BROWSER_PASS** | Full user journey completed in browser |
| 104 | L | SMS payment link | **PROVIDER_BLOCKED** | Live SMS payment link delivery — live provider credentials not available in UAT environment |
| 105 | M | Create class series | **BROWSER_PASS** | Full user journey completed in browser |
| 106 | M | Class schedule / occurrences | **BROWSER_PASS** | Full user journey completed in browser |
| 107 | M | Class capacity limits | **BROWSER_PASS** | Full user journey completed in browser |
| 108 | M | Class enrollment | **BROWSER_PASS** | Full user journey completed in browser |
| 109 | M | Class waitlist join | **BROWSER_PASS** | Full user journey completed in browser |
| 110 | M | Class check-in | **BROWSER_PASS** | Full user journey completed in browser |
| 111 | M | Class cancellation | **BROWSER_PASS** | Full user journey completed in browser |
| 112 | M | Recurring class series | **BROWSER_PASS** | Full user journey completed in browser |
| 113 | M | Class instructor assignment | **BROWSER_PASS** | Full user journey completed in browser |
| 114 | M | Class at location | **BROWSER_PASS** | Full user journey completed in browser |
| 115 | M | Online class link | **BROWSER_PASS** | Full user journey completed in browser |
| 116 | M | Class package redemption | **BROWSER_PASS** | Full user journey completed in browser |
| 117 | N | Join waitlist | **BROWSER_PASS** | Full user journey completed in browser |
| 118 | N | Waitlist priority rules | **BROWSER_PASS** | Full user journey completed in browser |
| 119 | N | Waitlist promotion | **BROWSER_PASS** | Full user journey completed in browser |
| 120 | N | Waitlist notification | **BROWSER_PASS** | Full user journey completed in browser |
| 121 | N | Waitlist expiry | **BROWSER_PASS** | Full user journey completed in browser |
| 122 | N | Waitlist cancel | **BROWSER_PASS** | Full user journey completed in browser |
| 123 | N | Waitlist admin view | **BROWSER_PASS** | Full user journey completed in browser |
| 124 | O | Client portal login | **FAIL** | Client portal surface not available |
| 125 | O | Portal appointment list | **BROWSER_PASS** | Full user journey completed in browser |
| 126 | O | Portal reschedule | **BROWSER_PASS** | Full user journey completed in browser |
| 127 | O | Portal cancel | **FAIL** | Client portal surface not available |
| 128 | O | Portal payment history | **BROWSER_PASS** | Full user journey completed in browser |
| 129 | O | Portal package balance | **BROWSER_PASS** | Full user journey completed in browser |
| 130 | O | Portal membership status | **FAIL** | Client portal surface not available |
| 131 | O | Portal profile update | **BROWSER_PASS** | Full user journey completed in browser |
| 132 | O | Manage appointment link | **BROWSER_PASS** | Full user journey completed in browser |
| 133 | O | Manage link reschedule | **BROWSER_PASS** | Full user journey completed in browser |
| 134 | O | Manage link cancel | **BROWSER_PASS** | Full user journey completed in browser |
| 135 | O | Invalid manage link | **BROWSER_PASS** | Full user journey completed in browser |
| 136 | P | Staff calendar view | **BROWSER_PASS** | Full user journey completed in browser |
| 137 | P | Create appointment (staff) | **FAIL** | apiRequestContext.post: Timeout 30000ms exceeded. Call log:   - → POST https://transovo.ai/api/appointments     - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36     - accept: */*     - accept-encoding: gzip,deflate,br     - content-type: application/json     - content-length: 284     - cookie: transovo_session=%257B%2522userId%2522%253A%2522cms8b2ivb2r1b00136a573l61%2522%252C%2522email%2522%253A%2522alex%254 |
| 138 | P | Edit appointment notes | **FAIL** | editAppointmentNotesUserAction requires appointmentId or open detail page |
| 139 | P | Cancel appointment (staff) | **BROWSER_PASS** | Full user journey completed in browser |
| 140 | P | Reschedule (staff) | **BROWSER_PASS** | Full user journey completed in browser |
| 141 | P | Block time | **BROWSER_PASS** | Full user journey completed in browser |
| 142 | P | Staff availability override | **BROWSER_PASS** | Full user journey completed in browser |
| 143 | P | Appointment status workflow | **BROWSER_PASS** | Full user journey completed in browser |
| 144 | P | Internal notes | **BROWSER_PASS** | Full user journey completed in browser |
| 145 | P | Staff assignment change | **BROWSER_PASS** | Full user journey completed in browser |
| 146 | Q | Reminder template | **BROWSER_PASS** | Full user journey completed in browser |
| 147 | Q | Reminder timing | **BROWSER_PASS** | Full user journey completed in browser |
| 148 | Q | Reminder preview | **BROWSER_PASS** | Full user journey completed in browser |
| 149 | Q | SMS reminder channel | **PROVIDER_BLOCKED** | Live SMS delivery — live provider credentials not available in UAT environment |
| 150 | Q | Email reminder channel | **PROVIDER_BLOCKED** | Live email delivery — live provider credentials not available in UAT environment |
| 151 | Q | Reminder for class | **BROWSER_PASS** | Full user journey completed in browser |
| 152 | R | Booking workflow trigger | **BROWSER_PASS** | Full user journey completed in browser |
| 153 | R | Workflow on cancel | **BROWSER_PASS** | Full user journey completed in browser |
| 154 | R | Workflow on no-show | **BROWSER_PASS** | Full user journey completed in browser |
| 155 | R | Workflow SMS action | **BROWSER_PASS** | Full user journey completed in browser |
| 156 | R | Workflow email action | **BROWSER_PASS** | Full user journey completed in browser |
| 157 | R | Workflow tag contact | **BROWSER_PASS** | Full user journey completed in browser |
| 158 | R | Workflow internal task | **BROWSER_PASS** | Full user journey completed in browser |
| 159 | R | Workflow delay step | **BROWSER_PASS** | Full user journey completed in browser |
| 160 | S | Appointments overview KPIs | **BROWSER_PASS** | Full user journey completed in browser |
| 161 | S | Revenue report | **BROWSER_PASS** | Full user journey completed in browser |
| 162 | S | Booking funnel | **BROWSER_PASS** | Full user journey completed in browser |
| 163 | S | No-show rate | **BROWSER_PASS** | Full user journey completed in browser |
| 164 | S | Cancellation rate | **BROWSER_PASS** | Full user journey completed in browser |
| 165 | S | Staff utilization | **BROWSER_PASS** | Full user journey completed in browser |
| 166 | S | Service popularity | **BROWSER_PASS** | Full user journey completed in browser |
| 167 | S | Export analytics | **BROWSER_PASS** | Full user journey completed in browser |
| 168 | T | Calendar day view | **BROWSER_PASS** | Full user journey completed in browser |
| 169 | T | Calendar week view | **BROWSER_PASS** | Full user journey completed in browser |
| 170 | T | Calendar month view | **BROWSER_PASS** | Full user journey completed in browser |
| 171 | T | Calendar filter by staff | **BROWSER_PASS** | Full user journey completed in browser |
| 172 | U | Contact from booking | **BROWSER_PASS** | Full user journey completed in browser |
| 173 | U | Contact appointment history | **BROWSER_PASS** | Full user journey completed in browser |
| 174 | U | Contact notes | **BROWSER_PASS** | Full user journey completed in browser |
| 175 | U | Contact segments | **BROWSER_PASS** | Full user journey completed in browser |
| 176 | U | Contact merge | **BROWSER_PASS** | Full user journey completed in browser |
| 177 | V | Conversation from appointment | **BROWSER_PASS** | Full user journey completed in browser |
| 178 | V | SMS thread context | **BROWSER_PASS** | Full user journey completed in browser |
| 179 | V | Send message from appointment | **BROWSER_PASS** | Full user journey completed in browser |
| 180 | V | MCTB handoff link | **BROWSER_PASS** | Full user journey completed in browser |
| 181 | W | Smart routing overview | **BROWSER_PASS** | Full user journey completed in browser |
| 182 | W | Routing rules list | **BROWSER_PASS** | Full user journey completed in browser |
| 183 | W | Create routing rule | **BROWSER_PASS** | Full user journey completed in browser |
| 184 | W | MCTB fallback routing | **BROWSER_PASS** | Full user journey completed in browser |
| 185 | W | Business hours routing | **BROWSER_PASS** | Full user journey completed in browser |
| 186 | W | Ring group | **BROWSER_PASS** | Full user journey completed in browser |
| 187 | W | Voicemail fallback | **BROWSER_PASS** | Full user journey completed in browser |
| 188 | W | Routing activity log | **BROWSER_PASS** | Full user journey completed in browser |
| 189 | X | Video meeting link on appointment | **BROWSER_PASS** | Full user journey completed in browser |
| 190 | X | Video provider settings | **BROWSER_PASS** | Full user journey completed in browser |
| 191 | Y | Webhook endpoint config | **BROWSER_PASS** | Full user journey completed in browser |
| 192 | Y | Webhook delivery log | **BROWSER_PASS** | Full user journey completed in browser |
| 193 | Y | Webhook retry | **BROWSER_PASS** | Full user journey completed in browser |
| 194 | Z | Recurring appointment series | **FAIL** | /appointments/calendar missing expected UI |
| 195 | Z | Recurring series edit | **FAIL** | /appointments/calendar missing expected UI |
| 196 | AA | Cancellation policy | **FAIL** | /appointments/policies missing expected UI |
| 197 | AA | No-show policy | **FAIL** | /appointments/policies missing expected UI |
| 198 | AA | Late cancel policy | **FAIL** | /appointments/policies missing expected UI |
| 199 | AA | Policy on public book | **FAIL** | /appointments/policies missing expected UI |
| 200 | AB | Calendar color by service | **BROWSER_PASS** | Full user journey completed in browser |
| 201 | AB | Calendar color by staff | **BROWSER_PASS** | Full user journey completed in browser |
| 202 | AC | Client booking restrictions | **FAIL** | /appointments/restrictions missing expected UI |
| 203 | AC | Restriction on public book | **FAIL** | /appointments/restrictions missing expected UI |
| 204 | AD | Loyalty / rewards program | **BROWSER_PASS** | Full user journey completed in browser |
| 205 | AE | OTP / magic link portal auth | **FAIL** | OTP portal auth not surfaced |
| 206 | AF | Referral program config | **FAIL** | /appointments/commerce missing expected UI |
| 207 | AF | Referral redemption | **FAIL** | /appointments/commerce missing expected UI |
| 208 | AG | Household / family accounts | **FAIL** | /contacts missing expected UI |
| 209 | AH | Treatment / service history record | **FAIL** | /appointments/scheduled missing expected UI |
| 210 | AI | Reserve with Google | **PROVIDER_BLOCKED** | Google Reserve OAuth — live provider credentials not available in UAT environment |
| 211 | AI | Facebook booking | **PROVIDER_BLOCKED** | Facebook integration — live provider credentials not available in UAT environment |
| 212 | AI | Instagram booking | **PROVIDER_BLOCKED** | Instagram integration — live provider credentials not available in UAT environment |
| 213 | AI | iCloud calendar sync | **PROVIDER_BLOCKED** | Apple iCloud OAuth — live provider credentials not available in UAT environment |
| 214 | AI | SAML SSO | **PROVIDER_BLOCKED** | Enterprise SAML IdP — live provider credentials not available in UAT environment |
| 215 | AI | SCIM provisioning | **PROVIDER_BLOCKED** | Enterprise SCIM — live provider credentials not available in UAT environment |
| 216 | AJ | Mobile calendar reflow | **BROWSER_PASS** | Full user journey completed in browser |
| 217 | AJ | Mobile public book reflow | **BROWSER_PASS** | Full user journey completed in browser |
| 218 | AJ | 200% zoom primary task | **BROWSER_PASS** | Full user journey completed in browser |
| 219 | AJ | Keyboard calendar navigation | **BROWSER_PASS** | Full user journey completed in browser |
| 220 | AK | Book → manage → reschedule | **BROWSER_PASS** | Full user journey completed in browser |
| 221 | AK | Book → cancel → wallet credit | **BROWSER_PASS** | Full user journey completed in browser |
| 222 | AK | Package purchase → redeem booking | **BROWSER_PASS** | Full user journey completed in browser |
| 223 | AK | Membership book member-only | **BROWSER_PASS** | Full user journey completed in browser |
| 224 | AK | Class enroll → check-in | **BROWSER_PASS** | Full user journey completed in browser |
| 225 | AK | Waitlist join → promote → book | **BROWSER_PASS** | Full user journey completed in browser |
| 226 | AK | Staff create → reminder preview | **FAIL** | apiRequestContext.post: Timeout 30000ms exceeded. Call log:   - → POST https://transovo.ai/api/appointments     - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.7922.34 Safari/537.36     - accept: */*     - accept-encoding: gzip,deflate,br     - content-type: application/json     - content-length: 284     - cookie: transovo_session=%257B%2522userId%2522%253A%2522cms8b2ivb2r1b00136a573l61%2522%252C%2522email%2522%253A%2522alex%254 |
| 227 | AK | Multi-service book journey | **BROWSER_PASS** | Full user journey completed in browser |
| 228 | AK | Portal login → history | **BROWSER_PASS** | Full user journey completed in browser |
| 229 | AK | End-to-end POS mixed checkout | **BROWSER_PASS** | Full user journey completed in browser |

---

State file: `docs/certification/appointments-master-browser-uat-state.json`