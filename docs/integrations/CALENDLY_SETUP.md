# Calendly setup

## Authentication model
**oauth** — App-level OAuth (customers click Connect).

## Where to create credentials
OAuth app at https://developer.calendly.com

## Exact credentials / env
- Environment: `CALENDLY_CLIENT_ID / CALENDLY_CLIENT_SECRET`
- Customer enters: None beyond app registration (webhooks may require paid plan / org admin)

## Callback URL (OAuth only)
`https://transovo.ai/api/integrations/native/calendly/callback`

Register this **exact** URL (no trailing slash). Built from `APP_URL` via `getIntegrationAppUrl()`.

## Scopes / permissions
default via OAuth app

## Marketplace review
Not required for ordinary customer OAuth connection when using your own registered app.

## Plan limitations
Automatic when plan/role allows; otherwise polling/reconcile

## Webhook setup
Automatic when plan/role allows; otherwise polling/reconcile
Webhook URL pattern: `{APP_URL}/api/integrations/native/webhooks/calendly`

## Customer connection steps
1. Open `/integrations/native/calendly`.
2. Click Connect with OAuth and approve access.
3. Confirm account identity appears.
4. Run **Test connection**, **Read probe**, then **Run acceptance**.
5. Configure settings (reads/writes/webhooks/auto-create contacts).

## Acceptance-test steps
Use **Run acceptance** on the provider page or:
`POST /api/integrations/native` with `{ "provider": "calendly", "action": "acceptance" }`.

Statuses: Live tested and passed | Failed and fixed | Code implemented but not live tested | Blocked by provider plan or permissions | Intentionally unsupported.

## Disconnect / revocation
Use **Disconnect** in Transovo (deletes encrypted secrets + mappings). Also revoke the app/key in the provider admin console.

## Product surfaces wired
Automations triggers/actions · Contacts panel · Messenger sidebar · Phone screen-pop · Campaign segments (`source` / `provider`) · Lead inbox / Appointments (forms & calendars) · Global search.
