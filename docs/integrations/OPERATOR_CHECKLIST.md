# Native integrations operator checklist

## Environment
- [ ] `APP_URL` set to public HTTPS origin (e.g. `https://transovo.ai`)
- [ ] `INTEGRATION_SECRET_KEY` set (≥16 chars) on web + worker
- [ ] `DATABASE_URL` available to web + worker
- [ ] OAuth: `CALENDLY_CLIENT_ID/SECRET`, `MAILCHIMP_CLIENT_ID/SECRET`, `TYPEFORM_CLIENT_ID/SECRET`
- [ ] Confirm callbacks via `GET /api/integrations/native/env` (no secrets returned)

## Exact OAuth callbacks (must match APP_URL)
- `https://transovo.ai/api/integrations/native/calendly/callback`
- `https://transovo.ai/api/integrations/native/mailchimp/callback`
- `https://transovo.ai/api/integrations/native/typeform/callback`

## Per-provider
- [ ] Calendly OAuth app + callback + acceptance
- [ ] Mailchimp OAuth app + callback + acceptance
- [ ] Typeform OAuth app + scopes + callback + acceptance
- [ ] ActiveCampaign API URL+key validated
- [ ] WooCommerce HTTPS store + REST keys
- [ ] Jotform API key (+ EU base if needed)
- [ ] Close API key
- [ ] Freshdesk subdomain + API key
- [ ] Klaviyo scoped private key
- [ ] HighLevel PIT + location ID (single location only)

## Product verification
- [ ] Automation trigger appears for connected event
- [ ] Connected app action queues `integration_action`
- [ ] Contact profile shows Connected apps panel
- [ ] Inbox sidebar shows badges
- [ ] Softphone screen-pop shows integration context
- [ ] Segment rule `provider` / `source` resolves recipients
- [ ] Lead inbox + Appointments pages populate after sync
- [ ] Global search returns appointments / form submissions / external IDs
- [ ] `npm run test:native-integrations` passes
- [ ] Workers drain `ext-*` and `integration_*` jobs (in-process or `worker:all`)
