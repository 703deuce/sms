# Live CRM test — Zoho CRM + Pipedrive only

Ignore Salesforce and Bigin for this pass.

## Exact config from code

| Item | Value |
|------|--------|
| Zoho client id | `ZOHO_CLIENT_ID` |
| Zoho client secret | `ZOHO_CLIENT_SECRET` |
| Zoho Accounts override (optional) | `ZOHO_ACCOUNTS_DOMAIN` |
| Zoho webhook secret (optional) | `ZOHO_WEBHOOK_SECRET` |
| Pipedrive client id | `PIPEDRIVE_CLIENT_ID` |
| Pipedrive client secret | `PIPEDRIVE_CLIENT_SECRET` |
| Pipedrive webhook secret (optional) | `PIPEDRIVE_WEBHOOK_SECRET` |
| Shared webhook secret (optional) | `CRM_WEBHOOK_SECRET` |
| App / redirect base | `APP_URL` (no trailing slash) |
| Token encryption + OAuth state HMAC | `INTEGRATION_SECRET_KEY` |
| OAuth callback routes | `/api/crm/zoho/callback`, `/api/crm/pipedrive/callback` |
| Exact Zoho callback | `{APP_URL}/api/crm/zoho/callback` |
| Exact Pipedrive callback | `{APP_URL}/api/crm/pipedrive/callback` |
| DB apply | `npm run db:push` (fallback: `supabase/crm-integration.sql`) |
| Jobs | Processed **inside the web container** (Next.js instrumentation poller). Separate `npm run worker:all` is optional / not required. |

Authorize and token exchange send `redirect_uri` = the **provider-specific** callback URL.
These are **not** Coolify environment variables — only register them in Zoho / Pipedrive consoles.

Zoho regional API: token response `api_domain` is stored and used for CRM API calls.  
Zoho regional Accounts: callback `accounts-server` / `location` used for code→token and refresh.

## Coolify services that need the vars + redeploy

Add the variables to the **web application** Coolify service, then **redeploy/restart** it.

Jobs (`crm_sync`, `crm_push_event`, `crm_metadata_refresh`, `crm_bulk_sync`, `crm_webhook_process`, campaigns, automations, etc.) run **in the web container** via the in-process poller. You do **not** need a separate `npm run worker:all` service for this live pass.

Optional: Coolify cron can still hit `POST /api/jobs/process` with `CRON_SECRET` as a backup drain; it is not required when the web poller is enabled (default).

Set `DISABLE_INPROCESS_WORKER=1` on the web app only if you intentionally run a standalone worker again.

## Commands on the DB-capable host

```bash
git fetch origin cursor/crm-integration-framework-b56f
git checkout cursor/crm-integration-framework-b56f
git pull origin cursor/crm-integration-framework-b56f
npm ci
npm run db:push
npm run crm:live-readiness
# Jobs drain inside `next start` — no worker:all required
```

`crm:live-readiness` prints SET/MISSING for each var (never values) and the exact callback URL.

## Provider console checklist

Register **exactly**:

- Zoho API Console: `{APP_URL}/api/crm/zoho/callback`
- Pipedrive OAuth app: `{APP_URL}/api/crm/pipedrive/callback`

Scopes requested (code):

- Zoho CRM: `ZohoCRM.modules.contacts.ALL`, `leads.ALL`, `accounts.ALL`, `deals.ALL`, `tasks.ALL`, `notes.ALL`, `calls.ALL`, `search.READ`, `users.READ`, `settings.modules.READ`, `settings.fields.READ`
- Pipedrive: `base`, `contacts:full`, `deals:full`, `activities:full`, `users:read`

## Live UI path

1. Open `{APP_URL}/integrations/crm/pipedrive` → Connect  
2. Complete OAuth → Connected + wizard  
3. Diagnostics → validate / token refresh / force sync  
4. Repeat for `{APP_URL}/integrations/crm/zoho`  
5. Keep `zohoProduct` = **crm** (do not switch to Bigin)

## Webhooks

Inbound webhook HTTP route exists: `/api/crm/webhooks/{provider}`.  
Provider-side webhook **registration** is not auto-created by Transovo — mark as unsupported for automatic registration until manually configured in Zoho/Pipedrive admin. Scheduled incremental reconcile still runs hourly via the worker.
