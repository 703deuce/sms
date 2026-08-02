# Transovo CRM Integration Framework

**Status:** Framework + production configuration phase (scopes, validation gate, initial sync, monitoring).  
**UI:** `/integrations/crm`  
**Code:** `src/lib/crm/**`  
**Production ops:** see `docs/CRM_PRODUCTION_CONFIGURATION.md`

## Project goal

Build a **provider-agnostic CRM integration framework** for Transovo Voice and SMS so customers can connect Transovo directly to their CRM without Zapier for normal workflows.

Supported first:

1. Salesforce  
2. Zoho CRM / Bigin  
3. Pipedrive  

Additional CRMs (HubSpot, Close, Dynamics, HighLevel, …) should only need a new adapter.

Transovo does **not** replace enterprise CRMs. It extends them: every call, SMS, voicemail, recording, transcript, note, callback, and interaction can synchronize into the CRM the customer already uses.

## Design philosophy

Do **not** build three separate integrations.

Build **one CRM Integration Framework** with thin provider adapters.

- All business logic stays provider-independent.
- Adapters only translate between CRM APIs and normalized Transovo objects.
- Adding a fourth CRM = new adapter, not an application rewrite.

Properties: modular, event-driven, asynchronous, fault tolerant, secure, scalable, maintainable.

## Architecture

```
Transovo events (calls, SMS, …)
        │
        ▼
  publishCrmEvent()  ──enqueue──►  crm_push_event job
        │
        ▼
  Sync engine / Push layer
        │
        ▼
  CrmConnector interface
        │
   ┌────┼────┐
   ▼    ▼    ▼
  SF  Zoho  Pipedrive
```

Normalized objects live in `src/lib/crm/types.ts` (Contact, Company, Lead, Deal, Task, Call, SMS, Note, …).

Each connector implements `CrmConnector` (`src/lib/crm/connector.ts`).

## What customers can do

- Connect via OAuth (no manual API key copy when OAuth is configured)
- Configure sync preferences
- Auto create/update CRM records from calls and SMS
- Log communication history + recording/transcript links
- Create follow-up tasks (missed call, callback, voicemail)
- View sync status / logs
- Disconnect and reconnect safely

Zapier remains a fallback for unsupported apps.

## Database

| Table | Purpose |
|-------|---------|
| `integration_connections` | Provider OAuth tokens + sync preferences (reused) |
| `crm_object_mappings` | Internal ↔ external IDs |
| `crm_field_mappings` | Admin field maps |
| `crm_sync_runs` | Sync job history |
| `crm_sync_events` | Per-run events |
| `crm_audit_logs` | OAuth / conflict / settings audit |

Apply schema: `npm run db:push`

## OAuth env vars

```
SALESFORCE_CLIENT_ID
SALESFORCE_CLIENT_SECRET
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
PIPEDRIVE_CLIENT_ID
PIPEDRIVE_CLIENT_SECRET
APP_URL
INTEGRATION_SECRET_KEY
```

Callback URLs (per provider — authorize sends these; no `/auth` segment):
- `{APP_URL}/api/crm/salesforce/callback`
- `{APP_URL}/api/crm/zoho/callback`
- `{APP_URL}/api/crm/pipedrive/callback`

## Jobs

| Job | Purpose |
|-----|---------|
| `crm_sync` | Initial / manual / incremental pull |
| `crm_push_event` | Push a Transovo event to one CRM |

Queue name: `integrations`

## API surface

| Route | Role |
|-------|------|
| `GET /api/crm/providers` | Card status for UI |
| `POST /api/crm/oauth/start` | Begin OAuth |
| `GET /api/crm/{provider}/callback` | OAuth return (e.g. `/api/crm/salesforce/callback`) |
| `POST /api/crm/sync` | Enqueue sync / validate |
| `GET\|PATCH\|DELETE /api/crm/settings` | Preferences / disconnect |
| `GET /api/crm/logs` | Runs + audit |
| `GET\|POST /api/crm/mappings` | Field / object mappings |

## Event wiring (today)

- Human call hangup / missed → `publishCallCompleted`
- Inbound SMS → `publishSmsEvent`

More emitters (outbound SMS, voicemail ready, transcript ready) can call the same `publishCrmEvent` API.

## Adding a fourth CRM

1. Create `src/lib/crm/adapters/<provider>.ts` implementing `CrmConnector`
2. Register in `src/lib/crm/registry.ts`
3. Add OAuth client env vars
4. No changes required to phone/SMS business logic

## Acceptance criteria

- [x] Framework + three adapters
- [x] OAuth start/callback/refresh/disconnect
- [x] Sync engine via background jobs
- [x] Push path for calls/SMS + task automation prefs
- [x] Mappings + audit/sync logs
- [x] Integrations CRM UI + connection wizard
- [ ] Live production OAuth apps configured per env
- [ ] Full parity soak-test against each CRM sandbox
