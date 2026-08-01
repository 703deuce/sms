# Transovo Native Integrations

Shared **External Integration Framework** under `src/lib/integrations/framework/` with thin adapters in `src/lib/integrations/adapters/`.

Zoho CRM and Pipedrive remain on the existing CRM framework (`src/lib/crm/`) and are **not** redesigned here.

## Providers

| Provider | Auth | Customer credentials / OAuth |
|----------|------|------------------------------|
| Calendly | OAuth | App client ID/secret |
| Mailchimp | OAuth | App client ID/secret (+ DC from metadata) |
| Typeform | OAuth | App client ID/secret + scopes |
| ActiveCampaign | Credentials | API URL + API key |
| WooCommerce | Credentials | Store URL + consumer key + secret (HTTPS in prod) |
| Jotform | Credentials | API key (+ optional regional base) |
| Close | Credentials | API key |
| Freshdesk | Credentials | Subdomain + API key |
| Klaviyo | Credentials | Scoped private API key |
| HighLevel | Credentials | Private Integration Token + Location ID |

**Not in this batch:** Salesforce, Bigin, HubSpot, Zendesk, Google Workspace, Microsoft 365, Slack, Stripe, Square, Shopify, Zapier marketplace apps.

## Environment variables

Shared:

- `APP_URL`
- `INTEGRATION_SECRET_KEY`
- `DATABASE_URL`
- Optional: `INTEGRATIONS_OAUTH_SANDBOX=1` (Calendly sandbox client envs)

OAuth apps:

- `CALENDLY_CLIENT_ID` / `CALENDLY_CLIENT_SECRET`
- Optional sandbox: `CALENDLY_SANDBOX_CLIENT_ID` / `CALENDLY_SANDBOX_CLIENT_SECRET`
- `MAILCHIMP_CLIENT_ID` / `MAILCHIMP_CLIENT_SECRET`
- `TYPEFORM_CLIENT_ID` / `TYPEFORM_CLIENT_SECRET`

Optional webhook secrets: `{PROVIDER}_WEBHOOK_SECRET` (e.g. `CALENDLY_WEBHOOK_SECRET`).

## Exact OAuth callback URLs

Register these **exactly** (including path):

- `{APP_URL}/api/integrations/native/calendly/callback`
- `{APP_URL}/api/integrations/native/mailchimp/callback`
- `{APP_URL}/api/integrations/native/typeform/callback`

Production example: `https://transovo.ai/api/integrations/native/calendly/callback`

## OAuth scopes

- **Calendly:** default account access via OAuth app (empty scope list; permissions from app config / plan)
- **Mailchimp:** OAuth app grants account access; data-center discovered post-token via metadata
- **Typeform:** `forms:read responses:read webhooks:read webhooks:write offline accounts:read`

## Customer token scopes / notes

- **ActiveCampaign:** full API key from Developer settings
- **WooCommerce:** Read/Write REST key; no payment/refund/inventory writes from ordinary ops
- **Jotform:** account API key; plan daily limits tracked in metadata when available
- **Close:** user/org API key (docs admit OAuth is preferable long-term)
- **Freshdesk:** personal API key (capability-detect connected agent)
- **Klaviyo:** scoped private key; email vs SMS consent never inferred from phone alone
- **HighLevel PIT:** single location only — labeled as private token connection, not universal OAuth

## Database

Reuses existing tables (no new Prisma models required for launch):

- `integration_connections`
- `crm_object_mappings` / `crm_field_mappings`
- `crm_sync_runs` / `crm_sync_events`
- `crm_webhook_events`
- `crm_audit_logs`
- `crm_dead_letters`
- `job_queue`

Secrets stored encrypted in `accessToken` / `refreshToken` / config (`enc:v1:…`).

## Workers & queues

Job types (all have handlers in `job-handlers.ts`):

- `integration_sync`
- `integration_webhook_process`
- `integration_automation_event` (no-op consumer until automation builder wires triggers)

Queues: `ext-{provider}` for each of the ten providers. Priority: webhooks/writes before incremental/history.

In-process drain via Next.js instrumentation continues to process these jobs when BullMQ is not required.

## UI

- Directory: `/integrations/native`
- Provider detail: `/integrations/native/{provider}`
- Linked from `/integrations`

## Diagnostics & acceptance

`POST /api/integrations/native` with:

- `{ "provider", "action": "probe", "probe": "validate"|"read"|"write"|"force_sync" }`
- `{ "provider", "action": "acceptance" }`

## Intentionally unsupported (this phase)

- Auto-sending SMS from adapters (events only)
- Zendesk / marketplace-reviewed apps
- HighLevel public multi-account OAuth
- Close polished OAuth UX
- WooCommerce payment total / refund / inventory mutation
- Calendly webhook registration on plans/roles that disallow it (feature-detect + reconcile)

## Live acceptance

After deploying env credentials, open each provider page → **Run acceptance**, or call the acceptance API. Statuses:

- Live tested and passed
- Failed and fixed
- Code implemented but not live tested
- Blocked by provider plan/permissions
- Intentionally unsupported
