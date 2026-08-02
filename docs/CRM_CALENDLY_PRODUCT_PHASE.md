# CRM + Calendly Product Integration Phase

**Branch:** `cursor/crm-calendly-product-phase-b56f`  
**Providers:** Salesforce, Zoho CRM, Pipedrive, Calendly

Does **not** redesign OAuth, adapters, or sync frameworks. Builds product surfaces on top of existing normalized models.

## Shipped in this phase

### Automation triggers (normalized)
CRM sync publish → `integration_automation_event` → enroll:

| Normalized event | Trigger block |
|------------------|---------------|
| `contact.created` / `updated` | `integration_contact_*` |
| `lead.created` / `updated` | `integration_lead_*` |
| `deal.created` / `stage_changed` / `won` / `lost` | `integration_deal_*` |
| `task.created` / `completed` | `integration_task_*` |
| `appointment.scheduled` / `canceled` / `rescheduled` | Calendly booking triggers |
| `appointment.starting_soon` | Scheduled Transovo scan (not Calendly webhook) |
| `appointment.completed` | Catalog + mapping ready |

Builder **Integrations** sidebar group lists CRM + Calendly blocks. Provider filters include Salesforce / Zoho / Pipedrive / Calendly.

### Automation actions
- Native `integration_action` still covers marketing/ecom adapters.
- CRM path: `crm_automation_action` job → `executeCrmAutomationAction` via connectors:
  - `contact.upsert`, `lead.upsert` (SF/Zoho), `deal.upsert`, `task.create`, `note.create`, `call.log`, `sms.log`
- Capability-gated (Pipedrive lead actions hidden).

### Product UI
- Contact **Connected records** panel + Sync / Note / Task quick actions
- Inbox sidebar uses the same panel (compact)
- Voice call detail shows CRM & calendar when `contactId` is set
- Appointments page: upcoming/past filters, cancel/reschedule links
- Automation templates: CRM/Calendly starters (never auto-activate)

### Reliability
- CRM→automation events idempotent via job keys
- Appointment starting-soon scan every minute drain
- CRM contact create/update from sync fires automations only on real hash changes

## Intentionally deferred / partial
- Full pipeline kanban board
- Every CRM field-change trigger (owner, tag, custom field) — needs richer delta from adapters
- Calendly single-use scheduling link / Scheduling API writes (unsupported)
- Contact list CRM columns, tasks page CRM sync badges
- Full RBAC parity for native connect (CRM matrix already exists)

## Operator checks after deploy
1. Open a mapped contact → Connected records → Sync now / Add CRM note
2. Automations → Integrations category → pick CRM contact created / Calendly booking
3. Automations → Templates → CRM & Calendly starters
4. Appointments page → booking with cancel/reschedule links when present
5. Force CRM sync → confirm automation enroll for new/changed contacts (idempotent)

## Tests
```bash
npx tsx scripts/test-crm-product-phase.ts
npx tsx scripts/test-native-integrations.ts
```
