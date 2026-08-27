# Flow Builder — Working Blocks

**Last updated:** integration wiring pass (CRM webhooks → automations, native webhook registration on publish/connect).

Voice / AI call blocks are **hidden** unless `AUTOMATION_VOICE_ENABLED=1`. They are listed at the bottom for reference only.

**Total working blocks (non-voice, default env): 99**

---

## How integration triggers work now

1. Connect the app in **Integrations** (`/integrations`).
2. Drag an integration trigger onto the canvas and configure filters (provider, stage, tag, etc.).
3. **Activate** the flow — Transovo registers webhooks automatically for native apps (Calendly, WooCommerce, Typeform, Jotform, etc.).
4. When the connected app fires an event, the flow enrolls matching contacts and runs.

CRM (Salesforce, Zoho, Pipedrive) triggers fire from **inbound CRM webhooks** (realtime where payload allows) plus **incremental sync** (always enqueued on webhook).

---

## Core triggers (12)

| Block | Works when |
|-------|------------|
| Customer added | Contact created in Transovo |
| Review request created | Review step queued |
| Review request sent | Review SMS sent |
| Review link clicked | Tracking link clicked |
| Review received | Review recorded |
| Positive review received | Positive review recorded |
| Negative feedback received | Negative feedback recorded |
| Customer has not responded | Wait ends without reply (`stopOnReply` flows) |
| Manual enrollment | Test run / manual enroll |
| Scheduled date/time | Cron batch at `runAt` (24h window) |
| Tag added | Tag applied to contact |
| Form submitted | Opt-in form submitted |

---

## Integration triggers — CRM (40)

Requires CRM connected in Integrations. Zoho/Pipedrive: realtime on webhook + sync. Salesforce: sync reconcile (no CDC webhooks).

**Contacts:** CRM contact created, updated, deleted, owner changed, status changed, phone changed, email changed, field changed

**Leads:** CRM lead created, updated, assigned, status changed, source changed, converted, deleted, field changed

**Companies:** CRM company created, updated, owner changed, status changed, deleted, field changed

**Deals:** CRM deal created, updated, stage changed, pipeline changed, owner changed, value changed, won, lost, reopened, deleted, field changed

**Tasks:** CRM task created, updated, assigned, completed, due, overdue

**Activities:** CRM activity created/updated, note created, call logged

---

## Integration triggers — Calendly (10)

Requires Calendly OAuth + webhook registration (auto on connect/activate).

- Calendly booking created / canceled / rescheduled
- Appointment starting soon / completed / no-show
- Event type created / updated / activated / deactivated

---

## Integration triggers — Other apps (9)

| Block | Provider |
|-------|----------|
| Form submitted (app) | Typeform, Jotform |
| Tag added / removed (app) | ActiveCampaign, Mailchimp, HighLevel, Klaviyo |
| List joined (app) | Mailchimp, Klaviyo, ActiveCampaign |
| Order created / paid / status changed / completed | WooCommerce |
| Ticket created / updated / resolved | Freshdesk |
| Consent changed | Mailchimp, Klaviyo |

---

## Actions (14 non-voice)

| Block | Requirement |
|-------|-------------|
| Send SMS | Workspace sending number + credits |
| Send review request | Same as SMS |
| Send email | `BREVO_API_KEY` configured |
| Send internal notification | In-app team notification |
| Add tag / Remove tag | Tag exists |
| Update customer | Contact field |
| Create task | Internal follow-up task |
| Add to automation / Start automation / Remove from automation | Target flow exists |
| Send webhook | Valid URL |
| CRM / connected app action | Provider connected + `enableWrites` |

### Integration action IDs (by provider)

See `INTEGRATION_ACTION_OPTIONS` in `src/lib/automations/catalog.ts` — includes contact/lead/deal upsert, tasks, notes, call/SMS log, tags, lists, tickets, WooCommerce notes, and Calendly appointment APIs.

---

## Logic (8)

| Block | Notes |
|-------|-------|
| Wait for duration | Minutes/hours/days/weeks |
| Wait until date/time | Specific datetime |
| Condition | Review/reply/delivery branches |
| Customer field check | Custom field branch |
| Review status check | Review branch |
| Message status check | Delivery branch |
| Tag check | Has tag branch |
| Has responded check | Reply branch |
| End automation | Terminal node |

---

## Hidden — voice / AI (12 blocks)

Only visible when `AUTOMATION_VOICE_ENABLED=1`:

- Triggers: Inbound Call, Call completed, Missed call, Call qualified, Voicemail detected, Appointment booked, Call transferred
- Actions: Start AI call, Run Voice Agent, Use Agent
- Logic: Call Outcome (`wait_for_call_result`)

---

## Quick test commands

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-sms-gaps.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-integration-wiring.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-e2e.ts
```

---

## App route

Flow Builder: `/automations/[flowId]`

Integrations: `/integrations`
