# Appointments — Temporary Route Unique-Feature Audit (Batch 8G0)

**Generated:** 2026-09-10
**Method:** Filesystem discovery + mechanical evidence checks + internal reference scan

| Route | Classification | Unique V1 (before→now) | Feature IDs (now) | Canonical destination | Internal refs |
|-------|----------------|------------------------:|-------------------|------------------------|--------------:|
| `/appointments/booking/branding` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/booking hub | 5 |
| `/appointments/booking/contracts` | READY_FOR_RETIREMENT | 0→0 | — | Duplicate of /appointments/booking/forms | 3 |
| `/appointments/booking/share` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/booking hub | 10 |
| `/appointments/categories` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/types | 7 |
| `/appointments/classes` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/types/classes | 11 |
| `/appointments/client-restrictions` | READY_FOR_RETIREMENT | 0→0 | — | /contacts/[id] Booking Access | 4 |
| `/appointments/commerce` | READY_FOR_RETIREMENT | 12→0 | — | /appointments/packages (+ memberships, gift-cards, discounts, pos) | 22 |
| `/appointments/commerce/contact-merge` | READY_FOR_RETIREMENT | 0→0 | — | /contacts merge modal | 2 |
| `/appointments/contracts` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/booking/forms | 9 |
| `/appointments/coupons` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/discounts | 7 |
| `/appointments/no-show-recovery` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/automations/no-show | 25 |
| `/appointments/payments` | V2_ONLY | 1→0 | — | V2 deferred — hide from V1 nav | 6 |
| `/appointments/policies` | READY_FOR_RETIREMENT | 1→0 | — | /appointments/types → Policies (per-type) + /appointments/booking for workspace defaults | 6 |
| `/appointments/recall-campaigns` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/automations/recall | 25 |
| `/appointments/reports/service-booking` | READY_FOR_RETIREMENT | 1→0 | — | /appointments/analytics/reports | 4 |
| `/appointments/resources` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/booking/rooms-equipment | 8 |
| `/appointments/restrictions` | READY_FOR_RETIREMENT | 0→0 | — | Duplicate client-restrictions | 6 |
| `/appointments/routing` | READY_FOR_RETIREMENT | 1→0 | — | /appointments/routing-forms — Answer-based routing rules panel | 27 |
| `/appointments/scheduled` | READY_FOR_RETIREMENT | 0→0 | — | /appointments | 7 |
| `/appointments/segments` | READY_FOR_RETIREMENT | 0→0 | — | /contacts/segments + /appointments/recalls | 4 |
| `/appointments/service-booking` | READY_FOR_RETIREMENT | 0→0 | — | Alias hub entry — canonical pages exist | 122 |
| `/appointments/voice-reminders` | READY_FOR_RETIREMENT | 0→0 | — | /appointments/reminders | 14 |

**Commerce unique required V1:** 0 (none)
**Policies unique required V1:** 0 (none)
**Service-booking report unique required V1:** 0 (none)
**Old routing unique required V1:** 0 (none)
**Temp routes blocking convergence (STILL_HAS_UNIQUE_V1 + COMPATIBILITY_REQUIRED):** 0
**Temp routes ready for retirement:** 21
**Temp routes discovered (non-canonical):** 22
