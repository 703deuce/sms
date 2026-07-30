# Transovo Product Architecture

**Date:** July 30, 2026  
**Principle:** ~14 campaign categories powered by one workflow/sequence engine — not hundreds of near-duplicate campaigns.

## Campaign library (customer-facing)

| # | Screen title | Category id | Engine |
|---|--------------|-------------|--------|
| 1 | Send an Announcement | `broadcast` | broadcast |
| 2 | Follow Up Automatically | `follow_up` | sequence |
| 3 | Welcome New Contacts | `welcome` | sequence |
| 4 | Send Appointment Reminders | `appointment` | sequence |
| 5 | Reply to Missed Calls or Messages | `missed_call` | automation |
| 6 | Request Reviews or Feedback | `review` | sequence |
| 7 | Nurture New Leads | `lead_nurture` | sequence |
| 8 | Bring Back Past Customers | `win_back` | sequence |
| 9 | Promote an Offer | `promotion` | broadcast |
| 10 | Send Status Updates | `status_update` | automation |
| 11 | Collect Payments | `payment` | sequence |
| 12 | Manage an Event | `event_rsvp` | sequence |
| 13 | Collect Information | `data_collection` | sequence |
| 14 | Build a Custom Workflow | `custom` | automation |

Source of truth: `src/lib/campaigns/catalog.ts`  
Campaign create UI: `/campaigns` → `/campaigns/new/[category]`  
Runtime: `sequenceJson` + `src/lib/campaigns/sequence-*.ts`

## Growth & acquisition

| Tool | Route | Persistence |
|------|-------|-------------|
| Keywords | `/grow/keywords` | `Keyword` + inbound runtime |
| Forms | `/grow/forms`, public `/f/[slug]` | `OptInForm` + `ConsentRecord` |
| QR codes | `/grow/qr-codes` | `QrCode` |
| Click-to-text | `/grow/click-to-text` | `ClickToTextLink` |
| Signup pages / sources | `/grow/pages`, `/grow/sources` | attribution UI |

## Other product pillars

- Contacts / lists / tags / segments — `/contacts/*`
- Shared inbox — `/inbox/*` (+ inbound processor)
- Consent & compliance — `/compliance/*` + messaging registration API
- Workflow builder — `/automations/*` (templates map to the 14 categories)
- Templates / composer — `/templates`, `/send`
- Reporting — `/reports/*`
- Team — `/settings/users` (`Role` enum)
- Integrations / webhooks — `/integrations/*` + inbound enroll API
- Numbers & registration — `/numbers/*` + `/api/messaging/registration`

## MVP vs later

**Launch:** registration, dedicated number, contacts/lists, consent, CSV import UI, forms, keywords, broadcasts, scheduled sends, follow-up sequences, appointment reminders, missed-call replies, review requests, shared inbox, STOP/START/HELP, delivery reporting, webhooks, basic team roles.

**Later:** full drag-drop canvas polish, popups, AI reply, advanced segments, A/B tests, payment-native links, branded contact cards, multilingual AI, ecommerce-native connectors.

## DB migration

Run `supabase/product-library-fields.sql` (and Telnyx fields if not already applied).
