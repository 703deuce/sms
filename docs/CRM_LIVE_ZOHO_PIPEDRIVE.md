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
| OAuth callback route | `/api/crm/oauth/callback` |
| Exact callback URL | `{APP_URL}/api/crm/oauth/callback` |
| DB apply | `npm run db:push` (fallback: `supabase/crm-integration.sql`) |
| Worker | `npm run worker:all` |

Both authorize and token exchange send `redirect_uri` = that exact callback URL.

Zoho regional API: token response `api_domain` is stored and used for CRM API calls.  
Zoho regional Accounts: callback `accounts-server` / `location` used for code→token and refresh.

## Coolify services that need the vars + redeploy

Add the variables to **every** process that runs CRM code, then **redeploy/restart** each:

1. Web application (`next start` / Coolify app)
2. Worker (`npm run worker:all`) — this single process handles:
   - `crm_sync` (initial / incremental / scheduled)
   - `crm_push_event` (outbound writes)
   - `crm_metadata_refresh`
   - `crm_bulk_sync`
   - `crm_webhook_process`
   - `crm_scheduled_incremental` (on `maintenance` queue)
3. Any cron that hits `POST /api/jobs/process` (needs same env + `CRON_SECRET`)

There are **not** separate CRM sync / push / webhook worker binaries in this repo.  
If Coolify was split into multiple workers by queue name, each worker still needs the same CRM env vars, and at least one consumer must drain:

- `crm-zoho`
- `crm-pipedrive`
- `maintenance` (scheduled incremental tick)

## Commands on the DB-capable host

```bash
git fetch origin cursor/crm-integration-framework-b56f
git checkout cursor/crm-integration-framework-b56f
git pull origin cursor/crm-integration-framework-b56f
npm ci
npm run db:push
npm run crm:live-readiness
npm run worker:all   # keep running
```

`crm:live-readiness` prints SET/MISSING for each var (never values) and the exact callback URL.

## Provider console checklist

Register **exactly** the printed callback URL in:

- Zoho API Console (CRM OAuth client; enable multi-DC if testing non-US)
- Pipedrive Marketplace / OAuth app

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
