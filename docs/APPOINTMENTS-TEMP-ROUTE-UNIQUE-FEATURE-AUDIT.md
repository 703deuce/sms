# Appointments — Temporary Route Unique-Feature Audit (Batch 8E)

**Generated:** 2026-09-10
**Method:** Filesystem discovery under `src/app/(app)/appointments/**` + IA classification

| Route | Classification | Unique V1 functions | Canonical destination |
|-------|----------------|--------------------:|------------------------|
| `/appointments/booking/branding` | READY_FOR_RETIREMENT | 0 | /appointments/booking hub |
| `/appointments/booking/contracts` | READY_FOR_RETIREMENT | 0 | Duplicate of /appointments/booking/forms |
| `/appointments/booking/share` | READY_FOR_RETIREMENT | 0 | /appointments/booking hub |
| `/appointments/categories` | READY_FOR_RETIREMENT | 0 | /appointments/types |
| `/appointments/classes` | READY_FOR_RETIREMENT | 0 | /appointments/types/classes |
| `/appointments/client-restrictions` | READY_FOR_RETIREMENT | 0 | /contacts/[id] Booking Access |
| `/appointments/commerce` | STILL_HAS_UNIQUE_V1 | 12 | Split to packages/memberships/gift-cards/discounts/pos |
| `/appointments/commerce/contact-merge` | READY_FOR_RETIREMENT | 0 | /contacts merge modal |
| `/appointments/contracts` | READY_FOR_RETIREMENT | 0 | /appointments/booking/forms |
| `/appointments/coupons` | READY_FOR_RETIREMENT | 0 | /appointments/discounts |
| `/appointments/no-show-recovery` | READY_FOR_RETIREMENT | 0 | /appointments/automations/no-show |
| `/appointments/payments` | V2_ONLY | 1 | V2 deferred — /appointments/payments |
| `/appointments/policies` | STILL_HAS_UNIQUE_V1 | 1 | /appointments/types Advanced tab |
| `/appointments/recall-campaigns` | READY_FOR_RETIREMENT | 0 | /appointments/automations/recall |
| `/appointments/reports/service-booking` | STILL_HAS_UNIQUE_V1 | 1 | /appointments/analytics/reports |
| `/appointments/resources` | READY_FOR_RETIREMENT | 0 | /appointments/booking/rooms-equipment |
| `/appointments/restrictions` | READY_FOR_RETIREMENT | 0 | Duplicate client-restrictions |
| `/appointments/routing` | STILL_HAS_UNIQUE_V1 | 1 | /appointments/routing-forms |
| `/appointments/scheduled` | READY_FOR_RETIREMENT | 0 | /appointments |
| `/appointments/segments` | READY_FOR_RETIREMENT | 0 | /contacts/segments + /appointments/recalls |
| `/appointments/service-booking` | READY_FOR_RETIREMENT | 0 | Alias hub entry — canonical pages exist |
| `/appointments/voice-reminders` | READY_FOR_RETIREMENT | 0 | /appointments/reminders |

**Commerce unique required V1 count (estimate):** 15
**Temp routes with unique V1 (STILL_HAS_UNIQUE_V1):** 4
**Temp routes ready for retirement:** 17
**Temp routes discovered (non-canonical):** 22
