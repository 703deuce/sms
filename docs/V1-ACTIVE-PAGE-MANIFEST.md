# V1 Active Page Manifest

Generated from current code (`src/lib/products/voice-nav.ts`, `src/lib/products/sms-platform-nav.ts`, `src/lib/lead-capture-tabs.ts`, header account menu). Not an old inventory.

Personal / family-number mode is removed from the top menu. The app stays on a **business** workspace and prefers the HP-certified Telnyx DID `+15714073615` for SMS.

## Current active navigation

### Desktop sidebar (`buildVoiceNav` + `buildSmsPlatformNav`, SMS + MCTB entitled)

| Section | Label | Route | Auth | Purpose | Primary APIs | Major actions | Providers | Test status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Dashboard | `/dashboard` | yes | Campaign/SMS overview | `loadMassTextOverviewMetrics`, `/api/workspace` | New campaign, import, lists | Telnyx (sending number) | pending |
| Messaging | Conversations | `/conversations` | yes | SMS inbox | `/api/inbox`, `/api/inbox/[id]` | Search, filter, reply, send | Telnyx SMS | pending |
| Messaging | Campaigns | `/campaigns` | yes | Broadcasts | `/api/campaigns` | Create, draft, schedule, send | Telnyx | pending |
| Messaging | Send | `/send` | yes | Compose & send | `/api/sms/send` | Recipient, body, send now | Telnyx | pending |
| Messaging | AI Composer | `/send/ai` | yes | Draft with AI | `/api/ai/compose` (or send AI route) | Generate, insert | OpenAI | pending |
| Messaging | Message Templates | `/templates` | yes | Reusable copy | `/api/templates` | CRUD, variables | none | pending |
| Messaging | Link Tracking | `/reports/links` | yes | Click tracking | `/api/reports`, `/r/[token]` | Create, copy, analytics | app redirect | pending |
| Contacts | Contacts | `/contacts` | yes | Audience | `/api/contacts` | CRUD, search, opt-out | none | pending |
| Contacts | Imports | `/contacts/imports` | yes | CSV import | `/api/contacts/imports` | Upload, map, import | none | pending |
| Automations | Flows | `/automations` | yes | Automation list | `/api/automations` | Enable/disable | Telnyx (SMS actions) | pending |
| Automations | Automation Templates | `/automations/templates` | yes | Starter flows | `/api/automations` | Use template | none | pending |
| Automations | Flow Builder | `/automations/new` | yes | Visual builder | `/api/automations`, `/api/automations/[id]/test-sms` | Drag, connect, save, test SMS | Telnyx | pending |
| Automations | Run History | `/automations/logs` | yes | Execution log | `/api/automations/[id]/executions` | Filters, retry | none | pending |
| Lead Capture | Keywords | `/grow/keywords` | yes | Inbound keyword | `/api/grow/keywords` | CRUD, STOP/HELP | Telnyx inbound | pending |
| Lead Capture | Forms | `/grow/forms` | yes | Opt-in forms | `/api/grow/forms` | Create, publish, submit | none | pending |
| Lead Capture | Popups & widgets | `/grow/popups` | yes | Embed widgets | `/api/grow/popups` | Create, embed | none | pending |
| Lead Capture | QR Codes | `/grow/qr-codes` | yes | QR destinations | `/api/grow/qr` | Generate, download | none | pending |
| Numbers | Manage Numbers | `/numbers` | yes | Owned DIDs | `/api/numbers` | Details (no release in cert) | Telnyx | pending |
| Numbers | Buy Numbers | `/numbers/buy` | yes | Search inventory | `/api/numbers/search` | Search/quote only — **do not purchase** | Telnyx | skipped (user) |
| Compliance | Compliance | `/compliance` | yes | 10DLC / consent | `/api/compliance` | View status, refresh | Telnyx 10DLC | pending |
| Integrations | Integrations | `/integrations` | yes | Connect apps | `/api/integrations` | Connect/disconnect | OAuth providers | pending |
| Analytics | Analytics | `/analytics` | yes | Messaging analytics | `/api/analytics` | Date range, tabs | none | pending |
| Account | Settings | `/settings` | yes | Workspace settings | `/api/settings` | Save/reload | none | pending |
| Account | Billing | `/settings/billing` | yes | Plan & usage | `/api/billing`, Stripe | Portal (test mode) | Stripe | pending |
| Account | Workspace | `/settings/workspaces` | yes | Workspace profile | `/api/workspace` | Rename, switch | none | pending |
| MCTB | Missed Calls | `/voice/missed-calls` | yes | Missed call log | MCTB APIs | View | Telnyx voice | skipped (user) |
| MCTB | Visual Voicemail | `/voice/voicemail` | yes | Recordings | voicemail APIs | Play | storage | skipped (user) |
| MCTB | Consent Log | `/voice/consent-log` | yes | Press-1 / consent | consent APIs | View | Telnyx | skipped (user) |
| MCTB | Text Back Setup | `/voice/setup` | yes | MCTB config | setup APIs | Save | Telnyx | skipped (user) |
| MCTB | Schedule | `/voice/schedule` | yes | Business hours | schedule APIs | Save | none | skipped (user) |
| MCTB | Business Profile | `/settings/business` | yes | Legal/A2P profile | `/api/settings/business` | Save | none | pending |

### Mobile bottom nav (`buildVoiceMobileNav`)

Dashboard `/dashboard` · Conversations `/conversations` · Campaigns `/campaigns` · Send `/send` · Contacts `/contacts` · Analytics `/analytics` · Missed `/voice/missed-calls` · Visual Voicemail `/voice/voicemail` · Setup `/voice/setup` · More (opens sidebar)

### Header / account menu

- Sending-number dropdown (prefers `+15714073615`)
- Search (contacts/campaigns/messages)
- Notifications
- Help `/getting-started`
- Account Settings `/settings/business`
- Billing `/settings/billing`
- All Transovo Products `/app`
- Sign Out `/api/auth/logout`

Removed: **Personal / Business** top-menu toggle. There is no personal/family-number mode.

### Page-level tabs (still customer-facing under active pages)

- Campaigns: drafts, scheduled, completed, failed, calendar, recurring
- Compliance: business, brand, campaign, readiness, consent, suppression, events
- Settings: messaging, users, notifications, security, branding, data, limits
- Analytics: campaigns, messaging, sources, MCTB

## Out of V1 active nav (do not certify as launch features)

Legacy `/inbox` redirects to `/conversations`. Personal vault (`/personal/**`), number marketplace (`/numbers/premium`), contests, surveys, AI receptionist, and admin (`/admin`) are not V1 sidebar items.

## Controlled live SMS

- From: Telnyx HP-certified `+15714073615`
- To: the user-authorized 571-477 test handset (not committed)
- Do not buy numbers
- Do not submit new A2P applications
- Do not re-test MCTB live call path
