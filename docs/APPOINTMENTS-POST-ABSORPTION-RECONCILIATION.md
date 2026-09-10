# Appointments Post-Absorption Reconciliation (Batch 8C)

**Generated:** 2026-09-10  
**Type:** Mechanical implementation reconciliation — NOT browser UAT  
**Waves reconciled:** 8B-1 through 8B-9

## Executive summary

After Batches 8B-1–8B-9, mechanical re-audit of all **308** master ledger rows finds:

| Metric | Count |
|--------|------:|
| V1 rows | 295 |
| V2 rows | 11 |
| **V1_COMPLETE** | 99 |
| **V1_COMPLETE_RUNTIME_ONLY** | 30 |
| **V1_PROVIDER_BLOCKED** | 6 |
| **V1_ADMIN_UI_GAP** | 89 |
| **V1_PUBLIC_UI_GAP** | 35 |
| **V1_PORTAL_UI_GAP** | 12 |
| **V1_WRONG_PLACEMENT** | 16 |
| **V1_BACKEND_GAP** | 6 |
| **V1_MOCK_OR_PLACEHOLDER** | 2 |
| **V2_DEFERRED** | 12 |
| **UNASSIGNED_ERROR** | 0 |
| Residual implementation rows | 161 |
| Commerce unique V1 (temp hub) | 11 |
| Temp routes with unique V1 | 11 |

### Readiness

| Gate | Result |
|------|--------|
| **READY_FOR_ROUTE_CONVERGENCE** | **NO** |
| **READY_FOR_MASTER_BROWSER_CERTIFICATION** | **NO** |

Route convergence requires **zero** temp routes with unique required V1 functionality. Certification requires **zero** known implementation gaps (provider-blocked and runtime-only excepted).

---

## 1. Overall counts

See `docs/APPOINTMENTS-V1-CLOSURE-SUMMARY.json`.

## 2. V1 closure status

Primary closure distribution: V1_MOCK_OR_PLACEHOLDER=2, V1_COMPLETE_RUNTIME_ONLY=30, V1_ADMIN_UI_GAP=89, V1_COMPLETE=99, V1_WRONG_PLACEMENT=16, V1_CONTEXTUAL_FLOW_GAP=1, V1_PUBLIC_UI_GAP=35, V2_DEFERRED=12, V1_PORTAL_UI_GAP=12, V1_BACKEND_GAP=6, V1_PROVIDER_BLOCKED=6.

## 3. Remaining implementation gaps

**161** rows require implementation work. Full queue: `docs/APPOINTMENTS-RESIDUAL-V1-IMPLEMENTATION-QUEUE.md`.

Top gap types:
- Admin UI depth on canonical pages (calendar, appointment detail, waitlist, overview)
- Wrong placement — features still on `ServiceBookingAdminClient` hub / temp routes
- Public booking payment + AI + class/event flows
- Portal saved-card management + membership self-service

## 4. Public Booking status

Mechanically inspected (not browser certified). **8B-8** delivered catalog grouping, terminology, confirmation real data, manage URL. **Residual:** Stripe/Square payment depth, Workshop/Event kind, public AI chat/email, class enrollment parity, single-use link UX.

## 5. Portal status

**8B-9** delivered unified portal IA with OTP, appointments, packages, payments, documents, profile. **Residual:** add/remove saved cards in portal UI, membership pause/cancel self-service, dependent booking, meeting recap customer view.

## 6. Contextual flow status

13 contextual flows from 8A audit — partial auto-select/return on booking-type editors. See residual queue contextual rows.

## 7. Backend/UI mismatches

- **Backend ready / UI missing:** 136 rows
- **UI present / backend gap:** 0 rows

## 8. Persistence gaps

High-risk areas inspected via backend path existence. Rows with `PERSISTENCE_PATH_PRESENT=UNVERIFIED` flagged in post ledger for manual follow-up (calendar colors, special dates, routing rules).

## 9. Mock/placeholder blockers

Production-path mock residue: public booking kimi types (type-only imports OK), legacy confirm/reschedule sandbox fallbacks (production uses `live` API), service-booking report JSON dump on temp route, overview decorative controls.

## 10. Temporary route status

See `docs/APPOINTMENTS-TEMP-ROUTE-UNIQUE-FEATURE-AUDIT.md`. **11** routes still hold unique V1; **4** ready for retirement after absorption.

## 11. Commerce unique-function status

**11** unique required V1 functions estimated still on commerce/hub routes (target: 0).

## 12. Provider-blocked status

6 rows: iCloud, Reserve with Google, Facebook/Instagram booking, SAML, SCIM.

## 13. V2/out-of-scope status

12 V2 deferred. Out-of-scope contamination: 0 (target 0).

## 14. Proposed residual implementation batches

See queue doc § Proposed 8D batches (route convergence → public → portal → ops → automations → backend).

## 15. Route-retirement readiness

**NO** — Do not retire temp routes until canonical pages absorb unique functionality.

## 16. Certification readiness

**NO** — 161 implementation gaps remain before master browser certification.

---

## Gap queue reconciliation (8A → 8C)

| 8A assumption | 8C result |
|---------------|-----------|
| Portal wave pending | **RESOLVED** for core portal (8B-9); residual saved-card UI |
| Public booking 34 gaps | **PARTIALLY RESOLVED** (8B-8); payment + event/class remain |
| Commerce 29 temp unique | **11** unique functions remain on hub |
| Backend-ready UI-missing 184 | **Recalculated: 136** |
| UI-present backend-uncertain 89 | **Recalculated: 0** |

---

*Full row-level data: `docs/APPOINTMENTS-POST-ABSORPTION-LEDGER.csv`*

## Page-by-page completeness (Part 3)

| Page | Expected rows | Complete | Partial/Gap | Wrong placement |
|------|--------------:|---------:|------------:|----------------:|
| `/appointments/overview` | 2 | 1 | 1 (SMALL RESIDUAL) | 0 |
| `/appointments/calendar` | 7 | 3 | 4 (MEDIUM RESIDUAL) | 2 |
| `/appointments` | 200 | 79 | 119 (MAJOR RESIDUAL) | 13 |
| `/appointments/[id]` | 7 | 1 | 6 (MEDIUM RESIDUAL) | 1 |
| `/appointments/waitlist` | 12 | 2 | 10 (MAJOR RESIDUAL) | 0 |
| `/appointments/recalls` | 2 | 0 | 2 (SMALL RESIDUAL) | 0 |
| `/appointments/types` | 38 | 18 | 20 (MAJOR RESIDUAL) | 0 |
| `/appointments/types/meetings` | 0 | 0 | 0 (CLOSED) | 0 |
| `/appointments/types/services` | 12 | 5 | 7 (MAJOR RESIDUAL) | 0 |
| `/appointments/types/classes` | 6 | 0 | 6 (MEDIUM RESIDUAL) | 0 |
| `/appointments/booking` | 17 | 1 | 16 (MAJOR RESIDUAL) | 0 |
| `/appointments/availability` | 19 | 4 | 15 (MAJOR RESIDUAL) | 4 |
| `/appointments/staff` | 2 | 1 | 1 (SMALL RESIDUAL) | 0 |
| `/appointments/locations` | 4 | 4 | 0 (CLOSED) | 0 |
| `/appointments/packages` | 12 | 1 | 11 (MAJOR RESIDUAL) | 1 |
| `/appointments/memberships` | 8 | 0 | 8 (MAJOR RESIDUAL) | 1 |
| `/appointments/gift-cards` | 4 | 0 | 4 (MEDIUM RESIDUAL) | 1 |
| `/appointments/pos` | 10 | 5 | 4 (MEDIUM RESIDUAL) | 0 |
| `/payments/transactions` | 4 | 4 | 0 (CLOSED) | 0 |
| `/payments/invoices` | 1 | 1 | 0 (CLOSED) | 0 |
| `/contacts` | 8 | 7 | 1 (SMALL RESIDUAL) | 0 |
| `/contacts/[id]` | 3 | 3 | 0 (CLOSED) | 0 |
| `/appointments/reminders` | 10 | 9 | 1 (SMALL RESIDUAL) | 1 |
| `/appointments/workflows` | 13 | 9 | 4 (MEDIUM RESIDUAL) | 0 |
| `/appointments/routing-forms` | 4 | 3 | 1 (SMALL RESIDUAL) | 0 |
| `/appointments/analytics` | 7 | 7 | 0 (CLOSED) | 0 |
| `/book` | 18 | 2 | 16 (MAJOR RESIDUAL) | 0 |
| `/portal/[token]` | 0 | 0 | 0 (CLOSED) | 0 |
| `/manage/[token]` | 0 | 0 | 0 (CLOSED) | 0 |

## Public Booking matrix (Part 4)

| Feature | Admin config | Public consumer | Data contract | Present? | Complete? | Residual |
|---------|-------------|-----------------|---------------|----------|-----------|----------|
| Meeting Type selection | YES | PARTIAL | catalog API | PARTIAL | Class/event dedicated flows | undefined |
| Service flow + add-ons | YES | PARTIAL | public-booking-service | PARTIAL | Add-ons-before-slot reorder | undefined |
| Payment Stripe/Square | YES | PARTIAL | merchant payments | GAP | PUBLIC_WAVE_PENDING rows | undefined |
| Packages/memberships at checkout | YES | LIKELY | entitlements | PARTIAL | — | undefined |
| Portal OTP + session | YES | YES | client-portal.ts | COMPLETE | Saved card add/remove UI | undefined |
| Legacy confirm/cancel/reschedule | YES | YES | live API mode | COMPLETE | — | undefined |

## Portal reconciliation (Part 5)

| Area | Status |
|------|--------|
| Auth token + OTP | COMPLETE |
| Appointments upcoming/past | COMPLETE |
| Packages + credit history | COMPLETE |
| Saved payment methods add/remove | GAP — display only |
| Membership pause/cancel self-service | GAP — backend staff-only |
| Household dependent booking | GAP — display only |

## Contextual flows (Part 6)

| Flow | Status | Failure class | Evidence | Priority |
|------|--------|---------------|----------|----------|
| SERVICE → STAFF | PARTIAL | NO_CREATE | Type editor | P2 |
| SERVICE → INTAKE FORM | PARTIAL | NO_AUTO_SELECT | Forms contextual | P2 |
| CONTACT → PACKAGE | COMPLETE | — | Contact detail | — |
| POS → COUPON | COMPLETE | — | 8B-5 | — |
| IMPORT → CUSTOMER FIELD | COMPLETE | — | 8B-5 | — |

## Mock / placeholder audit (Part 9)

| File | Classification |
|------|----------------|
| `src/components/appointments/kimi-ui/public-reschedule/components/RescheduleFlow.tsx` | SAFE_DEV_ONLY (production uses live API) |
| `src/components/appointments/kimi-ui/public-reschedule/components/SlotPicker.tsx` | SAFE_DEV_ONLY (production uses live API) |
| `src/components/appointments/kimi-ui/waitlist/components/WaitlistEntryRow.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/waitlist/components/ConfirmRemoveModal.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/waitlist/components/WaitlistAdminClient.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/ConfirmationStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/BookingShell.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/DateTimeStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/PublicBookingClient.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/DetailsStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/PaymentStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/BookingDisabledState.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/AiBookingStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/WaitlistStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/components/ServiceStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-booking/page.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-confirm/components/public-action-client.tsx` | SAFE_DEV_ONLY (production uses live API) |
| `src/components/appointments/kimi-ui/public-confirm/page.tsx` | SAFE_DEV_ONLY (production uses live API) |
| `src/components/appointments/kimi-ui/public-embed-booking/components/ConfirmationStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/DateTimeStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/DetailsStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/PaymentStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/AiBookingStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/WaitlistStep.tsx` | V1_PRODUCTION_BLOCKER |
| `src/components/appointments/kimi-ui/public-embed-booking/components/ServiceStep.tsx` | V1_PRODUCTION_BLOCKER |
