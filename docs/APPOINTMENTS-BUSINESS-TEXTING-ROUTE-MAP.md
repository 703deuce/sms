# Appointments Business Texting — Route Map

## Canonical Appointments routes (customer-facing)

| Route | Purpose | Implementation |
|-------|---------|----------------|
| `/contacts` | Contact list | Existing Kimi Contacts |
| `/contacts/segments` | Segments | Existing |
| `/contacts/imports` | CSV import | Existing |
| `/contacts/fields` | Custom fields | Existing |
| `/conversations` | Inbox | Existing |
| `/appointments/campaigns` | Campaign list | `KimiCampaignsConnected` |
| `/appointments/campaigns/drafts` | Draft filter | `CampaignsFilteredPage` |
| `/appointments/campaigns/scheduled` | Scheduled filter | `CampaignsFilteredPage` |
| `/appointments/campaigns/completed` | Completed filter | `CampaignsFilteredPage` |
| `/appointments/campaigns/failed` | Failed filter | `CampaignsFilteredPage` |
| `/appointments/campaigns/new` | Create | `KimiCampaignsConnected` create |
| `/appointments/campaigns/new/review` | Review / launch | `KimiCampaignsConnected` review |
| `/appointments/campaigns/[id]` | Detail / results | `CampaignDetailView` / `CampaignResultsView` |
| `/settings/messaging` | Business Texting registration | `MessagingSettingsConnected` |

## Legacy routes (preserved, not in Appointments nav)

| Legacy | Canonical | Shared component | Shared backend | Retirement |
|--------|-----------|------------------|----------------|------------|
| `/campaigns` | `/appointments/campaigns` | Yes | Yes | After equivalence QA |
| `/campaigns/new` | `/appointments/campaigns/new` | Yes | Yes | After equivalence QA |
| `/campaigns/new/review` | `/appointments/campaigns/new/review` | Yes | Yes | After equivalence QA |
| `/campaigns/[id]` | `/appointments/campaigns/[id]` | Yes | Yes | After equivalence QA |
| `/campaigns/drafts` | `/appointments/campaigns/drafts` | Yes | Yes | After equivalence QA |
| `/dashboard` | — | — | — | DO_NOT_BRING_BACK |
| `/send` | Inbox + Contact detail | — | `/api/sms/send` | DO_NOT_BRING_BACK (nav) |
| `/grow/*` | — | — | — | Hidden |
| `/automations/drip-campaigns` | — | — | — | Hidden |
| `/playbooks` | — | — | — | Hidden |
| `/voice/campaigns` | — | — | — | Dead / voice-only |

## API routes (unchanged — shared backend)

| API | Used by |
|-----|---------|
| `/api/mass-texting/campaigns` | List, create, update |
| `/api/mass-texting/campaigns/[id]/launch` | Send / schedule |
| `/api/mass-texting/campaigns/[id]/launch-review` | Review |
| `/api/mass-texting/campaigns/audience-preview` | Audience counts |
| `/api/contacts/**` | Contacts, import |
| `/api/inbox/**` | Inbox |
| `/api/appointments/business-texting/status` | Sender gate (new) |
| `/api/messaging/registration` | Settings activation |

## Shell resolution

| Path prefix | Product shell |
|-------------|---------------|
| `/appointments/campaigns` | `appointments` |
| `/campaigns` | `mass_sms` (legacy) |
| `/contacts`, `/conversations` | `appointments` (shared) |

## Nav flags

| Flag | Value |
|------|-------|
| `BUSINESS_TEXTING_CAMPAIGNS_IN_V1_NAV` | `true` |
| `MASS_MESSAGING_IN_V1_NAV` | `false` |
