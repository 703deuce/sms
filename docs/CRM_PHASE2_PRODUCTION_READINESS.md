# Phase 2 — Provider Production Readiness & End-to-End Validation

**Status:** Framework complete. This phase is connectivity, reliability, polish, and ops tooling — not new architecture.  
**Providers:** Salesforce · Zoho CRM/Bigin · Pipedrive  
**HubSpot:** out of scope

## Goal

Customer path:

**Connect → OAuth succeeds → Initial sync completes → Calls & SMS sync reliably → Production ready**

Do not redesign the framework. Do not add abstractions unless required for production.

---

## What ships in code (this phase)

| Area | Location |
|------|----------|
| Env validation (helpful errors) | `src/lib/crm/env-check.ts`, `GET /api/crm/env` |
| Token encryption at rest | `src/lib/crm/secrets.ts` (AES-GCM via `INTEGRATION_SECRET_KEY`) |
| Human-readable errors | `src/lib/crm/human-errors.ts` (OAuth start/callback + UI) |
| Feature / compatibility matrix | `src/lib/crm/feature-matrix.ts`, `GET /api/crm/features` |
| DB schema check | `src/lib/crm/db-check.ts` |
| **CRM Compatibility / Test Console** | `src/lib/crm/diagnostics.ts`, `GET/POST /api/crm/diagnostics`, UI tab **Diagnostics** |
| Expanded health dashboard | `GET /api/crm/health` (objects synced, rate limit, API status, retries) |
| Graceful unsupported features | Push path skips unsupported call/SMS/task features |

---

## Part 1 — Production OAuth apps (manual in provider consoles)

Code cannot create your OAuth apps. Create them once per environment.

### Per-provider callbacks (authorize sends these)

```
{APP_URL}/api/crm/salesforce/callback
{APP_URL}/api/crm/zoho/callback
{APP_URL}/api/crm/pipedrive/callback
```

Must match **exactly** (scheme, host, path, no trailing slash on `APP_URL`).  
Legacy `{APP_URL}/api/crm/oauth/callback` still accepts a return, but is not what authorize sends.

### Salesforce

1. Create a production **External Client App** (or Connected App).
2. Enable OAuth; allow refresh tokens / offline access.
3. Callback URLs: production + sandbox (sandbox authorize host may differ; app still uses login vs test depending on config).
4. Set scopes from `src/lib/crm/scopes.ts` (`api`, `refresh_token`, `offline_access`).
5. Env: `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`.

Verify: Install → callback → refresh → reconnect.

### Zoho

1. Create Server-based OAuth client in Zoho API Console.
2. Configure regional accounts (com / eu / in / …); token `api_domain` is stored and used.
3. Sandbox + production redirect URIs as needed.
4. Scopes: see `docs/CRM_PRODUCTION_CONFIGURATION.md`.
5. Env: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`.

Verify: OAuth → regional API host → refresh.

### Pipedrive

1. Create Marketplace / OAuth app.
2. Production + sandbox callbacks.
3. Scopes: `base`, `contacts:full`, `deals:full`, `activities:full`, `users:read`.
4. Env: `PIPEDRIVE_CLIENT_ID`, `PIPEDRIVE_CLIENT_SECRET`.

Verify: OAuth → refresh → disconnect → reconnect.

---

## Part 2 — Environment validation

```bash
# Presence-only (no secret values returned)
curl -s "$APP_URL/api/crm/env" -H "Cookie: …"
```

Required:

```
APP_URL
INTEGRATION_SECRET_KEY
DATABASE_URL
SALESFORCE_CLIENT_ID / SALESFORCE_CLIENT_SECRET
ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET
PIPEDRIVE_CLIENT_ID / PIPEDRIVE_CLIENT_SECRET
```

Missing vars block Connect with a human-readable message pointing at Diagnostics.

Tokens are encrypted when `INTEGRATION_SECRET_KEY` is set. Keep prod/dev apps and secrets isolated.

---

## Part 3 — Database validation

```bash
npm run db:push
```

Then `GET /api/crm/env` → `db` section checks CRM tables:

- `integration_connections` (+ CRM columns)
- `crm_object_mappings`, `crm_field_mappings`
- `crm_sync_runs`, `crm_sync_events`, `crm_audit_logs`
- `crm_webhook_events`, `crm_dead_letters`

---

## Part 4–6 — Sandbox & event validation (requires real credentials)

Use **Integrations → CRM → [provider] → Diagnostics**:

| Probe | What it proves |
|-------|----------------|
| Env / OAuth / API | Config + token + reachability |
| Token refresh | Offline sync will work |
| Contact / Lead / Task create | Write permissions |
| Call / SMS logging | Activity push |
| Recording / Transcript attach | Link fields in activity body |
| Force resync | Initial sync queue |
| Retry failed | Job + dead-letter recovery |

Also exercise: Connect, Disconnect, Reconnect, Initial sync, Incremental sync, expired token, permission failure, rate limit, missing fields, deleted/duplicate contact.

Events to confirm in the CRM after live traffic:

Incoming/outgoing/missed call · Voicemail · Recording ready · Transcript ready · SMS sent/received · Task / callback · Contact updated

---

## Part 7 — Feature matrix

UI: provider **Features** tab. API: `GET /api/crm/features`.

Never assume parity (e.g. Pipedrive leads = unsupported). Unsupported features are skipped in push; Diagnostics marks them skipped.

---

## Part 8 — Connection wizard

After OAuth: wizard steps → preferences → initial sync → Health / Done.  
Technical OAuth errors are humanized for customers.

---

## Part 9 — Sync reliability

Already in framework: job queue, retry/defer (`CrmHttpError.retryable`), dead letters, conflict/duplicate handling, token refresh skew, audit trail.  
Diagnostics: **Retry failed jobs**, **Force initial resync**.

---

## Part 10 — Monitoring

Health tab / `GET /api/crm/health` per provider:

Connected · Token valid · Last sync · Objects synced · Queue size · Failed jobs · Retries · Webhook status · Rate limit · API status

---

## Part 11 — Documentation index

| Doc | Audience |
|-----|----------|
| `docs/CRM_INTEGRATION_FRAMEWORK.md` | Architecture |
| `docs/CRM_PRODUCTION_CONFIGURATION.md` | Scopes, env, acceptance |
| `docs/CRM_PHASE2_PRODUCTION_READINESS.md` | This checklist |
| `docs/CRM_CUSTOMER_SETUP.md` | Customer / admin setup |
| `docs/CRM_TROUBLESHOOTING.md` | Support recovery |

---

## Part 12 — Production acceptance checklist

For **each** of Salesforce, Zoho, Pipedrive against a **real sandbox**:

- [ ] Connect  
- [ ] Initial sync  
- [ ] Incremental sync  
- [ ] Calls  
- [ ] SMS  
- [ ] Tasks  
- [ ] Recording links  
- [ ] Transcript links  
- [ ] Token refresh  
- [ ] Disconnect  
- [ ] Reconnect  

No provider is complete until every workflow succeeds live.

---

## CRM Compatibility / Test Console (support tooling)

Path: `/integrations/crm/[provider]?tab=diagnostics`

When a customer says “Salesforce isn’t syncing my calls,” open Diagnostics and expect something like:

- ✅ OAuth valid  
- ✅ API reachable  
- ❌ Call logging failed: field mapping / permission message  
- Last successful sync: …  
- Retry / Force resync available  
- Raw API response expandable  

This is the highest-leverage ops feature after the framework itself.
