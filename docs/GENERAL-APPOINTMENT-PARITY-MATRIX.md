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
| Add-ons — public selection | 2 | CODE_COMPLETE + UA_PENDING | — | InfoStep | public book POST `addOnSelections` | Checkout merges add-on totals |
| Categories + images | 2 | CODE_COMPLETE + UA_PENDING | Type editor + `/appointments/categories` | ServiceStep | categories API + `categoryId`/`imageUrl` on config | |
| Intake forms | 2 | CODE_COMPLETE + UA_PENDING | Type editor + intake admin | InfoStep + manage | intake APIs + POST `intakeResponses` | |
| Custom client fields | 2 | CODE_COMPLETE + UA_PENDING | custom-fields API | InfoStep | public GET + POST `customFieldValues` | |
| Package/membership entitlements | 2 | CODE_COMPLETE + UA_PENDING | commerce | InfoStep auto-suggest | `suggestAutoEntitlement` | Single match auto-applies |
| Multi-service booking | 2 | CODE_COMPLETE + UA_PENDING | — | DateTimeStep + ServiceStep | `multiServiceLines` POST | Chained after primary slot |
| Service phases | 2 | CODE_COMPLETE + UA_PENDING | Type editor phases section | — | `resolveEffectiveTypeDurationMinutes` | Availability uses phase total |
| Recurring (full) | 3 | PARTIAL | type editor | basic recurring + preview API | recurring-series + `preview_recurring` | Manage cancel scopes wired; edit scopes PARTIAL |
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
