# Batch 7 UAT — Automation, Reporting + Contact Support

## Recalls (RC1–RC5)

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| RC1 | Completed appointment creates recall with correct due date | PENDING | Requires service recall interval + completion flow |
| RC2 | Upcoming → Due → Overdue states | PENDING | Uses `listRecallDueCustomers` date math |
| RC3 | Book from recall → booked state | PENDING | Book links to `/appointments/calendar?contact=` |
| RC4 | Message customer uses conversations | PENDING | Links to `/conversations?contact=` |
| RC5 | Dismiss persists on reload | PENDING | PATCH `/api/appointments/recalls` + platform config |

## Automations (AU1–AU7)

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| AU1 | Basic reminder sends | PENDING | Existing reminders runtime preserved |
| AU2 | Multi-channel sequence | PENDING | |
| AU3 | Completed appointment workflow | PENDING | |
| AU4 | No-show workflow | PENDING | Canonical: `/appointments/automations/no-show` |
| AU5 | Recall due workflow | PENDING | Canonical: `/appointments/automations/recall` |
| AU6 | Duplicate event guard | PENDING | |
| AU7 | Activity failure display | PENDING | `/appointments/automations/activity` |

## Analytics / Reports (AN1–AN6)

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| AN1 | Booking count accuracy | PENDING | |
| AN2 | Type breakdown | PENDING | |
| AN3 | Revenue gross/refund/net | PARTIAL | Revenue tab uses `appointmentMerchantPayment` data |
| AN4 | Reminder stats | PENDING | |
| AN5 | CSV export | PENDING | Reports panel + analytics export |
| AN6 | Old service-booking route | PASS | Banner → `/appointments/analytics/reports` |

## Segments / Fields (SF1–SF6)

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| SF1 | Create custom field | PENDING | `/contacts/fields` |
| SF2 | Segment by field | PENDING | `/contacts/segments` |
| SF3 | Appointment condition | PENDING | |
| SF4 | Package condition | PROVIDER_BLOCKED | If runtime unsupported |
| SF5 | Rename field preserves values | PENDING | |
| SF6 | Archive field safe | PENDING | |

## Import (IM1–IM6)

| ID | Scenario | Status | Notes |
|----|----------|--------|-------|
| IM1 | Basic CSV import | PENDING | `/contacts/imports` |
| IM2 | Custom field mapping | PENDING | |
| IM3 | Duplicate handling | PENDING | |
| IM4 | Invalid row errors | PENDING | |
| IM5 | Large import progress | PENDING | |
| IM6 | Error report download | PENDING | |

## Routes changed

- **Canonical:** `/appointments/recalls` (operational due list)
- **Canonical:** `/appointments/automations/recall`, `/appointments/automations/no-show`
- **Canonical:** `/appointments/analytics/revenue`, `/appointments/analytics/reports` (merged service booking)
- **Canonical:** `/contacts/segments`, `/contacts/fields`, `/contacts/imports`
- **Transitional (banner):** `/appointments/recall-campaigns`, `/appointments/no-show-recovery`, `/appointments/reports/service-booking`
- **Redirect:** `/appointments/segments` → `/contacts/segments`

## Routes eligible for retirement (after full UAT)

- `/appointments/recall-campaigns`
- `/appointments/no-show-recovery`
- `/appointments/reports/service-booking`
- `/appointments/segments`
- Commerce import/export parity section (after import UAT)

## Backend gaps

- Recall due list derives interval from active recall campaign config (no per-service interval UI yet)
- `contacted` recall status not wired to reminder send events
- Revenue analytics limited to `appointmentMerchantPayment` — no package/membership split yet
