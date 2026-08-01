# Mailchimp setup

## Authentication model
**oauth** — App-level OAuth (customers click Connect).

## Where to create credentials
Mailchimp Developer / Registered app

## Exact credentials / env
- Environment: `MAILCHIMP_CLIENT_ID / MAILCHIMP_CLIENT_SECRET`
- Customer enters: OAuth for customer accounts (Marketplace is separate)

## Callback URL (OAuth only)
`https://transovo.ai/api/integrations/native/mailchimp/callback`

Register this **exact** URL (no trailing slash). Built from `APP_URL` via `getIntegrationAppUrl()`.

## Scopes / permissions
Account access via OAuth; DC from metadata

## Marketplace review
Not required for ordinary customer OAuth connection when using your own registered app.

## Plan limitations
Audience webhooks (manual or API where available)

## Webhook setup
Audience webhooks (manual or API where available)
Webhook URL pattern: `{APP_URL}/api/integrations/native/webhooks/mailchimp`

## Customer connection steps
1. Open `/integrations/native/mailchimp`.
2. Click Connect with OAuth and approve access.
3. Confirm account identity appears.
4. Run **Test connection**, **Read probe**, then **Run acceptance**.
5. Configure settings (reads/writes/webhooks/auto-create contacts).

## Acceptance-test steps
Use **Run acceptance** on the provider page or:
`POST /api/integrations/native` with `{ "provider": "mailchimp", "action": "acceptance" }`.

Statuses: Live tested and passed | Failed and fixed | Code implemented but not live tested | Blocked by provider plan or permissions | Intentionally unsupported.

## Disconnect / revocation
Use **Disconnect** in Transovo (deletes encrypted secrets + mappings). Also revoke the app/key in the provider admin console.

## Product surfaces wired
Automations triggers/actions · Contacts panel · Messenger sidebar · Phone screen-pop · Campaign segments (`source` / `provider`) · Lead inbox / Appointments (forms & calendars) · Global search.
