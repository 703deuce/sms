# Appointments Business Texting — Template Ownership

**Date:** 2026-09-10  
**Browser proof:** BT-TEST-14 PASS — template picker on Campaign composer

## Models (no third system created)

| Use case | Model / store | Management route |
|----------|---------------|------------------|
| **Campaign / mass-text SMS** | `Template` (Prisma) via `/api/templates` | `/templates` |
| **Appointment automations / reminders** | Workflow templates (`appointment-workflows/templates.ts`) | `/appointments/automations/templates` |

Both are distinct **use-case categories** on top of compatible SMS body storage. Campaign composer does **not** read appointment workflow templates.

## Campaign composer behavior

- Loads `GET /api/templates`
- Filters to `type` empty, `Campaign`, `campaign`, or `SMS`
- **Use template** select in Create Campaign message header
- **Manage templates** → `/templates` (canonical shared marketing template admin)
- Variables offered in composer: `{{first_name}}`, `{{last_name}}`, `{{company}}`, `{{email}}` — no appointment-specific merge fields for general campaigns

## Variable safety

Appointment-only variables (service time, booking link, etc.) are **not** exposed in Campaign merge picker unless runtime guarantees per-recipient context (future enhancement; out of scope for this pass).

## Rendering

Campaign send uses existing mass-texting template/body pipeline — selected template body copied into campaign draft message; no separate `CampaignTemplate2` model.
