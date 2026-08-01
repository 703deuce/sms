# CRM Integration — Production Configuration

**Phase:** Finish production readiness on the existing framework (no redesign).  
**Providers:** Salesforce · Zoho CRM/Bigin · Pipedrive  
**HubSpot:** out of scope for this framework path.

## Goal

A customer can:

1. Click **Connect**
2. Complete OAuth
3. Pass connection validation
4. Configure sync preferences
5. Run initial sync
6. Synchronize calls, SMS, contacts, leads/tasks, recording URLs, transcript URLs

## Deploy checklist

```bash
npm run db:push          # CRM tables + IntegrationConnection columns
# Set provider OAuth env vars (below)
# Register callback: {APP_URL}/api/crm/oauth/callback
npm run worker:all       # drains crm_sync + crm_push_event
```

Env:

```
APP_URL=
INTEGRATION_SECRET_KEY=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
PIPEDRIVE_CLIENT_ID=
PIPEDRIVE_CLIENT_SECRET=
```

---

## Least-privilege OAuth scopes (verified 2026-08)

Sources reviewed:

- Salesforce OAuth scope values (Mobile SDK / External Client Apps)
- [Zoho CRM API v8 Scopes](https://www.zoho.com/crm/developer/docs/api/v8/scopes.html)
- [Pipedrive Marketplace scopes](https://pipedrive.readme.io/docs/marketplace-scopes-and-permissions-explanations)

Code source of truth: `src/lib/crm/scopes.ts`

### Salesforce (External Client App)

| Scope | Why |
|-------|-----|
| `api` | REST access for Contacts, Leads, Accounts, Opportunities, Tasks, Notes |
| `refresh_token` | Unattended sync after user leaves |
| `offline_access` | Synonym path for refresh eligibility |

**Not requested:** `full`, `web`, `chatter_api`, `lightning`.

**Important:** Object CRUD is enforced by the **authorizing user's permission set**, not OAuth scopes. Grant the integration user CRUD on Contact, Lead, Account, Opportunity, Task (+ ContentNote if used). No Modify All Data.

### Zoho CRM / Bigin (Server-based OAuth)

| Scope | Why |
|-------|-----|
| `ZohoCRM.modules.contacts.ALL` | Contact sync |
| `ZohoCRM.modules.leads.ALL` | Lead sync when enabled |
| `ZohoCRM.modules.accounts.ALL` | Companies |
| `ZohoCRM.modules.deals.ALL` | Deals when enabled |
| `ZohoCRM.modules.tasks.ALL` | Follow-up tasks |
| `ZohoCRM.modules.notes.ALL` | Notes |
| `ZohoCRM.modules.calls.ALL` | Call module logging |
| `ZohoCRM.modules.search.READ` | Duplicate search |
| `ZohoCRM.users.READ` | Owner mapping |
| `ZohoCRM.settings.modules.READ` | Module discovery |
| `ZohoCRM.settings.fields.READ` | Field mapping |

**Not requested:** `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL`, `org.ALL`, bulk/coql.

Use `access_type=offline`. Regional `api_domain` from token response is stored and used for API host.

### Pipedrive (Marketplace OAuth app)

| Scope | Why |
|-------|-----|
| `base` | Required baseline |
| `contacts:full` | Persons + Organizations |
| `deals:full` | Deals + pipeline/stage read |
| `activities:full` | Calls, SMS, tasks as activities |
| `users:read` | Owner mapping |

**Not requested:** `mail:*`, products, admin scopes.

Configure the same scopes in Developer Hub → Auth & access. Callback = `{APP_URL}/api/crm/oauth/callback`.

---

## Internal data model (production)

| Store | Purpose |
|-------|---------|
| `integration_connections` | Per-workspace CRM connection: tokens, status, connected user/account, last success/fail, syncStatus, lastError |
| `crm_object_mappings` | Persistent internal ↔ CRM IDs (contact, company, user, pipeline, stage, deal, task, …) — **never phone-only** |
| `crm_field_mappings` | Customer-configurable field maps |
| `crm_sync_runs` | Sync history: direction, duration, attempts, result, errors |
| `crm_sync_events` | Per-run detail (create/update/skip/conflict) |
| `crm_audit_logs` | OAuth, disconnect, reconnect, mapping, conflicts, permissions |
| `crm_webhook_events` | Inbound CRM webhook queue |
| `crm_dead_letters` | Exhausted retries |
| `job_queue` | Pending / retry / failed async jobs (`crm_sync`, `crm_push_event`) |

---

## Connection gate

Before status = **Connected**, validation runs (`src/lib/crm/validate.ts`):

1. Access token present  
2. Refresh token present  
3. API reachability / metadata  
4. Read test (list contacts)  
5. Optional write probe (task)  
6. Refresh token exchange (soft-warn if just authorized)

UI: **Validate** / **Validate + write probe** on provider Health tab.

---

## Initial sync (after OAuth)

Imports (no historical activities unless later enabled):

- Users / owners → mappings  
- Pipelines + stages → mappings  
- Companies / Accounts → mappings  
- Contacts → Transovo contacts + mappings  

Leads listed when `autoCreateLeads` is on.

---

## Event sync (Transovo → CRM)

| Event | Emitter |
|-------|---------|
| call.completed / call.missed | Human call hangup webhook |
| recording.ready | `call.recording.saved` |
| sms.received | Inbound SMS processor |
| voicemail / callback / transcript | `publish*` helpers ready for call sites |

Push path uses conflict resolution (`src/lib/crm/conflict.ts`) before create.

---

## Acceptance (still requires sandbox)

Framework + production config code is in place. **Live Connect still requires:**

1. Provider OAuth apps created with scopes above  
2. Env vars set  
3. `db:push` applied  
4. Worker running  
5. Sandbox end-to-end test per provider  

Until those five are true, Connect will not succeed in production.
