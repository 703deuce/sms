# Typeform setup

## Authentication model
**oauth** — App-level OAuth (customers click Connect).

## Where to create credentials
Typeform developer applications

## Exact credentials / env
- Environment: `TYPEFORM_CLIENT_ID / TYPEFORM_CLIENT_SECRET`
- Customer enters: Registered OAuth app

## Callback URL (OAuth only)
`https://transovo.ai/api/integrations/native/typeform/callback`

Register this **exact** URL (no trailing slash). Built from `APP_URL` via `getIntegrationAppUrl()`.

## Scopes / permissions
forms:read responses:read webhooks:read webhooks:write offline accounts:read

## Marketplace review
Not required for ordinary customer OAuth connection when using your own registered app.

## Plan limitations
Form webhooks via API

## Webhook setup
Form webhooks via API
Webhook URL pattern: `{APP_URL}/api/integrations/native/webhooks/typeform`

## Customer connection steps
1. Open `/integrations/native/typeform`.
2. Click Connect with OAuth and approve access.
3. Confirm account identity appears.
4. Run **Test connection**, **Read probe**, then **Run acceptance**.
5. Configure settings (reads/writes/webhooks/auto-create contacts).

## Acceptance-test steps
Use **Run acceptance** on the provider page or:
`POST /api/integrations/native` with `{ "provider": "typeform", "action": "acceptance" }`.

Statuses: Live tested and passed | Failed and fixed | Code implemented but not live tested | Blocked by provider plan or permissions | Intentionally unsupported.

## Disconnect / revocation
Use **Disconnect** in Transovo (deletes encrypted secrets + mappings). Also revoke the app/key in the provider admin console.

## Product surfaces wired
Automations triggers/actions · Contacts panel · Messenger sidebar · Phone screen-pop · Campaign segments (`source` / `provider`) · Lead inbox / Appointments (forms & calendars) · Global search.
