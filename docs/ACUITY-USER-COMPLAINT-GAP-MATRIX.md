# Acuity User-Complaint Gap Matrix (Beyond Acuity)

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Purpose:** Certify improvements over real Acuity/Calendly user complaints — not just feature parity.  
**Last updated:** 2026-09-08 (service-booking parity build)

| # | Beyond-Acuity capability | Transovo design intent | UI route | API / runtime | UA test ID | Status |
|---|--------------------------|------------------------|----------|---------------|------------|--------|
| 1 | Easier default setup | Meeting/Service/Class progressive disclosure | `/appointments/types` | setup APIs | APT-BA-001 | FAIL |
| 2 | Package auto-tied to customer (no codes) | Entitlement on canonical Contact | `/book/[slug]/store` | `packages.ts` + contact | APT-BA-002 | PASS |
| 3 | Membership auto-tied to customer | Subscription entitlement on Contact | `/book/[slug]/store` | `memberships.ts` | APT-BA-003 | PASS |
| 4 | No mandatory redemption-code UX | Identity-first redemption | `/book/**` | checkout | APT-BA-004 | PASS |
| 5 | Series one / future / all management | RecurringSeriesPolicy | `/manage/[token]` | `recurring-series.ts` | APT-BA-005 | PASS |
| 6 | Business holiday impact handling | Holiday batch resolver | `/appointments/availability` | availability jobs | APT-BA-006 | FAIL |
| 7 | Customer Manage Appointment link | Secure token URL (core) | `/manage/[token]` | `/api/public/manage/[token]` | APT-BA-007 | PASS |
| 8 | Enforceable self-reschedule cutoff | SchedulingPolicy | type/settings | `scheduling-limits.ts` | APT-BA-008 | PASS |
| 9 | Enforceable self-cancel cutoff | SchedulingPolicy (independent) | type/settings | `scheduling-limits.ts` | APT-BA-009 | PASS |
| 10 | Package-aware rescheduling | Entitlement transfer on reschedule | manage API | `entitlements.ts` | APT-BA-010 | PASS |
| 11 | Recurring-series self-service | one/future/all + preview | manage API | `recurring-series.ts` | APT-BA-011 | PASS |
| 12 | Staff-created appointment parity | Single canonical pipeline | `/appointments/new` | appointment API | APT-BA-012 | PASS |
| 13 | Calendar-event → appointment conversion | Convert external event | calendar UI | sync + import | APT-BA-013 | FAIL |
| 14 | Customizable waitlist messages | Editable templates | waitlist settings | template store | APT-BA-014 | FAIL |
| 15 | Cleaner staff permissions | Staff-scoped RBAC | settings/team | authz | APT-BA-015 | FAIL |
| 16 | Package + standing recurring slot | Program + standing reservation | `/appointments/commerce` | package rules | APT-BA-016 | PASS |
| 17 | Package + full class-series enrollment | Purchase + enroll atomic | `/book/[slug]/store` | `classes.ts` | APT-BA-017 | PASS |
| 18 | Purchase-time onboarding/intake | Forms at package checkout | package purchase | intake API | APT-BA-018 | FAIL |
| 19 | Failed-payment recovery surfaced | Home attention + client link | overview + portal | billing jobs | APT-BA-019 | FAIL |
| 20 | Client duplicate merge | Controlled merge wizard | `/appointments/commerce` | `contact-merge.ts` | APT-BA-020 | PASS |
| 21 | Multi-service appointments | Chained services one checkout | `/book/**` | `multi-service.ts` | APT-BA-021 | PASS |
| 22 | Processing-time scheduling | Multi-phase service model | commerce admin | `service-phases.ts` | APT-BA-022 | PASS |
| 23 | Mixed-entitlement packages | Typed credits per service | `/appointments/commerce` | package rules | APT-BA-023 | PASS |
| 24 | Rich membership benefits | Credits + discounts + access | `/appointments/commerce` | membership rules | APT-BA-024 | PASS |
| 25 | Family / dependent accounts | Household booker vs attendee | `/portal/[token]` | `household.ts` | APT-BA-025 | PASS |

## Certification rules

- Each row requires a **real UA test** (browser or scripted customer journey) — not API-only.
- PASS = runtime shipped (API + UI + persistence); UA evidence tracked per `APT-BA-*` ID.
- Track complaint source in test notes when available (forum thread, help article).

## Summary

| Status | Count |
|--------|-------|
| PASS | 18 |
| FAIL | 7 |

**Remaining FAIL focus:** progressive setup UX, holiday batch handling, calendar conversion, waitlist templates, staff RBAC, purchase-time intake, failed-payment recovery surfacing.
