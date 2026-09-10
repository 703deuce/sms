# Batch 8D-6 — Automations + Contacts/Data + Integrations/Settings (Wave 3)

**Date:** 2026-09-10  
**Branch:** `cursor/batch8d6-admin-automations-wave3-709b`  
**Base:** Post–Batch 8D-5 ledger (33 `V1_ADMIN_UI_GAP`)

## Admin gap summary

| Metric | Value |
|--------|-------|
| Starting `V1_ADMIN_UI_GAP` (post–8D-5) | **33** |
| Rows assigned to 8D-6 | **16** |
| Resolved (`V1_COMPLETE`) | **16** |
| Reclassified | **0** |
| Ending `V1_ADMIN_UI_GAP` | **17** |

## Batch worksheet (closed)

| ID | Area | Resolution |
|----|------|------------|
| 1-3 | Shell / mobile nav | Home, Calendar, Messages, Contacts — no Contacts truncation |
| 6-12 | Workflows | Status workflow on `/appointments/workflows` |
| 10-9 | Recalls hub | Hub + segment presets + saved views |
| 10-11 | Recall segments | `AppointmentSegmentPresetsPanel` on recalls hub |
| 11-12 | Automation templates | `/appointments/automations/templates` |
| 11-13 | Automation activity | `/appointments/automations/activity` |
| 12-1 | Workflow list | `/appointments/workflows` |
| 12-2 | Workflow editor | `/appointments/workflows/[id]/edit` |
| 15-1 | Routing forms | Real types/staff/analytics; public URL open |
| 17-1 | Google Calendar | `CalendarIntegrationsCard` |
| 17-2 | Microsoft Calendar | `CalendarIntegrationsCard` |
| 19-1 | Contacts link | Booking hub → `/contacts` |
| 19-2 | Messages link | Booking hub → `/conversations` |
| 20-1 | Webhook endpoints | `/integrations/developer` |
| 20-2 | HMAC signing | Secret reveal on create |
| 20-3 | Delivery queue | Delivery log + API |

## Key implementations

- `AppointmentsWebhooksPanel` + `/integrations/developer` (Developer tab in integrations nav)
- `BookingHubLinksCard` — Contacts + Messages cross-links
- Routing forms — API meta for booking types, staff, analytics (no mock data)
- Recalls hub — appointment-derived segment presets
- Mobile nav — prioritizes Messages + Contacts over Booking in bottom bar

## Remaining admin gaps (17)

Commerce/packages (`8-*`), POS (`7-1`), staff create (`6-2`), dynamic pricing (`3-21`), meeting polls (`15-7`), audit timeline (`18-7`), and related rows — see regenerated ledger.

## Validation

- `node scripts/reconcile-appointments-batch8c.mjs` — PASS (17 admin gaps remaining)
- TypeScript on touched files — static check
- Browser UAT — **not run** (per batch scope)

## Next wave (8D-7)

Recalculate remaining **17** `V1_ADMIN_UI_GAP` rows — likely commerce/POS/operations residuals, then backend-gap closure pass.
