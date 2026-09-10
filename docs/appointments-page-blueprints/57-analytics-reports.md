# Blueprint 57 — Analytics + Reports

**Routes:** `/appointments/analytics/*`, `/appointments/analytics/revenue`, `/appointments/analytics/reports`

## BATCH 8B-6 ABSORPTION GAPS

| Feature ID | Feature | Route | Backend | Status |
|---|---|---|---|---|
| 16-1 | Analytics overview | `/appointments/analytics` | `analytics-reports.ts` | ABSORBED_CANONICAL_UI |
| 16-2 | Booking analytics | `/appointments/analytics/booking` | analytics API | ABSORBED_CANONICAL_UI |
| 16-3 | Reminder analytics | `/appointments/analytics/reminders` | analytics API | ABSORBED_CANONICAL_UI |
| 16-4 | Automation analytics | `/appointments/analytics/automations` | workflow executions | ABSORBED_CANONICAL_UI |
| — | Revenue analytics | `/appointments/analytics/revenue` | payment aggregates | ABSORBED_CANONICAL_UI |
| 16-5 | Reports hub | `/appointments/analytics/reports` | `reporting.ts` | ABSORBED_CANONICAL_UI |
| 16-6 | Service booking reports | Reports hub | `loadAcuityStyleReports` | ABSORBED_CANONICAL_UI |
| 16-7 | CSV export | Reports + analytics export | `/api/appointments/reports` | ABSORBED_CANONICAL_UI |
| 16-8 | Scheduled reports | Schedule card | `analytics-reports.ts` | RUNTIME_UI_EFFECT |
| 21-9 | Scheduled email report | Background | `analytics-reports.ts` | RUNTIME_UI_EFFECT |

## MOCK DATA REMOVED

- Fabricated automation recovery metric (`noShow * 0.5`) replaced with real workflow run/failure counts.

## REMAINING GAPS

- PDF export UI (backend text buffer exists; no polished PDF generator)
- Full drill-down report types (packages, memberships, waitlist) when data models support
