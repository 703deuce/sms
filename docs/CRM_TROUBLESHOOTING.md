# CRM Troubleshooting & Recovery

Prefer the **Diagnostics** console over SSH/logs:

**Integrations → CRM → [provider] → Diagnostics**

## Quick triage

| Symptom | First checks |
|---------|----------------|
| Connect button fails immediately | Diagnostics → Env vars; `APP_URL` + client ID/secret |
| Returns from CRM with error | Callback URL exact match; OAuth app scopes; human message on CRM list page |
| Connected but sync idle | Workers running? Diagnostics → Force resync |
| Calls not in CRM | Diagnostics → Call logging; Health → syncCalls preference; Features matrix |
| Token / “Needs Reauthentication” | Diagnostics → Token refresh; then Reconnect |
| Rate limited | Health rate-limit status; wait / automatic retry |
| Permission / field errors | CRM admin grants object/field access; check raw response on failed probe |

## Recovery actions

1. **Run core checks** — env, OAuth, refresh, API, rate limit.  
2. **Retry failed jobs** — requeues failed `crm_sync` / `crm_push_event` jobs.  
3. **Force initial resync** — queues a full initial sync.  
4. **Reconnect** — new OAuth; keeps object mappings when possible.  
5. **Validate + write probe** (Health) — creates a disposable CRM task to prove write access.

## Common root causes

- Callback registered as `http` vs `https`, or trailing slash on `APP_URL`
- Missing refresh/offline scopes → works once, fails overnight
- Sandbox vs production OAuth app credentials mixed
- Authorizing user lacks Task/Call/Contact create rights
- Worker process not running (`crm_sync` / `crm_push_event` stay queued)
- Pipedrive “Leads” expected — unsupported; use Persons + Deals

## Logs

- Provider **Logs** tab: sync runs + audit trail  
- Failed probe **Raw response**: provider API body (field errors, INVALID_FIELD, etc.)

## Environment / DB

`GET /api/crm/env` reports missing variables and whether CRM tables exist (no secret values).
