# Calendly setup

## Authentication model
**oauth** — App-level OAuth (customers click Connect). Use a **web** OAuth application at https://developer.calendly.com (not a native app).

Developer accounts are separate from regular Calendly accounts. Create the OAuth app in the developer portal, then authorize with the Calendly user account you want Transovo to sync.

## Exact credentials / env
| Variable | Required | Notes |
|----------|----------|--------|
| `CALENDLY_CLIENT_ID` | Yes | Web app + Coolify |
| `CALENDLY_CLIENT_SECRET` | Yes | Web app + Coolify |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | Recommended | From OAuth app; used to verify `Calendly-Webhook-Signature`. **Spelling:** `CALENDLY_` (with **L**), not `CALENDY_` |
| `CALENDLY_WEBHOOK_SECRET` | Optional alias | Same purpose as signing key |
| `CALENDY_WEBHOOK_SIGNING_KEY` | Typo alias | Accepted for Coolify mistypes; rename to `CALENDLY_WEBHOOK_SIGNING_KEY` when you can |
| `APP_URL` | Yes | Public origin, no trailing slash |
| `INTEGRATION_SECRET_KEY` | Yes | Token encryption + OAuth state HMAC |
| `DATABASE_URL` | Yes | Connections + appointments |

There is **no separate worker service** — jobs drain in the main web process.

## Exact callback URL
`https://transovo.ai/api/integrations/native/calendly/callback`

Register this **exact** URL (HTTPS, no trailing slash). Built from `APP_URL` via `getIntegrationAppUrl()` / `externalOAuthCallbackUrl("calendly")`.

## Exact webhook URL
`{APP_URL}/api/integrations/native/webhooks/calendly?token={connectionWebhookToken}`

Legacy (still public): `{APP_URL}/api/integrations/calendly/webhook?token=…`

## Scopes (API v2 — least privilege)
Requested by code (`calendlyAdapter.oauth.scopes`):

| Scope | Why |
|-------|-----|
| `users:read` | `/users/me` identity |
| `event_types:read` | Event type metadata |
| `scheduled_events:read` | Events + invitees |
| `scheduled_events:write` | Cancel appointments from automations / UI |
| `scheduling_links:write` | Create single-use scheduling links |
| `shares:write` | Share/single-use link variants |
| `webhooks:read` | List subscriptions |
| `webhooks:write` | Create/delete subscriptions (paid plans) |

**Still unsupported (not requested):** Contacts API, direct Scheduling API booking, event-type / availability writes.

New Calendly OAuth apps grant **no** API access until scopes are approved. **Reconnect after deploy** so existing connections pick up the write scopes.

## Plan limitations
- **Free:** OAuth + reads + incremental reconcile work. **Webhook subscriptions are plan-blocked** (Standard / Teams / Enterprise). Mark as blocked by plan, not a Transovo bug.
- **Paid:** Webhook `invitee.created` / `invitee.canceled` / `invitee_no_show.created` can be registered automatically after Connect.

## Customer connection steps
1. Open `/integrations/native/calendly`.
2. Click Connect and approve scopes.
3. Confirm account identity (user + organization URIs).
4. Run **Test connection**, **Read probe**, then **Run acceptance**.
5. On Free: expect webhook registration blocked; confirm incremental sync still queues.

## Acceptance
`POST /api/integrations/native` with `{ "provider": "calendly", "action": "acceptance" }`.

Statuses: Live tested and passed | Failed and fixed | Code implemented but not live tested | Blocked by provider plan/permissions | Intentionally unsupported.

## Intentionally unsupported
- Calendly Contacts API
- Direct Scheduling API booking
- Single-use scheduling link creation
- Event-type / availability writes

## Disconnect
**Disconnect** in Transovo deletes encrypted secrets + mappings and attempts webhook subscription removal. Also revoke the app in Calendly if desired.
