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

## Apply schema before deploy
- [ ] Run `supabase/migrations/20260802_native_integration_safety.sql` (or `db:push`)

## Manual setup order (after code deploy)
1. Calendly OAuth → Coolify → redeploy → connect → acceptance
2. Typeform OAuth → same
3. Mailchimp OAuth → same
4. Jotform API key (UI) → acceptance
5. Freshdesk subdomain + key → acceptance
6. ActiveCampaign API URL + key → acceptance
7. Klaviyo scoped private key → acceptance
8. WooCommerce store + REST keys → acceptance
9. Close API key → acceptance
10. HighLevel PIT + location ID → acceptance
11. Pipedrive disconnect/reconnect for `deals:full` → deal tests
12. Salesforce later when signup works

## Product verification
- [ ] Automation trigger appears for connected event
- [ ] Connected app action queues `integration_action`
- [ ] Contact profile shows Connected apps panel (cached, refreshable)
- [ ] Inbox sidebar shows badges without live provider calls
- [ ] Softphone screen-pop shows integration context from cache
- [ ] Segment rules: provider/source/form/order_status/consent_status/…
- [ ] Lead inbox + Appointments + Tasks + Orders pages populate after sync
- [ ] AI policy page saves workspace modes/limits
- [ ] Action audit records human/AI/automation runs
- [ ] Campaign enroll freezes audience snapshot + records exclusions
- [ ] Global search returns appointments / forms / tasks / orders / external IDs
- [ ] `npm run test:native-integrations` passes (≥31)
- [ ] Workers drain `ext-*` and `integration_*` jobs (in-process or `worker:all`)
- [ ] Live acceptance completed before calling production-ready
