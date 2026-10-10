# Appointment Reminders — Final customer completion report

Branch: `cursor/ar-frontend-complete-f350`  
Date: 2026-10-10

## Product rules enforced

### Platform SMS (selection-only)

- Customer-facing tone controls removed (onboarding configure, settings starter packs).
- Preset packs apply **approved library templates + timing** only; tone no longer rewrites copy (`reminder-presets.ts`).
- Platform sender policy locks SMS bodies to library templates, strips disallowed merge tags, clears `customMergeFields` on save (`platform-template-policy.ts`).
- Settings UI: SMS template editor read-only when `templateEditingLocked`; custom merge fields hidden for platform senders.
- **Use template** workflow: browse library → preview → choose reminder step → `POST /api/appointment-reminders/settings/apply-template` → sequence refreshes.

### Email

- Template library + variable preview preserved; not subject to SMS carrier body lock in the same way as platform SMS.

### Explicitly not in scope (per product)

- CSV upload/import UI removed from Appointments and Integrations (backend import route preserved for internal use only).
- No drag-and-drop reminder ordering.
- No Google/iCloud/iCal customer integrations.

## Routes — customer surfaces (Opus / `newui-transplant`)

| Route | Status |
|-------|--------|
| `/appointment-reminders` | Overview: KPIs, product status strip, needs attention table, upcoming table, activity table |
| `/appointment-reminders/appointments` | List, filters, drawer, manual add (no CSV) |
| `/appointment-reminders/reminders` | Operational ledger (existing Opus) |
| `/appointment-reminders/settings?tab=*` | Six tabs: sequence, templates, scheduling, business, notifications, integrations |
| `/appointment-reminders/setup/*` | Connect, configure (no tone), activate |
| `/appointment-reminders/analytics` | Preserved |

## APIs connected (this pass)

- `GET /api/appointment-reminders/overview` — extended payload: `productStatus`, `needsAttentionRows`, `upcomingAppointments`, activity `channel`
- `POST /api/appointment-reminders/settings/apply-template` — apply library template to step with platform policy
- Existing: settings PATCH (platform policy), presets POST, template library, import (no UI)

## Tests run

| Command | Result |
|---------|--------|
| `npm run test:ar-reminder-template-library` | PASS (306) |
| `npm run test:ar-scheduling-policy` | PASS |
| `npx tsx src/lib/appointment-reminders/platform-template-policy.test.ts` | PASS |
| `npm run build` | See CI / local build log for this commit |

## Remaining / blockers

- Full `npm run build` may surface pre-existing TypeScript errors outside Appointment Reminders; regressions from this pass should be fixed before merge.
- Live SMS/email certification unchanged; no unauthorized production sends in this pass.
