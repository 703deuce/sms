# Transovo AI — Complete Feature Inventory (All-in-One)

**Generated:** 2026-08-01  
**Live site:** https://transovo.ai  
**Repo tip:** `master` (finish-everything + nav smoke)  
**This file combines:** full platform inventory · earlier nav/walkthrough inventory · campaign & automation detail · launch filter · smoke results

---

## How to read status

| Status | Meaning |
|--------|---------|
| **Full** | Works for normal use (UI + API + persistence). Soft-degrades cleanly when optional keys missing. |
| **Partial** | Exists and partly works; incomplete loop, thin UX, or needs optional keys (Stripe / OpenAI / OAuth / Brevo / VAPID). |
| **Blocked** | Code/UI is there; real value needs a live Telnyx number, A2P/toll-free approval, or live telephony. |
| **Missing** | Claimed in nav/UI but shell, dead, or not hooked up. |

**Carrier note:** Live SMS send, inbound SMS, A2P/TCR submit, and number purchase were intentionally not E2E-tested on carrier until numbers exist.

**Route smoke (live):** **114/114** paths OK (public + authenticated app). Script: `scripts/platform-smoke.mjs`.

---

# PART A — Executive snapshot

### Mostly Full
Dashboard, getting started, contacts (lists/segments/tags/fields/import/export/validation), campaigns build/manage (all 14 types), automations builder, surveys, grow CRUD (keywords/forms/popups/contests/contact cards/click-to-text/sources), AI Voice config surfaces, queues/IVR, numbers inventory/pools/port, compliance drafts, settings (branding/team/2FA/deletion), admin platform, public pages.

### Blocked until Telnyx number + A2P
Outbound SMS (campaigns, automations, quick send, test message), inbound SMS (keywords, contests entry, away auto-reply), live softphone/voice dial/testing lab, brand/campaign TCR submit, SMS OTP opt-in.

### Clear Partial / Missing (non-carrier)
| Item | Status |
|------|--------|
| Voice “Phone numbers” page | **Missing** (shell; assign elsewhere) |
| Zapier | **Missing** (docs/API link only) |
| Reports Messages / Audit “Export CSV” | **Partial** (buttons dead) |
| Media library file upload | **Partial** (URL-only) |
| QR codes | **Partial** (external image; thin pipeline) |
| Stripe / OpenAI / Brevo / VAPID / Google OAuth | **Partial** until keys set |
| Shared inbox live reply | **Partial / Blocked** (assign works; send needs number) |
| PWA web push | **Partial** (needs VAPID) |

---

# PART B — Full platform inventory (latest)

## 1. Core app / shell

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard | Full | Live workspace metrics/actions |
| Getting started checklist | Full | Progress from real setup state; A2P/number steps stay open until carrier |
| Global header search | Full | Contacts, campaigns, conversations |
| In-app notification bell | Full | List / mark read |
| Active “send from” number picker | Full | Persists `activeFromNumberId`; empty until numbers exist |
| PWA (manifest + service worker) | Partial | Assets present; installable; push needs VAPID |
| Web push subscribe API | Partial | Needs VAPID keys |
| Multi-workspace switch / create | Full | |
| Job worker / cron drain | Full | Needs external cron → `/api/jobs/process` + `worker:all` |
| Maintenance mode page | Full | Driven by platform settings / env |

## 2. Messaging / Inbox

| Feature | Status | Notes |
|---------|--------|-------|
| Shared inbox | Partial | Assign/notes/archive work; live reply needs number |
| Assigned to me | Full | |
| Unassigned | Full | |
| Archived | Full | |
| Assign agent / status / notes | Full | |
| @mentions in notes | Full | |
| Agent presence / collision banner | Full | Heartbeat API |
| Saved replies picker | Full | |
| MMS attach on reply | Blocked | Composer works; delivery needs number |
| Translate message | Partial | Heuristic without OpenAI |
| AI inbox assist | Partial | Heuristic without OpenAI |
| Quick send | Blocked | Needs number + messaging ready |
| Test message | Blocked | Needs Telnyx verify-from / messaging ready |
| Media & MMS library | Partial | URL asset CRUD; no file upload |
| Link tracking + `/r/[token]` | Full | Fills when tracked links are sent |
| Text-to-pay links | Partial | CRUD + mock checkout; Stripe for live pay; SMS needs number |
| Templates CRUD | Full | |
| AI campaign composer | Partial | Better with OpenAI |
| AI template generator | Partial | Better with OpenAI |

## 3. Campaign library (14 categories)

Build/manage is Full for each; **outbound send is Blocked** until number + A2P.

| Campaign type | Status | Notes |
|---------------|--------|-------|
| Broadcast / announcement | Full build · Blocked send | One-shot or scheduled |
| Follow-up sequence | Full build · Blocked send | Triggered + delayed until reply/convert |
| Welcome new contacts | Full build · Blocked send | Onboarding sequence |
| Appointment reminders | Partial | C/X confirm/cancel wired; time-based send needs number |
| Missed-call / after-hours reply | Partial | `call.missed` emit wired; SMS needs number |
| Review / feedback request | Partial | Review URL setting; send needs number |
| Lead nurture | Full build · Blocked send | Multi-step qualify/convert |
| Win-back | Full build · Blocked send | Reactivate quiet contacts |
| Promotion / offer | Full build · Blocked send | Discounts, flash sales, etc. |
| Status updates | Full build · Blocked send | Job/order status → message |
| Collect payments / dunning | Partial | `payment_received` stops sequence; SMS needs number |
| Event RSVP | Full build · Blocked send | Invite / RSVP / reminders |
| Collect information | Full build · Blocked send | Questions → contact fields |
| Custom workflow | Full build · Blocked send | Blank trigger → branch canvas |

### Campaign management

| Feature | Status | Notes |
|---------|--------|-------|
| Campaign catalog / create | Full | |
| Drafts / scheduled / calendar / completed / failed | Full | |
| Recurring campaigns | Full schedule · Blocked sends | List picker + recurrence tick job |
| Campaign detail | Full | |
| Activate / pause / resume / cancel | Full | |
| Sender pool selection on send | Full | Needs numbers in pool |
| Daily / workspace send limits | Full | Enforced in send path |
| Sequence engine (waits, conditions, gates) | Partial | Core works; some gates need live events |

## 4. Contacts

| Feature | Status | Notes |
|---------|--------|-------|
| All contacts + detail | Full | Verified CRUD on live |
| Lists | Full | Verified |
| Segments + condition builder + preview | Full | Verified |
| Tags | Full | Verified |
| Custom fields | Full | |
| CSV import | Full | Consent + audit |
| CSV export | Full | |
| List validation / cleanup job | Full | |
| Telnyx number lookup | Partial | Optional when Telnyx keyed |
| Unsubscribed view | Full | |
| Blocked view | Full | |
| Invalid numbers view | Full | |

## 5. Automations

### Builder surfaces

| Feature | Status | Notes |
|---------|--------|-------|
| Flows list / CRUD | Full | |
| Templates (category picker) | Full | |
| Visual builder | Full | Create + edit persist |
| Execution logs | Full | |

### Triggers

| Trigger | Status |
|---------|--------|
| Customer added | Full (non-SMS path) |
| Form submitted | Full |
| Tag added | Full |
| Manual enrollment | Full |
| Scheduled date/time | Full / Partial |
| Review request created / sent / clicked / received | Partial |
| Positive review / negative feedback | Partial |
| Customer has not responded | Partial |
| Call completed / qualified | Partial |
| Voicemail detected | Partial |
| Appointment booked | Partial |

### Actions

| Action | Status |
|--------|--------|
| Send SMS | Blocked |
| Send review request | Blocked (SMS) |
| Send email | Partial — needs Brevo |
| Send internal notification | Full / Partial |
| Add / remove tag | Full |
| Update customer | Full |
| Create task | Partial |
| Add / remove from automation | Full |
| Send webhook | Full |
| End automation | Full |

### Logic

| Block | Status |
|-------|--------|
| Wait for duration | Full |
| Wait until date/time | Full |
| Condition / field / tag / review / message / response checks | Full / Partial |

## 6. Surveys

| Feature | Status | Notes |
|---------|--------|-------|
| Surveys CRUD | Full | Verified |
| Polls filter | Full | |
| NPS filter | Full | |
| Survey detail / responses | Full | Readable answers UI |
| Public survey `/s/[slug]` | Full | |

## 7. Grow

| Feature | Status | Notes |
|---------|--------|-------|
| Keywords (+ start campaign) | Full CRUD · Blocked inbound | Verified create |
| Opt-in forms | Full | Editor + public |
| Public form `/f/[slug]` | Full | |
| Embed form `/embed/f/[slug]` | Full | |
| Popups & widgets | Full | Form link, exit-intent, popup/slide-in |
| Embed widget `/embed/w/[slug]` | Full | |
| Signup pages | Full | Hosted forms list + metrics |
| QR codes | Partial | External QR image; not full scan pipeline |
| Click-to-text | Full | `sms:` link CRUD |
| Contests (create / activate / entries / draw) | Full CRUD · Blocked SMS entry | Verified on live |
| Contact cards (vCard) | Full | Public vCard URL |
| Attach contact card to welcome MMS | Blocked | Flag exists; send needs number |
| Sources attribution | Full | |

## 8. AI Voice

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | Full | |
| Agents list + builder | Full | Config CRUD |
| Agent templates (receptionist / lead qualify / booking) | Full | |
| Knowledge bases + ingest job | Full | |
| Tools CRUD | Full | |
| Tool: webhook | Partial | Live on calls needs Telnyx |
| Tool: send_sms | Blocked | |
| Tool: transfer_call | Partial / Blocked | |
| Tool: book_appointment | Partial | |
| Tool: start_automation | Partial | |
| Calendars | Partial | Internal OK; Google/MS need OAuth |
| Services & staff CRUD | Full | |
| Testing lab | Blocked | Needs caller ID number |
| Voice phone numbers page | Missing | Shell; assign elsewhere |
| Inbound routing + simulate | Full | |
| Outbound voice campaigns | Blocked | Live dial needs Telnyx + number |
| Calls list | Full | |
| Call detail + recording player | Full | When recordings exist |
| Transcript UI | Full | |
| Post-call insights | Partial | OpenAI if keyed; else heuristics |
| Conversations | Full | |
| Analytics | Full | |
| Usage & billing | Full | Read model |
| Settings (emergency stop) | Full | |
| Appointment book → reminder enroll | Partial | |

## 9. Phone (human softphone)

| Feature | Status | Notes |
|---------|--------|-------|
| Softphone dialer | Blocked | UI + mock/WebRTC; live needs number + Telnyx |
| WebRTC token API | Partial | Needs Telnyx telephony credentials |
| Hold / mute | Partial | Depends on live Call Control |
| Disposition | Full / Partial | Can trigger missed-call automations |
| Call history | Full | |
| Recording playback on human calls | Full | When URL present |
| Queues (ring all / RR / idle / linear, overflow) | Full | Verified CRUD |
| IVR menus (DTMF → queue/forward/voicemail/agent) | Full | Verified CRUD |
| Phone settings / default caller ID | Full | |
| Missed-call → automation emit | Partial | Emit works; SMS follow-up blocked |

## 10. Numbers

| Feature | Status | Notes |
|---------|--------|-------|
| Number inventory | Full | Empty until purchase |
| Buy number (search + city/state/capabilities) | Partial | Live buy needs Telnyx |
| Port-in request | Full | Persisted ticket |
| Number detail: friendly name | Full | |
| Number detail: messaging / webhook settings | Full | |
| Number detail: voice forward | Full | Persist (+ Telnyx when keyed) |
| Number detail: user assignments | Full | |
| Number detail: compliance status display | Full | From registration |
| Sender pools CRUD | Full | |
| Round-robin pool on campaign/quick send | Full | Needs numbers in pool |

## 11. Compliance

| Feature | Status | Notes |
|---------|--------|-------|
| Overview / readiness dashboard | Full | |
| Business profile | Full | Draft save |
| Brand registration form | Full draft · Blocked submit | Editable; TCR submit needs Telnyx |
| Campaign registration form | Full draft · Blocked submit | Opt keywords + TCR attrs saved |
| Registration readiness check | Full | |
| Consent records | Full | |
| Suppression list | Full | |
| Compliance events log | Full | |
| Custom STOP / START / HELP keywords | Full | Drive inbound handling |
| Privacy policy + TCR attributes | Full | Saved on registration |

## 12. Messaging runtime settings

| Feature | Status | Notes |
|---------|--------|-------|
| Away message / enable / always-away | Full config · Blocked send | Inbound auto-reply needs number |
| Business hours | Full | |
| Quiet hours + timezone | Full | |
| Review link URL | Full | Used by review campaigns / `{{review_link}}` |
| Email-to-SMS aliases | Full | Verified create |
| Public email-to-SMS inbound webhook | Full | Needs mail routed to webhook |

## 13. Integrations

| Feature | Status | Notes |
|---------|--------|-------|
| API keys | Full | |
| Outbound webhooks | Full | |
| Incoming automation webhooks | Full | |
| Developer logs | Full | |
| Stripe (billing + text-to-pay) | Partial | Needs `STRIPE_*` |
| HubSpot | Partial | API key + webhook + sync when keyed |
| CRM Framework (Salesforce / Zoho / Pipedrive) | Partial | OAuth adapters + sync/push jobs; needs provider app credentials |
| Salesforce (legacy token) | Partial | Token + sync when keyed |
| Shopify | Partial | Admin token + sync when keyed |
| Calendly | Partial | Webhook + signing key |
| Google Contacts | Partial | OAuth + sync |
| Google Sheets | Partial | OAuth + spreadsheet ID + sync |
| Zapier | Missing | Links to API docs only; CRM framework reduces need for normal Voice/SMS sync |

## 14. Settings / Auth / Billing

| Feature | Status | Notes |
|---------|--------|-------|
| Business settings | Full | |
| Branding (logo, colors, short-link domain, theme, review URL) | Full | Verified |
| Messaging settings (see §12) | Full | |
| Email-to-SMS | Full | |
| Users & roles | Full | |
| Team invites + accept page `/invite/[token]` | Full | Email via Brevo or console fallback |
| Workspaces | Full | |
| Notifications prefs | Partial | Prefs + digest job; email/push need Brevo/VAPID |
| Notification digests job | Partial | |
| Billing / credit ledger | Partial | Mock credits OK; Stripe for real checkout/portal |
| Stripe webhook (credits, subs, payment links) | Partial | Needs Stripe webhook secret |
| Usage limits | Full | Enforced |
| Security: password change | Full | |
| Security: TOTP 2FA | Full | |
| Security: sessions | Full / Partial | |
| Data export | Full | |
| Data retention prefs | Full | |
| Account / workspace deletion request | Full | |
| Login / signup / logout | Full | Smoke-tested |
| SMS opt-in OTP (`/sms-opt-in`) | Blocked | Needs Telnyx verify-from |

## 15. Reports

| Feature | Status | Notes |
|---------|--------|-------|
| Overview | Full | |
| Campaigns | Full | |
| Messages | Partial | Stats live; Export CSV button dead |
| Contacts growth | Full | |
| Inbox | Full | |
| Automations | Full | |
| Links | Full | |
| Usage & cost | Full | |
| Audit log | Partial | Rows live; Export button dead |

## 16. Admin (platform)

| Feature | Status | Notes |
|---------|--------|-------|
| Admin dashboard | Full | |
| Customers list + detail | Full | |
| A2P queue view | Full | Customer TCR submit still Blocked |
| Message monitoring | Full | |
| Platform numbers | Full | |
| Platform billing | Full | Telnyx-labeled |
| Support tickets | Full | Create/list |
| System logs | Full | |
| Platform settings (plans, flags, trial, maintenance) | Full | Runtime flags/maintenance/trial used |
| Admin search | Full | Customers, users, tickets |
| Admin support bell | Full | Open ticket indicator |

## 17. Public / marketing

| Feature | Status | Notes |
|---------|--------|-------|
| Landing page | Full | |
| Privacy / Terms / Acceptable use / Contact | Full | |
| Public forms / widgets / surveys | Full | |
| Public contact-card vCard | Full | |
| Mock payment checkout (no Stripe) | Full | Marks paid + stops dunning |

## 18. Background jobs

| Job | Status | Notes |
|-----|--------|-------|
| `messaging_registration_advance` | Blocked / Partial | Needs Telnyx for real advance |
| `campaign_send_batch` / `send_campaign_sms` | Blocked | Needs number |
| `send_campaign_email` | Partial | Needs Brevo |
| `automation_advance` / tick / batch | Full / Blocked | SMS steps blocked |
| `campaign_recurrence_tick` | Full | |
| `list_cleanup` | Full | |
| `notification_digest` | Partial | |
| Voice webhook / post-call / campaign / recording / tools / knowledge | Partial / Blocked | Live voice needs Telnyx |

---

# PART C — Earlier nav rollup inventory (from platform walkthrough)

Included for completeness — same product, coarser page-level pass before the deep feature audit.

### Messaging
| Page / feature | Status |
|----------------|--------|
| Inbox (shared) | Partial (live reply Blocked) |
| Inbox · Assigned to me | Full |
| Inbox · Unassigned | Full |
| Inbox · Archived | Full |
| Campaigns (all list views) | Full build · Blocked send |
| Campaign drafts / scheduled / calendar / completed / failed | Full |
| Recurring campaigns | Full schedule · Blocked send |
| Media & MMS | Partial (URL only) |
| Link clicks / tracking | Full |
| Text-to-pay | Partial |
| Templates | Full |
| AI Composer | Partial |

### Contacts
| Page | Status |
|------|--------|
| All / detail | Full |
| Lists / Segments / Tags / Fields | Full |
| Imports / Validation | Full |
| Unsubscribed / Blocked / Invalid | Full |

### Automations
| Page | Status |
|------|--------|
| Flows / Templates / Builder / Logs | Full (SMS actions Blocked) |

### Surveys
| Page | Status |
|------|--------|
| All / Polls / NPS / Detail | Full |

### Grow
| Page | Status |
|------|--------|
| Keywords | Full CRUD · Blocked inbound |
| Forms / Popups / Signup pages | Full |
| QR codes | Partial |
| Click-to-text | Full |
| Contests | Full CRUD · Blocked SMS entry |
| Contact cards | Full |
| Sources | Full |

### AI Voice (14 pages)
| Page | Status |
|------|--------|
| Overview, Agents, Builder, Templates, Knowledge, Tools | Full / Partial (live call Blocked) |
| Calendars / Services | Partial / Full |
| Testing lab | Blocked |
| Phone numbers (voice) | **Missing** shell |
| Routing / Campaigns / Calls / Conversations / Analytics / Usage / Settings | Full / Blocked dial |

### Phone
| Page | Status |
|------|--------|
| Softphone | Blocked (live) |
| History | Full |
| Queues / IVR | Full |
| Settings | Full |

### Numbers / Compliance / Integrations / Settings / Reports / Admin
Covered in Part B with the same conclusions; walkthrough found **no 404s** after nav smoke fixes (Email-to-SMS, Invalid, Recurring, inbox mine/unassigned tabs reachable via shared tab helpers).

---

# PART D — Launch filter (actionable)

### Must have numbers / A2P first (Blocked — expected)
- Quick send, test message
- Campaign / automation SMS
- Inbound keywords, contests, away replies
- Live softphone / voice dial / testing lab
- Brand / campaign TCR submit
- SMS OTP (`/sms-opt-in`)

### Worth fixing before marketing as “fully done” (Partial / Missing)
1. Voice phone numbers page (Missing shell)  
2. Zapier (Missing)  
3. Reports CSV export buttons (dead)  
4. Media file upload (URL-only)  
5. QR first-party pipeline (thin)  
6. Wire optional provider keys: Stripe, OpenAI, Brevo, VAPID, Google OAuth  
7. Appointment time-based reminder loop polish  

### Ops still required for greenfield / schema
- `npm run db:push` (or apply `supabase/finish-everything-fields.sql`) + grants / `NOTIFY pgrst` on Supabase  
- Coolify env: `DATABASE_URL`, Telnyx keys, optional Stripe/OpenAI/Brevo/VAPID  
- External cron → job drain (`/api/jobs/process` or `worker:all`)  
- Telnyx messaging + voice webhooks pointed at production  

---

# PART E — Live smoke results summary

**Base URL:** https://transovo.ai  
**Result:** **114/114 OK** (0 failures)  
**Auth:** smoke user signed in successfully  
**Skipped on purpose:** A2P submit, live number buy, live SMS send/inbound  

### Public (sampled)
`/`, `/login`, `/signup`, `/privacy`, `/terms`, `/acceptable-use`, `/contact`, `/sms-opt-in` — all 200

### App areas covered by smoke
Dashboard, Getting started, Messaging (inbox variants, campaigns, media, links, text-to-pay, templates, AI), Contacts (all secondary views), Automations, Surveys, Grow, AI Voice suite, Phone, Numbers, Compliance, Integrations, Settings (including Email-to-SMS, Branding, Security, Billing, Data), Reports, Admin suite.

**Artifact:** `/opt/cursor/artifacts/platform-smoke-report.json`  
**Re-run:** `BASE_URL=https://transovo.ai node scripts/platform-smoke.mjs`

### Verified CRUD examples on live (post-deploy)
Contacts, tags, lists, segments, keywords, contests, popups, contact cards, email-to-SMS, queues, IVR, branding, surveys, messaging settings.

---

# PART F — What shipped in the finish-everything wave (context)

Not a status table — background on what the inventory reflects:

- **Billing:** Stripe checkout/portal/webhook, credits, subscriptions, entitlements, daily-cap, per-send credit deduction, `payment_received` gate  
- **Team/security:** Invites + `/invite/[token]`, TOTP 2FA, account deletion, branding, in-app notifications + digest, header search + active from-number  
- **Numbers/send:** Detail tabs, assignments, buy filters, sender-pool round-robin  
- **Grow/campaigns/contacts:** Contests, pages/popups/keywords campaigns, contact-card MMS/vCard, segment conditions, recurrence, missed-call emit, appointment C/X, review-link resolver  
- **Phone/voice:** Queues, IVR, softphone polish, transcript UI, calendar booking + services/staff, integrations connectors  
- **Admin:** Platform settings persist + runtime flags/maintenance/trial, support tickets, admin search, Telnyx labeling  
- **Nav polish:** Shared settings/contact/campaign tabs so Email-to-SMS / Invalid / Recurring / inbox mine/unassigned are reachable  
- **Schema:** `prisma/schema.prisma` + `supabase/finish-everything-fields.sql`  
- **Docs:** README + `docs/TELNYX_MIGRATION.md` + `docs/DATABASE.md` aligned  

---

# PART G — Nav map (quick reference)

- **Messaging** → Inbox, Campaigns, Media, Links, Text-to-pay, Templates, AI Composer  
- **Contacts** → All, Lists, Segments, Tags, Fields, Imports, Validation, Unsubscribed, Blocked, Invalid  
- **Automations** → Flows, Templates, Builder, Logs  
- **Surveys** → All, Polls, NPS  
- **Grow** → Keywords, Forms, Popups, Signup pages, QR, Click-to-text, Contests, Contact cards, Sources  
- **AI Voice** → Overview through Settings (14 pages)  
- **Phone** → Softphone, History, Queues, IVR, Settings  
- **Numbers** → Inventory, Buy, Port, Pools  
- **Compliance** → Overview through Events  
- **Integrations** → Directory, API, Webhooks, Logs  
- **Settings** → Business through Data  
- **Reports** → Overview through Audit  
- **Admin** → Dashboard through Platform Settings  

---

*End of combined inventory. Canonical copy in repo: `docs/FEATURE_INVENTORY.md`.*
