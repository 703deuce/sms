# Native integrations operator checklist

## Environment
- [ ] `APP_URL` set to public HTTPS origin (e.g. `https://transovo.ai`)
- [ ] `INTEGRATION_SECRET_KEY` set (≥16 chars) on web + worker
- [ ] `DATABASE_URL` available to web + worker
- [ ] Native OAuth: `CALENDLY_CLIENT_ID/SECRET`, `TYPEFORM_CLIENT_ID/SECRET`
- [ ] CRM OAuth: `SALESFORCE_CLIENT_ID/SECRET` (replaces Mailchimp for this live pass)
- [ ] CRM OAuth (existing): `ZOHO_CLIENT_ID/SECRET`, `PIPEDRIVE_CLIENT_ID/SECRET`
- [ ] Confirm native callbacks via `GET /api/integrations/native/env` (no secrets returned)
- [ ] Mailchimp skipped for now (`MAILCHIMP_CLIENT_*` optional / not required)

## Exact OAuth callbacks (must match APP_URL)
Native:
- `https://transovo.ai/api/integrations/native/calendly/callback`
- `https://transovo.ai/api/integrations/native/typeform/callback`
CRM:
- `https://transovo.ai/api/crm/salesforce/callback`
- `https://transovo.ai/api/crm/zoho/callback`
- `https://transovo.ai/api/crm/pipedrive/callback`

## Per-provider
- [ ] Calendly OAuth app + callback + acceptance
- [ ] Typeform OAuth app + scopes + callback + acceptance
- [ ] Salesforce External Client App + callback + CRM acceptance (this pass instead of Mailchimp)
- [ ] ActiveCampaign API URL+key validated
- [ ] WooCommerce HTTPS store + REST keys
- [ ] Jotform API key (+ EU base if needed)
- [ ] Close API key
- [ ] Freshdesk subdomain + API key
- [ ] Klaviyo scoped private key
- [ ] HighLevel PIT + location ID (single location only)
- [ ] Mailchimp deferred (not in this live pass)

## Apply schema before deploy
- [ ] Run `supabase/migrations/20260802_native_integration_safety.sql` (or `db:push`)

## Manual setup order (after code deploy)
1. Calendly OAuth → Coolify → redeploy → connect → acceptance
2. Typeform OAuth → same
3. **Salesforce** CRM OAuth → Coolify `SALESFORCE_CLIENT_ID/SECRET` → redeploy → `/integrations/crm/salesforce` → Connect → diagnostics acceptance
4. Jotform API key (UI) → acceptance
5. Freshdesk subdomain + key → acceptance
6. ActiveCampaign API URL + key → acceptance
7. Klaviyo scoped private key → acceptance
8. WooCommerce store + REST keys → acceptance
9. Close API key → acceptance
10. HighLevel PIT + location ID → acceptance
11. Pipedrive disconnect/reconnect for `deals:full` → deal tests
12. Mailchimp later (optional; not blocking this pass)

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
