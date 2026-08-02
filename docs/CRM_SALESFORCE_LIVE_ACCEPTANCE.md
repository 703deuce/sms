# Salesforce Live Integration Acceptance Report

**Date:** 2026-08-02  
**Branch:** `cursor/salesforce-live-acceptance-b56f`  
**Production app:** `https://transovo.ai`  
**Verdict:** **Not production-ready yet** — code path hardened and mocked tests pass; full live org acceptance must be run on the deployed workspace after Coolify redeploy of web + `worker:all`.

> **Clarification:** An earlier agent log that printed `SALESFORCE_CLIENT_ID: MISSING` referred only to the **Cursor coding sandbox**, which has no Coolify secrets. It does **not** mean production is missing those vars. Use Integrations → Salesforce → Diagnostics on `transovo.ai` to see presence flags for the live web process.

Status values used below (only these):

- Live tested and passed
- Failed and fixed
- Code implemented but not live tested
- Blocked by Salesforce edition or permission
- Intentionally unsupported

---

## 1. Inspection (from repository — not guessed)

| Item | Exact value from code |
|------|------------------------|
| Client ID env | `SALESFORCE_CLIENT_ID` |
| Client secret env | `SALESFORCE_CLIENT_SECRET` |
| Token encryption | `INTEGRATION_SECRET_KEY` (AES-GCM) |
| Public app URL | `APP_URL` (no trailing slash) |
| Optional webhook HMAC | `SALESFORCE_WEBHOOK_SECRET`, shared `CRM_WEBHOOK_SECRET` |
| OAuth callback route | `/api/crm/salesforce/callback` |
| Production callback URI | `https://transovo.ai/api/crm/salesforce/callback` (when `APP_URL=https://transovo.ai`) |
| Authorization URL | `https://login.salesforce.com/services/oauth2/authorize` |
| Token URL | `https://login.salesforce.com/services/oauth2/token` |
| Scopes | `api`, `refresh_token`, `offline_access` |
| API version | `v59.0` |
| Client app model | External Client App with **PKCE required** (`requiresPkce: true`) |
| Queue | `crm-salesforce` via `crmQueueName("salesforce")` |
| Workers | `npm run worker:all` drains CRM queues (also in-process drain) |
| Job types | `crm_sync`, `crm_push_event`, `crm_metadata_refresh`, `crm_bulk_sync`, `crm_webhook_process`, `crm_scheduled_incremental` |
| DB migration | Prefer `npm run db:push` (Supabase-compat). `npm run db:deploy` exists for Prisma migrate history |
| CDC / Streaming / Pub-Sub | **Not implemented** — intentionally unsupported |
| Supported objects (adapter) | Contact, Account, Lead, Opportunity, Task/Call/SMS activities, ContentNote (+ Task note fallback), User, OpportunityStage, LeadStatus (read), field describe |

Dev callback (local): `http://localhost:3000/api/crm/salesforce/callback` when `APP_URL=http://localhost:3000`.

---

## 2. Configuration

| Area | Status | Notes |
|------|--------|-------|
| Environment variables | Code implemented but not live tested | Presence checks via `checkCrmEnvironment("salesforce")` / `npm run crm:live-readiness`. Agent VM has no Coolify secrets. |
| Callback URL | Code implemented but not live tested | Exact: `{APP_URL}/api/crm/salesforce/callback` — must match Salesforce External Client App redirect URI character-for-character |
| OAuth scopes | Code implemented but not live tested | Least privilege: `api` + `refresh_token` + `offline_access`. No `full` / Chatter / Lightning / Data Cloud |
| Salesforce API version | Code implemented but not live tested | Hard-coded `v59.0` |
| Database migration | Code implemented but not live tested | Schema includes connection tokens, org/user ids in config, mappings, sync runs/events, webhooks, dead letters, field mappings, audit |
| Workers | Code implemented but not live tested | After Coolify env change: **redeploy/restart web app and `worker:all`** so both receive Salesforce credentials |
| Webhooks / change events | Intentionally unsupported | CDC not subscribed. Generic inbound route enqueues incremental reconcile sync only |

### Scope-to-feature table

| Scope | Required feature | Requested by code | Necessary |
|-------|------------------|-------------------|-----------|
| `api` | REST CRUD, SOQL, describe, userinfo/API identity | Yes | Yes |
| `refresh_token` | Unattended sync / token refresh | Yes | Yes |
| `offline_access` | Alias for refresh across SF client configs | Yes | Yes |
| `id` / `openid` | Not required — identity via `/services/oauth2/userinfo` + token `id` with `api` | No | No |
| `full`, Chatter, VF, Data Cloud, Analytics, Pardot, Einstein, Content, Lightning, MCP, Service Cloud RT | Not used | No | No |

### Env presence matrix (what each service needs)

| Variable | Required | Service / worker |
|----------|----------|------------------|
| `SALESFORCE_CLIENT_ID` | Yes | Web (OAuth start/callback) |
| `SALESFORCE_CLIENT_SECRET` | Yes | Web (token exchange/refresh) |
| `APP_URL` | Yes | Web (redirect_uri) |
| `INTEGRATION_SECRET_KEY` | Yes | Web + workers (token encrypt + OAuth state HMAC) |
| `DATABASE_URL` | Yes | Web + workers |
| `SALESFORCE_WEBHOOK_SECRET` | Optional | Web webhook ingest |
| `CRM_WEBHOOK_SECRET` | Optional | Web webhook ingest (shared) |
| API version env | N/A | Hard-coded `v59.0` |

Missing client id/secret throws a clear OAuth start error via `assertCrmOAuthEnv` — not a vague authorize failure.

---

## 3. OAuth

| Item | Status | Notes |
|------|--------|-------|
| Authorization | Code implemented but not live tested | PKCE S256 + `prompt=login consent` |
| Callback | Code implemented but not live tested | State HMAC validated; per-provider route |
| Token storage | Code implemented but not live tested | Access + refresh encrypted at rest |
| Org + user identity | Failed and fixed | Previously collapsed org/user into one field; now `details.organizationId` + `details.userId` persisted as `config.organizationId` / `config.salesforceUserId` |
| Refresh | Code implemented but not live tested | Diagnostics probe `token_refresh` |
| Disconnect | Code implemented but not live tested | Token cleanup path in CRM disconnect |
| Reconnect | Code implemented but not live tested | Unique `(workspaceId, provider)` prevents duplicate connection rows |

---

## 4. CRM objects

| Object | Status |
|--------|--------|
| Contacts | Code implemented but not live tested (acceptance: create/update/SOQL/metadata) |
| Accounts | Code implemented but not live tested |
| Leads | Code implemented but not live tested |
| Opportunities | Code implemented but not live tested (CloseDate + StageName defaults) |
| Tasks | Code implemented but not live tested |
| Notes | Code implemented but not live tested (ContentNote + Task fallback) |
| Activities | Code implemented but not live tested |
| Users | Code implemented but not live tested |
| Custom fields | Code implemented but not live tested (mappings + describe) |
| Lead statuses | Code implemented but not live tested (SOQL LeadStatus) |
| Opportunity stages | Code implemented but not live tested (OpportunityStage + virtual pipeline) |

---

## 5. Communications

| Item | Status |
|------|--------|
| Incoming / outgoing / missed calls | Code implemented but not live tested — one Task (`TaskSubtype=Call`) per Transovo call; updates patch same id |
| Voicemail / transfers | Code implemented but not live tested (notes/disposition fields) |
| Recording / transcript / AI summary | Code implemented but not live tested — URL/text on same activity when prefs enabled |
| Inbound / outbound SMS | Code implemented but not live tested |
| MMS | Code implemented but not live tested — media URLs in description; no binary Files upload |
| Delivery/failure updates | Code implemented but not live tested — status on SMS Task update |

---

## 6. Reliability

| Item | Status |
|------|--------|
| Initial sync | Code implemented but not live tested |
| Incremental sync | Code implemented but not live tested — `LastModifiedDate` SOQL checkpoints |
| Change events / CDC | Intentionally unsupported |
| Conflict handling | Code implemented but not live tested |
| Deletion handling | Code implemented but not live tested (webhook delete keywords + sync policy) |
| Retry / rate limits / idempotency | Code implemented but not live tested |
| Worker restart recovery | Code implemented but not live tested — job queue + scheduled incremental |
| Fake webhook blocking sync | Failed and fixed — removed Salesforce `handleWebhook` no-op that previously short-circuited reconcile enqueue |

---

## 7. Security

| Item | Status |
|------|--------|
| Encryption | Code implemented but not live tested |
| OAuth state CSRF | Code implemented but not live tested |
| Tenant isolation | Code implemented but not live tested — workspace-scoped unique constraints + job payloads |
| Role permissions | Code implemented but not live tested (`canCrmAction`) |
| Log redaction | Code implemented but not live tested |
| Disconnect cleanup | Code implemented but not live tested |

---

## 8. Issues discovered and fixed in this pass

1. **Org vs user identity collapsed** — `validateConnection` / `validateCrmProductionConnection` preferred org id as `connectedUserId`. Fixed: separate `organizationId` + `salesforceUserId` in connection config; `connectedUserId` prefers real user id.
2. **Webhook handler blocked incremental reconcile** — Salesforce `handleWebhook` accepted payloads without enqueueing sync. Fixed: removed adapter `handleWebhook` so `processCrmWebhookJob` falls through to `enqueueCrmSync({ kind: "webhook" })`.
3. **Enterprise test incorrectly required `handleWebhook` on Salesforce** — updated to assert it is intentionally absent.
4. **Readiness / env docs omitted Salesforce** — `crm-live-readiness`, `.env.example`, env-check APP_URL message, diagnostics env probe now include Salesforce callback and secrets.
5. **No job-handler registration guard** — added `CRM_JOB_TYPES` + test that fails if CRM emits an unhandled job type.
6. **CRM OAuth ignored `NEXT_PUBLIC_APP_URL`** — native integrations accepted it, CRM OAuth only read `APP_URL` (else localhost). Fixed: CRM now uses `getIntegrationAppUrl()`.
7. **Stale docs listed wrong callback** — some docs said `/api/crm/oauth/callback` while authorize sends `/api/crm/salesforce/callback`. Corrected; both routes exist, but Salesforce redirect URI must match the authorize `redirect_uri`.
8. **Diagnostics hid which vars the web process actually has** — providers + diagnostics now show presence-only rows and the exact callback URL.

---

## 9. How to complete live acceptance (deployed org)

After Coolify redeploy of **web** and **worker:all**:

1. Presence check (on host): `npm run crm:live-readiness`
2. UI: Integrations → CRM → Salesforce → Connect (if needed) → Diagnostics
3. Run acceptance suite: `POST /api/crm/diagnostics` with `{ "provider": "salesforce", "action": "acceptance" }`
4. Confirm Salesforce External Client App redirect URI is exactly:
   `https://transovo.ai/api/crm/salesforce/callback`
5. Confirm labeled test records appear in the org (`Transovo Salesforce Test *`) and can be deleted

Do **not** declare production-ready until that suite returns Live tested and passed for OAuth, CRUD, call lifecycle update-same-id, SMS, metadata, and incremental sync — with CDC remaining Intentionally unsupported.

---

## 10. Files changed

- `src/lib/crm/adapters/salesforce.ts`
- `src/lib/crm/validate.ts`
- `src/lib/crm/types.ts`
- `src/lib/crm/acceptance.ts`
- `src/lib/crm/env-check.ts`
- `src/lib/crm/diagnostics.ts`
- `src/lib/crm/feature-matrix.ts`
- `src/lib/crm/runtime/job-types.ts` (new)
- `scripts/crm-live-readiness.ts`
- `scripts/test-crm-enterprise.ts`
- `.env.example`
- `docs/CRM_SALESFORCE_LIVE_ACCEPTANCE.md` (this report)

---

## 11. Edition / plan dependencies

- API-enabled Salesforce edition required for REST + SOQL
- Authorizing user must have object/field permissions for Contact, Account, Lead, Opportunity, Task, User, OpportunityStage, LeadStatus
- ContentNote may require Files/Notes permissions; adapter falls back to Task notes
- Change Data Capture requires additional Salesforce event licensing — **not used**; do not claim webhook CDC until subscribed
- Sandbox (`test.salesforce.com`) is not currently a configurable authorize host — production login host is hard-coded
