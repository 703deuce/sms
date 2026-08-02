# CRM Editions, OAuth Apps, and Environment Variables

## Salesforce

**Required:** API-enabled edition (typically Professional with API, Enterprise, Unlimited, or Developer). External Client App with OAuth.

**Scopes:** `api`, `refresh_token` / `offline_access` (see `src/lib/crm/scopes.ts`).

**Callback URL:** `{APP_URL}/api/crm/salesforce/callback`

**Env:**
- `SALESFORCE_CLIENT_ID`
- `SALESFORCE_CLIENT_SECRET`
- Optional: `SALESFORCE_WEBHOOK_SECRET`, `CRM_WEBHOOK_SECRET`

**PKCE:** Transovo sends `code_challenge` / `code_verifier` (S256) for Salesforce. External Client Apps that require Proof Key for Code Exchange are supported. If you see `missing required code challenge`, redeploy this build and click **Connect** again (do not reuse an old authorize tab).

**Notes:** Object-level access follows the authorizing user’s permission sets. Validation rules and required fields vary by org — use field discovery + mappings.

## Zoho CRM

**Required:** Zoho CRM edition with API access; OAuth client in Zoho API Console for the correct data center.

**Scopes:** See `src/lib/crm/scopes.ts` (modules read/write, settings fields, users).

**Callback URL:** `{APP_URL}/api/crm/zoho/callback`

**Env:**
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- Optional: `ZOHO_WEBHOOK_SECRET`

**Regional routing:** Token response `api_domain` is stored and used for all subsequent calls.

**Calls module:** May be plan-dependent; Transovo falls back to Tasks when Calls create/update fails.

## Bigin

**Separate product profile** from Zoho CRM. In Transovo settings, set **Zoho product → Bigin**.

- Leads auto-create is clamped off.
- Prefer Contacts + Pipelines/Deals + Activities.
- Native Bigin APIs use `/bigin/v*` and `ZohoBigin.*` scopes. Until a dedicated Bigin API path is sandbox-proven, Bigin connections that share Zoho CRM OAuth should be treated as **subscription-dependent / beta**.

## Pipedrive

**Required:** Company admin to authorize OAuth app with persons, organizations, deals, activities, notes, users, pipelines access.

**Callback URL:** `{APP_URL}/api/crm/pipedrive/callback`

**Env:**
- `PIPEDRIVE_CLIENT_ID`
- `PIPEDRIVE_CLIENT_SECRET`
- Optional: `PIPEDRIVE_WEBHOOK_SECRET`

**Leads:** Native Leads inbox is intentionally **unsupported**. Use Persons + Deals.

## Shared ops

1. `npx prisma db push` (CrmObjectMapping enterprise columns)
2. `npm run worker:all` (or BullMQ workers)
3. `npm run test:crm-enterprise`
4. Run sandbox checklist in `docs/CRM_ENTERPRISE_COMPLETION.md`
5. Flip capability matrix cells from Beta → sandbox-proven only after evidence

## RBAC

| Action | Roles |
| --- | --- |
| View CRM | Owner, Admin, Manager, Campaign Creator, Inbox Agent, Analyst, Read-only |
| Connect / Disconnect | Owner, Admin |
| Configure | Owner, Admin, Manager |
| Manual sync | Owner, Admin, Manager |
| Diagnostics | Owner, Admin, Manager, Analyst |
