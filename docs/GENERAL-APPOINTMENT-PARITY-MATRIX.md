# GENERAL APPOINTMENT PARITY MATRIX

**Status:** Code-pass inventory (UA certification deferred)  
**Updated:** 2026-09-08  
**Authority:** `docs/GENERAL-APPOINTMENT-GAP-CLOSURE-DIRECTIVE.md`

Status values: `CODE_COMPLETE`, `CODE_COMPLETE + UA_PENDING`, `PARTIAL`, `EXISTS_BUT_NOT_WIRED`, `MISSING`, `PROVIDER_BLOCKED`, `UA_PENDING`

| Capability | Phase | Transovo status | Admin UI | Public UI | API/runtime | Notes |
|------------|-------|-----------------|----------|-----------|-------------|-------|
| Booking archetypes MEETING/SERVICE/CLASS | 1 | CODE_COMPLETE + UA_PENDING | `/appointments/types` | kind on public GET | `bookingTypeKind` on config | Soft defaults; all capabilities in Advanced |
| Resources — configure on type | 2 | CODE_COMPLETE + UA_PENDING | Type editor + `/appointments/resources` | — | `resourceIds` on config | |
| Resources — availability enforcement | 2 | CODE_COMPLETE + UA_PENDING | — | slots filtered | `resource-availability.ts`, `getAvailability` | |
| Resources — persist on book | 2 | CODE_COMPLETE + UA_PENDING | — | — | `persistAppointmentResources`, service line | |
| Resources — manage link display | 2 | CODE_COMPLETE + UA_PENDING | — | manage page | manage GET + `resourceLabels` | |
| Add-ons — configure on type | 2 | CODE_COMPLETE + UA_PENDING | Type editor + commerce | — | `addOnIds` on config | |
| Add-ons — public selection | 2 | CODE_COMPLETE + UA_PENDING | — | InfoStep | public book POST `addOnSelections` | Checkout price merge UA_PENDING |
| Categories + images | 2 | PARTIAL | `/appointments/categories` | ServiceStep | categories API | Direct category links PARTIAL |
| Intake forms | 2 | PARTIAL | `/appointments` intake section | manage intake | intake APIs | Conditional fields PARTIAL |
| Custom client fields | 2 | EXISTS_BUT_NOT_WIRED | API only | — | custom-fields API | Contacts UI PARTIAL |
| Package/membership entitlements | 2 | PARTIAL | commerce | InfoStep | booking-entitlements | Auto identity PARTIAL |
| Multi-service booking | 2 | EXISTS_BUT_NOT_WIRED | — | — | `multi-service.ts` | Public UI MISSING |
| Service phases | 2 | EXISTS_BUT_NOT_WIRED | phases admin | — | service-phases API | Availability integration PARTIAL |
| Recurring (full) | 3 | PARTIAL | type editor | basic recurring | recurring-series | Edit this/future/all MISSING |
| Programs | 4 | MISSING | — | — | — | |
| Payment plans | 4 | MISSING | — | — | — | |
| Multiple bookings session | 5 | MISSING | — | — | — | |
| Customer self-service (full) | 6 | PARTIAL | — | manage + portal | manage APIs | Recurring series actions PARTIAL |
| Policy + money execution | 7 | PARTIAL | policies in type | — | policy types only | Charge/refund execution MISSING |
| Availability engine (full) | 8 | PARTIAL | availability settings | — | availability-engine | Blackouts UI, why-unavailable MISSING |
| Classes public enrollment | 9 | PARTIAL | `/appointments/classes` | MISSING | classes API | |
| Waitlist (full) | 10 | PARTIAL | — | WaitlistStep | waitlist APIs | Atomic claim PARTIAL |
| Contacts + segment messaging | 11 | PARTIAL | contacts | — | SMS infra | Appointment segments MISSING |
| General commerce (wallet, loyalty) | 12 | PARTIAL | commerce/wallet APIs | portal wallet | phase2 libs | |
| Calendar operations | 13 | PARTIAL | `/appointments/calendar` | — | calendar APIs | Slot-click create MISSING |
| Share / distribution hub | 14 | PARTIAL | type links | deep links | book routes | QR/embed hub MISSING |
| Staff / teams | 15 | PARTIAL | settings staff | staff picker | scheduling-domain | Round robin PARTIAL |
| Global search, webhooks, imports | 16 | EXISTS_BUT_NOT_WIRED | — | — | APIs exist | UI MISSING |
| Progressive disclosure nav | 17 | PARTIAL | product nav | — | v1-launch-nav | After wiring complete |

## UA_PENDING queue (certify on stable deployment)

1. Resource booking end-to-end with reload verification
2. Add-on selection + checkout total
3. Entitlement auto-apply without package code
4. Recurring series edit/cancel scopes
5. Class public enrollment
6. Policy fee charge on late cancel / no-show

## PROVIDER_BLOCKED

- Live Stripe/Square charge flows require provider credentials in target environment
- Telnyx/voice paths unchanged by this pass
