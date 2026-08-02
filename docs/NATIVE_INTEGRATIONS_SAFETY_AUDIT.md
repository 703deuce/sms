# Native Integrations — Final Product & Agent-Safety Audit

**Status:** Code-complete for product surfaces + AI safety. **Not production-ready until live acceptance with real credentials.**

Do not claim production readiness until live acceptance is completed.

## What was added

### Schema (migration `supabase/migrations/20260802_native_integration_safety.sql`)

| Table | Purpose |
| --- | --- |
| `integration_action_logs` | Human/AI/automation/API action audit + undo metadata |
| `ai_action_approvals` | Payload-hash approvals with expiry |
| `integration_alerts` | Customer / operator / business alerts |
| `integration_context_caches` | Messenger/phone local context cache |
| `integration_tasks` | Unified provider tasks |
| `integration_orders` | WooCommerce / commerce orders |
| `workspace_ai_integration_policies` | Per-workspace AI permission modes + limits |

Prisma models + `prisma-compat` `MODEL_TO_TABLE` / `RELATIONS` registered.

### Product surfaces

- Unified tasks UI: `/integrations/native/tasks`
- Orders/commerce UI: `/integrations/native/orders` (safe actions only)
- Integration analytics: `/reports/integrations`
- Action audit + alerts: `/integrations/native/audit`
- AI policy settings: `/integrations/native/ai-policy`
- Contact panel uses **context cache** (no live provider HTTP on page load)
- Global search indexes tasks, orders, deals/tickets mappings, external IDs (workspace-scoped, local DB only)
- Campaign audience freeze/snapshot at enroll time + consent/suppression exclusions
- Segment dimensions: provider, connection, source, external list/tag, form, appointment status, order status, deal stage, ticket status, consent status

### AI / automation safety

- Shared action registry (`actions-registry.ts`) for automations **and** AI
- Supervised AI path (`supervised-ai.ts`): preview → approval → enqueue `integration_action` → adapter
- Risk levels 1–4 (`ai-policy.ts`)
- Capability truth from one registry (`capability-truth.ts`)
- Consent gate (`consent-gate.ts`) — CRM membership ≠ SMS marketing consent
- Undo / irreversible metadata on action logs
- Operational health scan (`alerts.ts` + `integration_health_scan` job)

### Workers / jobs

| Job type | Handler |
| --- | --- |
| `integration_sync` | sync.ts |
| `integration_webhook_process` | sync.ts |
| `integration_automation_event` | automation-bridge.ts |
| `integration_action` | actions-registry (policy + audit + adapter) |
| `integration_context_refresh` | context-cache.ts |
| `integration_health_scan` | alerts.ts |

## Remaining incomplete code paths (honest)

- Task **complete / reassign / reschedule** for CRM providers: gated; Close/HighLevel create-task is the primary write path. Zoho/Pipedrive tasks are pulled into the unified view via mapping bridge, not redesigned.
- Klaviyo commerce depth depends on scoped private key + plan modules.
- Analytics “SMS response rate by provider/list/tag” are **prepared dimensions**; some joins need live campaign reply volume after credentials exist.
- Undo execution UI (one-click compensate) stores metadata; not every provider supports automated restore.
- Salesforce signup / OAuth still out of scope for this pass.

## Requires live credentials

1. Calendly OAuth app  
2. Typeform OAuth app  
3. Mailchimp OAuth app  
4. Jotform API key  
5. Freshdesk subdomain + API key  
6. ActiveCampaign API URL + key  
7. Klaviyo scoped private API key  
8. WooCommerce store URL + consumer key/secret  
9. Close API key  
10. HighLevel PIT + location ID  
11. Pipedrive reconnect for `deals:full`  
12. Salesforce later (when signup works)

## Requires paid / plan-dependent features

- Mailchimp marketing audience write scopes (plan-dependent)
- Klaviyo events/commerce modules
- Freshdesk ticket modules on lower plans
- HighLevel location features behind PIT scopes
- Close activity visibility by role

## Intentionally unsupported

- Refund / payment / price / inventory / fulfillment execution
- AI direct adapter calls
- Live provider HTTP during Messenger/phone/search page load
- Treating CRM/list/form/order membership as SMS marketing consent
- Revenue attribution without order/deal mapping
- Salesforce / Bigin / HubSpot / Zendesk / Google / Microsoft / Slack / Stripe / Square / Shopify / Zapier marketplace in this batch
- Redesign of Zoho CRM or Pipedrive frameworks

## Exact OAuth callbacks

Base: `APP_URL` (production: `https://transovo.ai`)

- `https://transovo.ai/api/integrations/native/calendly/callback`
- `https://transovo.ai/api/integrations/native/typeform/callback`
- `https://transovo.ai/api/integrations/native/mailchimp/callback`

## Exact manual provider setup order

1. **Calendly** — create OAuth app → register callback → scopes → Coolify env → redeploy web+worker → connect → acceptance  
2. **Typeform** — same  
3. **Mailchimp** — same  
4. **Jotform** — API key in UI → acceptance  
5. **Freshdesk** — subdomain + API key → acceptance  
6. **ActiveCampaign** — API URL + key → acceptance  
7. **Klaviyo** — scoped private key → acceptance  
8. **WooCommerce** — store URL + consumer key/secret → acceptance  
9. **Close** — API key → acceptance  
10. **HighLevel PIT** — token + location ID → acceptance  
11. **Pipedrive** — disconnect/reconnect for `deals:full` → deal/pipeline/stage tests  
12. **Salesforce** — when signup works → OAuth credentials → acceptance  

Apply migration `20260802_native_integration_safety.sql` (or `db:push`) before deploy.

## Tests

Run: `npm run test:native-integrations`

Coverage includes risk classification, approval/hash/preview, capability gating, consent denial without contact, audience freeze flag, no adapter imports in AI/cache paths, job registration, queue priority, alert kinds, segment commerce/consent fields, worker coverage, plus prior framework/product wiring tests.

## Production readiness

**Not claimed.** Live acceptance with real credentials is still required.
