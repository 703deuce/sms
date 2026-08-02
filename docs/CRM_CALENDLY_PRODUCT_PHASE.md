# CRM + Calendly Product Integration Phase

**Branch:** `cursor/crm-calendly-product-complete-b56f`  
**Providers:** Salesforce, Zoho CRM, Pipedrive, Calendly

Does **not** redesign OAuth, adapters, or sync frameworks. Builds product surfaces on top of existing normalized models.

## Acceptance matrix (complete)

Legend: **Done** means implemented end-to-end in code (catalog → publish/enroll or execute → UI/capability gate). Live provider proof still depends on connected accounts and plan limits.

| Area | Status | Notes |
|------|--------|-------|
| Normalized CRM/Calendly → automation triggers | **Done** | `INTEGRATION_EVENT_TO_TRIGGER` + rich CRM payload (connection, owner, pipeline, stage, changed fields, stable id) |
| Contact / lead / company / deal / task field triggers | **Done** | Published from CRM sync deltas + deletion path |
| Task due / overdue | **Done** | `crm_task_due_scan` every minute |
| Note / activity / call activity triggers | **Done** | Published on note/activity sync |
| Calendly booking / cancel / reschedule / starting soon / completed / no-show | **Done** | Webhooks + starting-soon + completed scans; no-show webhook when plan allows |
| Calendly event type created/updated/activated/deactivated | **Done** | Metadata refresh diff (not a Calendly webhook) |
| CRM automation actions (find/link/owner/tags/stage/won/lost/tasks/comms…) | **Done** | `executeCrmAutomationAction` + feature-matrix gating |
| Calendly actions (scheduling link, single-use, send SMS, retrieve, cancel, cancel/reschedule URLs) | **Done** | Requires reconnect for new write scopes |
| Capability gating | **Done** | Feature matrix + adapter capability truth |
| Connected Records + inbox compact sidebar | **Done** | Full fields, quick actions, Calendly links |
| Unified timeline + CRM sync badges on call/SMS | **Done** | Source labels + dedupe indicator |
| Call details CRM panel | **Done** | HumanCall `/phone/calls/[id]` + activity sync API |
| Contact list optional CRM columns/filters | **Done** | Query-param toggle; batched mappings |
| Unified tasks CRM origin/sync + complete-in-CRM | **Done** | |
| Appointments page CRM/Calendly context + actions | **Done** | |
| Lightweight pipeline board + gated inline stage move | **Done** | `/integrations/crm/pipeline` |
| Builder Integrations category, metadata, sample payload, test dry-run | **Done** | `/api/integrations/metadata`, `/api/integrations/actions/test` |
| Starter templates (7) + `?template=` load | **Done** | Never auto-activate |
| Permissions (view/quick actions/triggers/edit/force sync/conflicts) | **Done** | Role matrix in `permissions.ts` |
| Logging / idempotency | **Done** | CRM audit + job idempotency keys |

## Intentionally out of scope / plan-limited

- HubSpot, Bigin, and other non-listed providers
- Redesign of OAuth / adapters / sync frameworks
- Full CRM replacement (pipeline is read-focused)
- Calendly **direct Scheduling API booking** and **Contacts API** (unsupported — actions hidden)
- Calendly Free plan: realtime webhooks blocked by Calendly; incremental reconcile remains the Free path
- New Calendly write scopes require **disconnect & reconnect** after deploy

## Operator checks after deploy

1. Contact → Connected records → Sync / Note / Task / owner / stage / Calendly link  
2. Inbox conversation → compact CRM sidebar  
3. Phone call detail → CRM activity sync card + Connected records  
4. Contacts list → Show CRM columns + filters  
5. Integrations → Unified tasks / Appointments / CRM pipeline  
6. Automations → Integrations triggers/actions + Templates (`?template=`)  
7. Force CRM sync → enroll once per real change (idempotent)  
8. Calendly: reconnect OAuth if using single-use link / cancel actions  

## Tests

```bash
npx tsx scripts/test-crm-product-phase.ts
npx tsc --noEmit
```
