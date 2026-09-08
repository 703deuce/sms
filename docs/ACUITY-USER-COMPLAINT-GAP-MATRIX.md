# Acuity User-Complaint Gap Matrix (Beyond Acuity)

**Governing spec:** `docs/TRANSOVO-APPOINTMENTS-SERVICE-BOOKING-PARITY-REQUIREMENT.md`  
**Purpose:** Certify improvements over real Acuity/Calendly user complaints — not just feature parity.  
**Last updated:** 2026-09-08 (initial matrix)

| # | Beyond-Acuity capability | Transovo design intent | UI route | API / runtime | UA test ID | Status |
|---|--------------------------|------------------------|----------|---------------|------------|--------|
| 1 | Easier default setup | Meeting/Service/Class progressive disclosure | `/appointments/types` | setup APIs | APT-BA-001 | FAIL |
| 2 | Package auto-tied to customer (no codes) | Entitlement on canonical Contact | booking + portal | entitlement engine | APT-BA-002 | FAIL |
| 3 | Membership auto-tied to customer | Subscription entitlement on Contact | portal + book | membership engine | APT-BA-003 | FAIL |
| 4 | No mandatory redemption-code UX | Identity-first redemption | `/book/**` | checkout | APT-BA-004 | FAIL |
| 5 | Series one / future / all management | RecurringSeriesPolicy | manage + admin | series API | APT-BA-005 | FAIL |
| 6 | Business holiday impact handling | Holiday batch resolver | `/appointments/availability` | availability jobs | APT-BA-006 | FAIL |
| 7 | Customer Manage Appointment link | Secure token URL (core) | `/manage/[token]` | manage API | APT-BA-007 | FAIL |
| 8 | Enforceable self-reschedule cutoff | SchedulingPolicy | type/settings | policy engine | APT-BA-008 | FAIL |
| 9 | Enforceable self-cancel cutoff | SchedulingPolicy (independent) | type/settings | policy engine | APT-BA-009 | FAIL |
| 10 | Package-aware rescheduling | Entitlement transfer on reschedule | manage API | entitlement + payment | APT-BA-010 | FAIL |
| 11 | Recurring-series self-service | one/future/all + preview | manage API | series engine | APT-BA-011 | FAIL |
| 12 | Staff-created appointment parity | Single canonical pipeline | `/appointments/new` | appointment API | APT-BA-012 | FAIL |
| 13 | Calendar-event → appointment conversion | Convert external event | calendar UI | sync + import | APT-BA-013 | FAIL |
| 14 | Customizable waitlist messages | Editable templates | waitlist settings | template store | APT-BA-014 | FAIL |
| 15 | Cleaner staff permissions | Staff-scoped RBAC | settings/team | authz | APT-BA-015 | FAIL |
| 16 | Package + standing recurring slot | Program + standing reservation | package setup | program engine | APT-BA-016 | FAIL |
| 17 | Package + full class-series enrollment | Purchase + enroll atomic | public class flow | checkout + enroll | APT-BA-017 | FAIL |
| 18 | Purchase-time onboarding/intake | Forms at package checkout | package purchase | intake API | APT-BA-018 | FAIL |
| 19 | Failed-payment recovery surfaced | Home attention + client link | overview + portal | billing jobs | APT-BA-019 | FAIL |
| 20 | Client duplicate merge | Controlled merge wizard | `/contacts` | contacts API | APT-BA-020 | FAIL |
| 21 | Multi-service appointments | Chained services one checkout | `/book/**` | availability chain | APT-BA-021 | FAIL |
| 22 | Processing-time scheduling | Multi-phase service model | type editor | slot engine phases | APT-BA-022 | FAIL |
| 23 | Mixed-entitlement packages | Typed credits per service | package editor | package rules | APT-BA-023 | FAIL |
| 24 | Rich membership benefits | Credits + discounts + access | membership editor | membership rules | APT-BA-024 | FAIL |
| 25 | Family / dependent accounts | Household booker vs attendee | portal + book | household model | APT-BA-025 | FAIL |

## Certification rules

- Each row requires a **real UA test** (browser or scripted customer journey) — not API-only.
- PASS = action works after reload and matches policy.
- Track complaint source in test notes when available (forum thread, help article).

## Complaint themes addressed

| Theme | Rows |
|-------|------|
| Setup complexity | 1 |
| Package/membership UX | 2–4, 10, 16–18, 23–24 |
| Series / recurring pain | 5, 6, 11 |
| Self-service / manage link | 7–9, 11 |
| Staff vs customer parity | 12–13 |
| Waitlist comms | 14 |
| Permissions | 15 |
| Class + package friction | 17 |
| Payments visibility | 19 |
| Data hygiene | 20 |
| Competitive depth (Square/SimplyBook) | 21–25 |
