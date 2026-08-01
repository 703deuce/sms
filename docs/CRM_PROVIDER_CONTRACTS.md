# CRM Provider Capability Contracts

Source of truth for what each provider’s APIs allow, how Transovo maps them, and whether the path is **live-wired** (not merely an unused adapter method).

Statuses used in the product matrix:

| Status | Meaning |
| --- | --- |
| Supported and sandbox-proven | Wired + passed real sandbox checklist |
| Beta | Wired in production paths; sandbox proof pending |
| Supported with fallback | Primary API with documented fallback |
| Subscription-dependent | Requires a specific CRM edition/module |
| Unsupported | Intentionally disabled |

> Until sandbox acceptance passes, customer-facing marketing must not claim “Supported and sandbox-proven.”

## Terminology map

| Transovo | Salesforce | Zoho CRM | Bigin | Pipedrive |
| --- | --- | --- | --- | --- |
| Contact | Contact | Contact | Contact | Person |
| Company | Account | Account | Company | Organization |
| Lead | Lead | Lead | Usually Contact/Pipeline | No default equivalent |
| Deal | Opportunity | Deal | Pipeline record | Deal |
| Task | Task | Task | Task/Activity | Activity |
| Call activity | Task (Call subtype) | Calls module (Task fallback) | Activity | Activity (type=call) |
| Owner | User/OwnerId | User/Owner | User/Owner | User/Owner |

## Salesforce

**OAuth:** External Client App → Auth Code + refresh. Scopes: `api`, `refresh_token`, `offline_access` (see `src/lib/crm/scopes.ts`).

**API:** REST `v59.0` against `instance_url` from token response.

| Object | Read | Create | Update | Delete detect | Search | Incremental | Webhooks | Live-wired |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Contact | Yes | Yes | Yes (PATCH by Id) | Via webhook event / policy | Phone + Email SOQL | `LastModifiedDate` | Generic ingest | Yes (beta) |
| Account | Yes | Yes | Yes | Same | — | `LastModifiedDate` | Generic | Yes (beta) |
| Lead | Yes | Yes | Yes | Same | — | `LastModifiedDate` | Generic | Yes (beta) |
| Opportunity | Yes | Yes | Yes | Same | — | `LastModifiedDate` | Generic | Yes when `syncOpportunities` |
| Task | — | Yes | Yes | — | — | — | — | Yes + idempotent map |
| ContentNote | — | Yes + link | — | — | — | — | — | Yes with Task fallback |
| Call | — | Task Call subtype | Same Task Id | — | — | — | — | One activity lifecycle |
| SMS | — | Task | Same Task Id | — | — | — | — | One SMS mapping |
| User | Active users | — | — | — | — | — | — | Yes |
| Pipeline/Stage | OpportunityStage / picklist | — | — | — | — | — | — | Metadata map |

**Rate limits:** Salesforce concurrent/API limits; Transovo applies per-connection rate gates on reads and writes.

**Limitations:** Org-specific required fields and validation rules; schema discovery via `listFields`. Change Data Capture not subscribed yet.

## Zoho CRM / Bigin

**OAuth:** Zoho accounts server + regional `api_domain`. Offline refresh required.

**API:** Zoho CRM uses `/crm/v2` on the regional host. **Bigin is a separate product profile** (`zohoProduct: "bigin"` in sync preferences): pipeline-centric modules (Contacts, Accounts/Companies, Pipelines/Deals, Tasks, Calls, Notes). Native Zoho CRM **Leads** are disabled for Bigin. Bigin’s native API surface is `/bigin/v*` with `ZohoBigin.*` scopes — treat Bigin as subscription/product-dependent until a dedicated Bigin adapter path is sandbox-proven; do not advertise Zoho CRM Lead parity for Bigin customers.

**API (Zoho CRM default):** `/crm/v2` on regional host.

| Object | Read | Create | Update | Delete detect | Search | Incremental | Webhooks | Live-wired |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Contact | Yes | Yes | Yes (PUT id) | Webhook policy | phone/email search | `Modified_Time` search | Generic | Yes (beta) |
| Account | Yes | Yes | Yes | Same | — | `Modified_Time` | Generic | Yes (beta) |
| Lead | Yes | Yes | Yes | Same | — | `Modified_Time` | Generic | When enabled |
| Deal | Yes | Yes | Yes | Same | — | `Modified_Time` | Generic | When enabled |
| Task | — | Yes | Yes | — | — | — | — | Yes |
| Note | — | Yes (Parent_Id) | — | — | — | — | — | Yes |
| Call | — | Calls module | Same Call Id | — | — | — | — | Native + Task fallback |
| SMS | — | Task | Same Task Id | — | — | — | — | Yes |
| User | ActiveUsers | — | — | — | — | — | — | Yes |
| Pipeline/Stage | Deal Stage picklist | — | — | — | — | — | — | Metadata |

**Bigin:** Treat as its own capability profile. Do not expose unsupported Zoho CRM modules. Prefer pipeline-centric objects; disable Lead/Calls claims until Bigin sandbox proves them.

**Limitations:** Calls module may require plan; fallback is Task. API credits / concurrency per org.

## Pipedrive

**OAuth:** Pipedrive OAuth; `api_domain` from token.

**API:** `/v1` persons, organizations, deals, activities, notes, users, pipelines, stages.

| Object | Read | Create | Update | Delete detect | Search | Incremental | Webhooks | Live-wired |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Person | Yes | Yes | Yes | Webhook policy | phone/email search | `update_time` sort stop | Generic | Yes (beta) |
| Organization | Yes | Yes | Yes | Same | — | `update_time` | Generic | Yes (beta) |
| Lead | No (default) | — | — | — | — | — | — | Unsupported |
| Deal | Yes | Yes | Yes | Same | — | `update_time` | Generic | When enabled |
| Activity/Task | — | Yes | Yes | — | — | — | — | Yes |
| Note | — | Yes | — | — | — | — | — | Yes |
| Call | — | activity type=call | Same Id | — | — | — | — | Lifecycle |
| SMS | — | activity type=sms | Same Id | — | — | — | — | Lifecycle + MMS URLs |
| User | Yes | — | — | — | — | — | — | Yes |
| Pipeline/Stage | Yes | — | — | — | — | — | — | Yes |

**Limitations:** Native Leads inbox intentionally unsupported unless a future Leads API path is enabled. Custom field keys from `*Fields` endpoints.

## External identity mapping (all providers)

Every synced object persists on `CrmObjectMapping`:

- workspace, provider, object type
- internalId ↔ externalId (unique both directions)
- parentExternalId, syncHash, syncVersion, syncStatus
- lastSyncedAt, lastCrmModifiedAt, lastInternalModifiedAt
- externalDeletedAt

Phone/email are **initial match only**. After mapping, updates always use external Id.
