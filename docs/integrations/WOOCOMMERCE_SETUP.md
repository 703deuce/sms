# WooCommerce setup

## Authentication model
**credentials** — Customer-supplied credentials (not OAuth). Secrets encrypted at rest and never shown again after save.

## Where to create credentials
WooCommerce → Settings → Advanced → REST API

## Exact credentials / env
- Environment: `None (customer supplies)`
- Customer enters: Store URL + consumer key + consumer secret (HTTPS in production)

## Callback URL (OAuth only)
`N/A`

Register this **exact** URL (no trailing slash). Built from `APP_URL` via `getIntegrationAppUrl()`.

## Scopes / permissions
Read/Write key

## Marketplace review
Not applicable — customers supply credentials from their own account (avoids marketplace review).

## Plan limitations
REST webhooks registered by Transovo

## Webhook setup
REST webhooks registered by Transovo
Webhook URL pattern: `{APP_URL}/api/integrations/native/webhooks/woocommerce`

## Customer connection steps
1. Open `/integrations/native/woocommerce`.
2. Paste credentials, click Connect (validated before save).
3. Confirm account identity appears.
4. Run **Test connection**, **Read probe**, then **Run acceptance**.
5. Configure settings (reads/writes/webhooks/auto-create contacts).

## Acceptance-test steps
Use **Run acceptance** on the provider page or:
`POST /api/integrations/native` with `{ "provider": "woocommerce", "action": "acceptance" }`.

Statuses: Live tested and passed | Failed and fixed | Code implemented but not live tested | Blocked by provider plan or permissions | Intentionally unsupported.

## Disconnect / revocation
Use **Disconnect** in Transovo (deletes encrypted secrets + mappings). Also revoke the app/key in the provider admin console.

## Product surfaces wired
Automations triggers/actions · Contacts panel · Messenger sidebar · Phone screen-pop · Campaign segments (`source` / `provider`) · Lead inbox / Appointments (forms & calendars) · Global search.
