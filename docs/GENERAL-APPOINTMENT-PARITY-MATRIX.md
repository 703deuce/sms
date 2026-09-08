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
| Recurring (full) | 3 | CODE_COMPLETE + UA_PENDING | type editor | InfoStep preview + manage scopes | `recurring-schedule`, `preview_recurring`, series edit/cancel | |
| Programs | 4 | CODE_COMPLETE + UA_PENDING | commerce admin programs | — | programs API + `programs.ts` | Enroll via package credits |
| Payment plans | 4 | CODE_COMPLETE + UA_PENDING | commerce admin payment plans | — | payment-plans API | Installment products in commerceStore |
| Multiple bookings session | 5 | CODE_COMPLETE + UA_PENDING | — | DateTimeStep cart + InfoStep checkout | `/api/public/book/[slug]/session` | Add to cart + session checkout |
| Customer self-service (full) | 6 | CODE_COMPLETE + UA_PENDING | — | manage + portal | manage APIs | ICS, book again, recurring scopes |
| Policy + money execution | 7 | CODE_COMPLETE + UA_PENDING | policies in type | — | `policySnapshot`, `policy-fees.ts` | Stripe/wallet fee paths; PROVIDER_BLOCKED live charge |
| Availability engine (full) | 8 | CODE_COMPLETE + UA_PENDING | availability blackouts UI | — | `blackoutDates` on platform config | Slot diagnostics via existing engine |
| Classes public enrollment | 9 | CODE_COMPLETE + UA_PENDING | `/appointments/classes` | `/book/[slug]/classes` | classes API | Public enroll page |
| Waitlist (full) | 10 | CODE_COMPLETE + UA_PENDING | — | WaitlistStep | waitlist APIs | Atomic claim on accept |
| Contacts + segment messaging | 11 | CODE_COMPLETE + UA_PENDING | `/appointments/segments` | — | appointment-segments API | Preset segments + message links |
| General commerce (wallet, loyalty) | 12 | CODE_COMPLETE + UA_PENDING | commerce/wallet APIs | entitlements wallet balance | `walletApplyCents` on book | Wallet debit at checkout |
| Calendar operations | 13 | CODE_COMPLETE + UA_PENDING | `/appointments/calendar` | — | calendar APIs | Empty-slot click → `/appointments/new` |
| Share / distribution hub | 14 | CODE_COMPLETE + UA_PENDING | `/appointments/booking/share` | deep links | embed + public URLs | Share hub page |
| Staff / teams | 15 | CODE_COMPLETE + UA_PENDING | settings staff | staff picker | scheduling-domain | Existing surfaces preserved |
| Global search, webhooks, imports | 16 | CODE_COMPLETE + UA_PENDING | overview search | — | global-search API | `AppointmentsGlobalSearch` on overview |
| Progressive disclosure nav | 17 | CODE_COMPLETE + UA_PENDING | product nav | — | `scheduling-modules.ts` | `buildAppointmentsV1Nav({ modules })` |

## UA_PENDING queue (certify on stable deployment)

1. Resource booking end-to-end with reload verification
2. Add-on selection + checkout total
3. Entitlement auto-apply without package code
4. Recurring series edit/cancel scopes
5. Class public enrollment
6. Policy fee charge on late cancel / no-show
7. Multi-booking session checkout
8. Wallet apply at public checkout
9. Calendar slot-click create with prefilled time

## PROVIDER_BLOCKED

- Live Stripe/Square charge flows require provider credentials in target environment
- Telnyx/voice paths unchanged by this pass
