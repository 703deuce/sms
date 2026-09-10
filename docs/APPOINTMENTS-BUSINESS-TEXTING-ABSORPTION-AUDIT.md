# Appointments Business Texting Absorption Audit

**Generated:** 2026-09-10  
**Updated:** 2026-09-10 (Business Texting Phase 1 — approved scope expansion)  
**Type:** Discovery / inventory + implementation tracking  
**Scope:** Old SMS / Mass Texting product surfaces relevant to absorbing **Business Texting** into Appointments

## Executive summary

Transovo’s legacy **SMS / Mass Texting** product is a full marketing + operations stack. **Product decision (2026-09-10):** Appointments V1 now includes a **lightweight Business Texting layer** — selectively absorbing Campaigns + shared Contacts/Inbox into Appointments. This is **not** restoring the old standalone SMS product shell.

| Flag | Value | Meaning |
|------|-------|---------|
| `MASS_MESSAGING_IN_V1_NAV` | `false` | Old SMS sidebar (Dashboard, Grow, Drips, etc.) stays hidden |
| `BUSINESS_TEXTING_CAMPAIGNS_IN_V1_NAV` | `true` | Campaigns under Messages → `/appointments/campaigns` |

**Final certification is paused** until absorption completes — see `docs/APPOINTMENTS-BUSINESS-TEXTING-CERTIFICATION-PAUSE.md`.

Appointments **reuses shared layers**:

| Capability | Appointments canonical | Legacy SMS source | Absorption tag |
|------------|------------------------|-------------------|----------------|
| Contacts | `/contacts` (+ Segments, Import, Fields) | Same `Contact` model | `REUSE_AS_IS` / absorb gaps only |
| Inbox | `/conversations` | Same `Conversation` | `REUSE_AS_IS` |
| **Campaigns** | **`/appointments/campaigns`** | `/campaigns` (preserved) | **`RESTYLE_AND_REUSE`** |
| Reminder SMS | `reminder-delivery.ts` | `src/lib/messaging/*` | `SHARED_INFRA_ONLY` |
| Templates | `/appointments/automations/templates` (preferred) | `/templates` | `MERGE_WITH_EXISTING` — audit |
| Messaging setup | Settings → Messaging | A2P / sender registration | `ABSORB_INTO_APPOINTMENTS` |
| Recall campaigns | `/appointments/recall-campaigns` | Campaign send infra | `SHARED_INFRA_ONLY` |

**Do not restore:** SMS Dashboard, Send, Grow, Drips, Playbooks, standalone Reports, standalone Phone Numbers / Compliance nav, MCTB, Smart Routing, AI Receptionist.

### Reuse recommendation legend

| Tag | Meaning |
|-----|---------|
| `REUSE_AS_IS` | Keep route, UI, and backend; wire into Appointments shell only if needed |
| `RESTYLE_AND_REUSE` | Keep APIs/runtime; re-skin under Appointments design system |
| `ABSORB_INTO_APPOINTMENTS` | Move IA home under `/appointments/*`; same engines |
| `SHARED_INFRA_ONLY` | Use lib/API/workers only; new Appointments UI |
| `HIDE_PRESERVE` | Not in V1 nav; do not delete |
| `CONSOLIDATE` | Merge duplicate UIs into one canonical home |
| `DO_NOT_MERGE` | Hard product boundary (e.g. MCTB voice path, mass marketing compliance) |

---

## 1. Navigation / sidebar

### Key config files

| File | Role | Recommendation |
|------|------|----------------|
| `src/lib/products/v1-launch-nav.ts` | V1 flags: `MASS_MESSAGING_IN_V1_NAV=false`, `CONTACTS_IN_V1_NAV=true`, `CONVERSATIONS_IN_V1_NAV=true` | `REUSE_AS_IS` — single source for launch gating |
| `src/lib/products/appointments-nav.ts` | Appointments sidebar: Home, Booking, Calendar, **Contacts**, **Messages** (`/conversations`), Reminders, Settings (incl. Messaging) | `REUSE_AS_IS` — absorption target nav |
| `src/lib/products/sms-platform-nav.ts` | Full Mass SMS nav: Dashboard, Conversations, Campaigns, Analytics, Audience (contacts/lists/segments), List Growth, Drip, Playbooks, Auto/AI Replies | `HIDE_PRESERVE` — reference for hidden product |
| `src/lib/products/sms-nav.ts` | Older ~10-item SMS nav (Dashboard, Inbox, Campaigns, …) | `HIDE_PRESERVE` — superseded by `sms-platform-nav` |
| `src/lib/products/mass-text-nav.ts` | Deprecated alias → `buildSmsPlatformNav` | `HIDE_PRESERVE` |
| `src/lib/products/sms-routes.ts` | SMS shell route prefixes, deep routes, create actions | `SHARED_INFRA_ONLY` — route guards / shell detection |
| `src/lib/products/product-shell.ts` | Product switcher shells; `mass_sms` prefixes: `/campaigns`, `/grow`, `/automations`, … | `REUSE_AS_IS` — shell resolution |
| `src/components/layout/sidebar.tsx` | Chooses nav: `buildAppointmentsV1Nav` vs `buildSmsPlatformNav` by product shell | `REUSE_AS_IS` |
| `src/lib/products/access-guards.ts` | `/conversations` shared if `hasVoice \|\| hasSms` | `REUSE_AS_IS` |
| `src/lib/products/paths.ts` | `isSmsProductPath`, offer paths (`/mass-texting`) | `SHARED_INFRA_ONLY` |

### Nav comparison (Appointments V1 vs hidden Mass SMS)

| Appointments V1 (visible) | Mass SMS (hidden, preserved) |
|---------------------------|------------------------------|
| `/contacts` | `/contacts`, `/contacts/lists`, `/contacts/segments` |
| `/conversations` (Messages) | `/conversations` |
| `/appointments/reminders` | — |
| `/appointments/automations/templates` | `/templates`, `/automations/templates` |
| Settings → `/settings/messaging` | `/sms/compliance`, `/compliance/*` |
| `/appointments/recall-campaigns` | `/campaigns` (broadcast) |

**Implemented (Phase 1 start):** `appointments-nav.ts` — Messages → Inbox + Campaigns (`/appointments/campaigns`). Contacts children: Contacts, Segments, Import, Fields. Flag: `BUSINESS_TEXTING_CAMPAIGNS_IN_V1_NAV`. Route helpers: `src/lib/products/business-texting-routes.ts`.

---

## 2. Routes

### Mass SMS / marketing route inventory

#### Campaigns (`/campaigns`)

| Route | Page | Recommendation |
|-------|------|----------------|
| `/appointments/campaigns` | List (canonical Appointments home) | **`RESTYLE_AND_REUSE`** — Messages nav entry |
| `/appointments/campaigns/*` | Mirrors legacy campaign sub-routes | **`RESTYLE_AND_REUSE`** — inherits Appointments layout/theme |
| `/campaigns` | List (legacy) | `BACKEND_ONLY_REUSE` — preserved until equivalence proven; not canonical nav |
| `/campaigns/all`, `/drafts`, … | Status filters | `BACKEND_ONLY_REUSE` — legacy paths |
| `/campaigns/new`, `/campaigns/new/review`, … | Create flow | `RESTYLE_AND_REUSE` — shared Kimi components + `business-texting-routes` |
| `/campaigns/[campaignId]` | Detail / results | `RESTYLE_AND_REUSE` |
| `/voice/campaigns` | Legacy voice campaigns | `DO_NOT_BRING_BACK` |

#### Contacts (`/contacts`)

| Route | Recommendation |
|-------|----------------|
| `/contacts` | `REUSE_AS_IS` — shared with Appointments |
| `/contacts/[id]` | `RESTYLE_AND_REUSE` — Kimi detail + appointments panel |
| `/contacts/lists`, `/contacts/lists/new`, `/contacts/lists/create` | `ABSORB_INTO_APPOINTMENTS` — link from Contacts subnav |
| `/contacts/segments` | `ABSORB_INTO_APPOINTMENTS` — + appointment presets |
| `/contacts/imports` | `ABSORB_INTO_APPOINTMENTS` |
| `/contacts/tags`, `/contacts/fields`, `/contacts/blocked`, `/contacts/unsubscribed`, `/contacts/invalid`, `/contacts/validation`, `/contacts/create` | `RESTYLE_AND_REUSE` |

#### Conversations / inbox

| Route | Recommendation |
|-------|----------------|
| `/conversations` | `REUSE_AS_IS` — Appointments “Messages” |
| `/conversations/saved-replies` | `RESTYLE_AND_REUSE` |
| `/mctb/conversations` | `DO_NOT_MERGE` — MCTB filter context |
| `/voice/conversations` | Legacy redirect |

#### Automations

| Route | Recommendation |
|-------|----------------|
| `/automations` | `HIDE_PRESERVE` — workflow builder |
| `/automations/new`, `/automations/[flowId]`, `/automations/[flowId]/edit` | `HIDE_PRESERVE` |
| `/automations/templates` | `CONSOLIDATE` vs `/appointments/automations/templates` |
| `/automations/drip-campaigns`, `/automations/drip-campaigns/new`, `/automations/drip-campaigns/[id]` | `HIDE_PRESERVE` |
| `/automations/logs` | `HIDE_PRESERVE` |
| `/appointments/automations/recall`, `/no-show`, `/activity` | `REUSE_AS_IS` — Appointments automations |

#### Grow (list growth)

| Route | Recommendation |
|-------|----------------|
| `/grow/keywords`, `/grow/forms`, `/grow/forms/[id]`, `/grow/qr-codes`, `/grow/tap-to-join`, `/grow/tap-to-join/[id]`, `/grow/click-to-text`, `/grow/popups`, `/grow/pages`, `/grow/contests`, `/grow/contact-cards`, `/grow/sources` | `HIDE_PRESERVE` — marketing opt-in |

#### Messaging utilities

| Route | Recommendation |
|-------|----------------|
| `/messaging/media` | `RESTYLE_AND_REUSE` — MMS library |
| `/messaging/links` | `HIDE_PRESERVE` |
| `/messaging/payments` | `HIDE_PRESERVE` |
| `/send`, `/send/quick`, `/send/ai`, `/send/test` | `ABSORB_INTO_APPOINTMENTS` — quick 1:1 from contact/thread |
| `/templates`, `/templates/new`, `/templates/ai` | `CONSOLIDATE` — distinguish marketing vs appointment templates |

#### SMS product shell

| Route | Recommendation |
|-------|----------------|
| `/sms/dashboard`, `/sms/analytics`, `/sms/compliance`, `/sms/settings` | `HIDE_PRESERVE` |
| `/reports/*` | `HIDE_PRESERVE` — SMS analytics reports |

#### Other preserved SMS surfaces

| Route | Recommendation |
|-------|----------------|
| `/playbooks` | `HIDE_PRESERVE` |
| `/auto-replies`, `/auto-replies/new`, `/auto-replies/[id]` | `HIDE_PRESERVE` |
| `/ai-replies`, `/ai-replies/new`, `/ai-replies/[id]` | `HIDE_PRESERVE` |
| `/compliance/*` | `SHARED_INFRA_ONLY` — link from Settings → Messaging |
| `/numbers` | Shared platform (not SMS-only) |

### Appointments business texting routes (absorption targets)

| Route | Role |
|-------|------|
| `/appointments/reminders` | Reminder sequences (SMS/email) |
| `/appointments/automations/templates` | Appointment message templates |
| `/appointments/automations/recall`, `/no-show` | Lifecycle automations |
| `/appointments/recall-campaigns` | Recall campaign UI |
| `/settings/messaging` | A2P / sender registration |

---

## 3. Contacts

### Architecture

**Single canonical `Contact` model** (`prisma/schema.prisma`) — **not** separate SMS vs Appointments tables.

| Layer | Path | Recommendation |
|-------|------|----------------|
| List UI | `src/app/(app)/contacts/page.tsx` → `KimiContactsConnected` | `RESTYLE_AND_REUSE` |
| Detail UI | `src/app/(app)/contacts/[id]/page.tsx` → `src/features/contacts/kimi/contact-detail/contact-detail-connected.tsx` | `RESTYLE_AND_REUSE` |
| Kimi presentation | `src/components/contacts/kimi-ui/contact-detail/*` | `RESTYLE_AND_REUSE` (glue only per `MASS_TEXTING_GLUE_FLOWS.md`) |
| Appointments panel | `src/components/contacts/kimi-ui/contact-detail/components/ContactAppointmentsPanel.tsx`, `src/components/contacts/contact-booking-actions.tsx` | `REUSE_AS_IS` |
| Adapters | `src/lib/contacts/kimi-contacts-adapter.ts`, `kimi-lists-adapter.ts`, `kimi-segments-adapter.ts` | `REUSE_AS_IS` |
| Segment query | `src/lib/contacts/segment-query.ts` | `SHARED_INFRA_ONLY` |
| Appointment segment presets | `src/components/contacts/appointment-segment-presets-panel.tsx` → `/api/appointments/service-booking/appointment-segments` | `ABSORB_INTO_APPOINTMENTS` |
| Commerce contact merge | `/appointments/commerce/contact-merge` | `REUSE_AS_IS` |

### APIs

| API | Purpose |
|-----|---------|
| `src/app/api/contacts/route.ts` | CRUD list |
| `src/app/api/contacts/[id]/route.ts` | Detail/update |
| `src/app/api/contacts/lists/route.ts` | Lists |
| `src/app/api/contacts/segments/route.ts` | Segments CRUD |
| `src/app/api/contacts/segments/preview/route.ts` | Segment preview |
| `src/app/api/contacts/import/route.ts` | CSV import |
| `src/app/api/contacts/export/route.ts` | Export |
| `src/app/api/contacts/tags/route.ts`, `fields/route.ts`, `validate/route.ts`, `cleanup/route.ts` | Supporting |

**SMS vs Appointments:** Same contacts home (`/contacts`). Appointments adds **booking context** on detail and **appointment-aware segments** — no forked CRM.

**Recommendation:** `CONSOLIDATE` under Appointments nav; expose Lists/Segments/Import as Contacts children; keep all APIs `REUSE_AS_IS`.

---

## 4. Campaigns

### UI components

| Path | Role | Recommendation |
|------|------|----------------|
| `src/components/campaigns/kimi-campaigns-connected.tsx` | List shell / glue | `HIDE_PRESERVE` (mass) |
| `src/components/campaigns/broadcast/campaign-compose.tsx` | Broadcast builder | `HIDE_PRESERVE` |
| `src/components/campaigns/broadcast/campaign-review.tsx` | Pre-send review | `SHARED_INFRA_ONLY` — patterns for recall |
| `src/components/campaigns/broadcast/campaign-results.tsx` | Results tabs | `SHARED_INFRA_ONLY` |
| `src/components/campaigns/campaign-detail-view.tsx` | Detail | `HIDE_PRESERVE` |
| `src/components/kimi/campaigns/*` | Kimi look (do not edit for backend) | `HIDE_PRESERVE` |
| `src/components/appointments/recall-campaigns-client.tsx` | Appointments recall | `ABSORB_INTO_APPOINTMENTS` |
| `src/features/appointments/kimi/recall-campaigns/*` | Recall campaigns connected | `ABSORB_INTO_APPOINTMENTS` |

### Libraries

| Path | Role | Recommendation |
|------|------|----------------|
| `src/lib/campaigns/campaign-processor.ts` | Due message dispatch batching | `SHARED_INFRA_ONLY` |
| `src/lib/campaigns/campaign-message-send.ts` | Per-message send | `SHARED_INFRA_ONLY` |
| `src/lib/campaigns/sequence-runner.ts` | Multi-step sequences | `SHARED_INFRA_ONLY` |
| `src/lib/campaigns/kimi-campaigns-adapter.ts` | UI ↔ API glue | `HIDE_PRESERVE` |
| `src/lib/campaigns/recurrence.ts` | Recurring campaigns | `HIDE_PRESERVE` |
| `src/lib/campaigns/playbook-*.ts` | Playbook automation | `HIDE_PRESERVE` |
| `src/lib/mass-texting/campaign-launch.ts` | Launch guards, credits, audit | `SHARED_INFRA_ONLY` |
| `src/lib/mass-texting/campaign-send.ts` | Mass-text campaign tagging | `SHARED_INFRA_ONLY` |
| `src/lib/mass-texting/broadcast/service.ts` | Broadcast orchestration | `SHARED_INFRA_ONLY` |
| `src/lib/mass-texting/broadcast/audience.ts` | Audience resolution | `SHARED_INFRA_ONLY` |
| `src/lib/mass-texting/campaign-guards.ts` | Pre-send safety | `SHARED_INFRA_ONLY` |
| `src/lib/campaign-tabs.ts` | List filter tabs | `HIDE_PRESERVE` |

### APIs

| API | Recommendation |
|-----|----------------|
| `src/app/api/mass-texting/campaigns/**` | `SHARED_INFRA_ONLY` — canonical mass launch |
| `src/app/api/campaigns/**` | `SHARED_INFRA_ONLY` — legacy/generic campaign CRUD |
| `src/app/api/voice/campaigns/**` | `HIDE_PRESERVE` |

**Boundary:** `src/lib/mass-texting/` must **not** import MCTB voice/SIP (`AGENTS.md` mass-texting boundary). Appointments recall should call shared send/campaign libs, not duplicate pipelines.

---

## 5. Import

| Path | Role | Recommendation |
|------|------|----------------|
| `src/app/(app)/contacts/imports/page.tsx` | Import UI | `ABSORB_INTO_APPOINTMENTS` |
| `src/components/contacts/contact-import-form.tsx` | CSV upload form | `RESTYLE_AND_REUSE` |
| `src/lib/contacts/parse-csv.ts` | CSV parsing | `REUSE_AS_IS` |
| `src/lib/contacts/list-assignment.ts` | List assignment on import | `REUSE_AS_IS` |
| `src/app/api/contacts/import/route.ts` | Import API | `REUSE_AS_IS` |
| `src/app/api/mass-texting/import-attestation/route.ts` | Marketing list attestation | `SHARED_INFRA_ONLY` — required for `marketingImport` |
| `prisma` `ListImportAttestation` | Attestation records | `REUSE_AS_IS` |

**Behavior:** Import API enforces `ListImportAttestation` when `marketingImport` or workspace has Mass Texting entitlement (`src/lib/mass-texting/access.ts`). Appointments service-booking imports should use **transactional/consent** path without marketing attestation unless sending promotional SMS.

---

## 6. Segments & lists

| Path | Role | Recommendation |
|------|------|----------------|
| `src/app/(app)/contacts/lists/page.tsx` | Lists index | `ABSORB_INTO_APPOINTMENTS` |
| `src/app/(app)/contacts/segments/page.tsx` | Segments manager | `ABSORB_INTO_APPOINTMENTS` |
| `src/components/contacts/kimi-lists-connected.tsx` | Lists glue | `RESTYLE_AND_REUSE` |
| `src/components/contacts/kimi-segments-connected.tsx` | Segments glue | `RESTYLE_AND_REUSE` |
| `src/components/contacts/segments-manager.tsx` | Segment builder | `RESTYLE_AND_REUSE` |
| `src/lib/contacts/kimi-segment-condition-map.ts` | Condition mapping | `REUSE_AS_IS` |
| `src/lib/contacts/segment-query.ts` | Query engine | `REUSE_AS_IS` |
| `src/components/contacts/appointment-segment-presets-panel.tsx` | Booking presets | `ABSORB_INTO_APPOINTMENTS` |
| `src/app/api/contacts/lists/route.ts` | Lists API | `REUSE_AS_IS` |
| `src/app/api/contacts/segments/route.ts` | Segments API | `REUSE_AS_IS` |
| `src/app/api/appointments/service-booking/appointment-segments/route.ts` | Appointment presets API | `REUSE_AS_IS` |

**Models:** `ContactList`, `ContactListMember`, `Segment` (JSON conditions), `Tag`, `ContactTag`.

---

## 7. Templates

Two parallel template systems exist:

### Mass SMS / shared templates

| Path | Role | Recommendation |
|------|------|----------------|
| `src/app/(app)/templates/page.tsx` | Marketing template library UI | `HIDE_PRESERVE` |
| `src/app/(app)/automations/templates/page.tsx` | Automation templates | `HIDE_PRESERVE` |
| `src/app/api/templates/route.ts` | Template CRUD | `SHARED_INFRA_ONLY` |
| `prisma` `Template` | name, category, channel, body | `SHARED_INFRA_ONLY` |
| `src/lib/messaging/template.ts` | Render helpers | `SHARED_INFRA_ONLY` |
| `src/components/inbox/template-picker.tsx` | Inbox quick insert | `RESTYLE_AND_REUSE` |

### Appointments templates

| Path | Role | Recommendation |
|------|------|----------------|
| `/appointments/automations/templates` | Reminder/automation copy | `REUSE_AS_IS` |
| `src/components/appointments/automations-templates-client.tsx` | UI | `REUSE_AS_IS` |
| `src/lib/appointments/appointments-service.ts` | `renderAppointmentTemplate`, merge vars | `REUSE_AS_IS` |
| `src/lib/appointments/reminder-delivery.ts` | Sends reminder SMS | `REUSE_AS_IS` |

**Recommendation:** `CONSOLIDATE` UX under Appointments **Reminders → Templates** for customer-care copy; keep `Template` model for inbox/campaign variable messages; **do not** merge appointment reminder config into mass marketing template library without clear channel/use-case separation.

---

## 8. Inbox (conversations)

| Path | Role | Recommendation |
|------|------|----------------|
| `src/app/(app)/conversations/page.tsx` | SSR + `KimiConversationsConnected` | `REUSE_AS_IS` |
| `src/components/inbox/kimi-conversations-connected.tsx` | Split-pane inbox glue | `RESTYLE_AND_REUSE` |
| `src/components/inbox/conversations-thread-area.tsx` | Thread view | `RESTYLE_AND_REUSE` |
| `src/components/inbox/conversations-composer.tsx` | Reply composer | `RESTYLE_AND_REUSE` |
| `src/components/inbox/inbox-product-filters.tsx` | MCTB / mass_text filters | `REUSE_AS_IS` |
| `src/lib/inbox/kimi-inbox-adapter.ts` | API mapping | `REUSE_AS_IS` |
| `src/lib/inbox/conversation-url-filters.ts` | URL state (`product=mctb\|mass_text`) | `REUSE_AS_IS` |
| `src/lib/inbox/inbox-compose.ts` | Compose + eligibility | `REUSE_AS_IS` |
| `src/app/api/inbox/route.ts` | List threads | `REUSE_AS_IS` |
| `src/app/api/inbox/[id]/route.ts` | Thread messages / reply | `REUSE_AS_IS` |
| `src/app/api/sms/send/route.ts` | New outbound from inbox | `REUSE_AS_IS` |

**Model:** `Conversation` with `productSource`: `MCTB | MASS_TEXT | MANUAL | AUTOMATION`. Appointments operational texts should set appropriate `productSource` (likely `MANUAL` or new `APPOINTMENTS` enum if needed).

**Inbound:** `src/lib/messaging/inbound-process.ts` handles STOP/HELP/START, keywords, and **appointment YES/CANCEL/AI scheduling** after compliance keywords — shared across products.

---

## 9. Send pipeline

### Workers & jobs

| Path | Role | Recommendation |
|------|------|----------------|
| `src/lib/jobs/sms-worker-jobs.ts` | SMS worker job types + BullMQ bridge | `REUSE_AS_IS` |
| `src/lib/jobs/job-handlers.ts` | Handlers: `campaign_send_batch`, `send_campaign_sms`, `drip_campaign_step`, … | `REUSE_AS_IS` |
| `src/lib/jobs/bullmq.ts` | Redis queue sync | `REUSE_AS_IS` |
| `src/lib/messaging/enqueue-advance.ts` | DB `JobQueue` outbox | `REUSE_AS_IS` |
| `src/lib/campaigns/campaign-processor.ts` | Fair queue, rate limits, activate scheduled | `REUSE_AS_IS` |
| `src/lib/messaging/dispatch/*` | Scheduler, kill switches, heartbeat, fair-queue | `REUSE_AS_IS` |
| `src/lib/mass-texting/credit-accounting.ts` | Segment credits / reservations | `SHARED_INFRA_ONLY` (mass billing) |
| `src/lib/drip-campaigns/engine.ts` | Drip step processor | `HIDE_PRESERVE` |
| `src/lib/appointments/reminder-delivery.ts` | Appointment reminder sends | `REUSE_AS_IS` |
| `src/lib/appointments/reminder-engine.ts` | Schedule + SMS/email delivery | `REUSE_AS_IS` |

### SMS worker job types

```
send_campaign_sms | send_campaign_email | campaign_send_batch |
messaging_registration_advance | drip_campaign_step
```

### Suppression / STOP

| Path | Role |
|------|------|
| `src/lib/messaging/inbound-process.ts` | STOP → `Suppression` row, opt-out recipients, skip queued campaign messages |
| `prisma` `Suppression` | `suppressionKey`, reason `STOP`, source `inbound_sms` |
| `src/lib/contacts/subscribe-guard.ts` | Outbound subscribe checks |
| `src/lib/mass-texting/campaign-guards.ts` | Pre-send suppression filtering |
| `src/app/api/compliance/suppression/route.ts` | Compliance UI API |

**Recommendation:** Appointments reminder/recall sends must use the same **unified send gate** and honor `Suppression` — `SHARED_INFRA_ONLY` via `src/lib/messaging/unified-send-gate.ts` and `messaging-authority.ts`.

---

## 10. Messaging registration (A2P / 10DLC / sender)

| Path | Role | Recommendation |
|------|------|----------------|
| `src/app/(app)/settings/messaging/page.tsx` | Settings → Messaging | `REUSE_AS_IS` — canonical admin home |
| `src/features/settings/kimi/messaging/messaging-connected.tsx` | Registration UI glue | `RESTYLE_AND_REUSE` |
| `src/lib/messaging/store.ts` | `MessagingRegistration` CRUD | `REUSE_AS_IS` |
| `src/lib/messaging/registration-processor.ts` | Registration advance jobs | `REUSE_AS_IS` |
| `src/lib/messaging/telnyx/ten-dlc-ops.ts` | Telnyx 10DLC | `REUSE_AS_IS` |
| `src/lib/mass-texting/messaging-registration.ts` | Per-product `MessagingProductRegistration` | `REUSE_AS_IS` |
| `src/lib/messaging/unified-send-gate.ts` | Single gate: MCTB + Mass Text + **transactional** | `REUSE_AS_IS` |
| `src/app/api/messaging/registration/route.ts` | Registration API | `REUSE_AS_IS` |
| `src/app/api/messaging/10dlc/route.ts` | 10DLC API | `REUSE_AS_IS` |
| `src/app/api/mass-texting/registration/route.ts` | Mass-text-specific registration | `SHARED_INFRA_ONLY` |
| `src/app/(app)/compliance/*` | Brand, campaign, consent, suppression audit | `SHARED_INFRA_ONLY` — link from settings |
| `src/app/(app)/sms/compliance/page.tsx` | SMS product compliance | `HIDE_PRESERVE` |

### Product use cases (`MessagingProductUseCase`)

- `MCTB_CUSTOMER_CARE` — Missed Call Text Back
- `MASS_TEXT_MARKETING` — Mass Texting / campaigns

**Note:** Comments in code indicate **one low-volume mixed Telnyx campaign** can cover MCTB + campaigns + transactional. Appointments business texting should use **transactional/customer-care** classification, not `MASS_TEXT_MARKETING`, unless sending promotional broadcasts.

**Entitlements:** `src/lib/products/feature-entitlements.ts` — `MASS_TEXTING` feature flag (target commercial flag; legacy `ProductEntitlement.sms` still gates shell).

---

## 11. Database models (Prisma)

| Model | Purpose | Absorption |
|-------|---------|------------|
| `Contact` | Canonical person record (phone unique per workspace) | `REUSE_AS_IS` |
| `ContactList` / `ContactListMember` | Static lists | `REUSE_AS_IS` |
| `Segment` | Dynamic segments (JSON conditions) | `REUSE_AS_IS` |
| `Tag` / `ContactTag` | Tags | `REUSE_AS_IS` |
| `Campaign` | Broadcast + sequence campaigns | `SHARED_INFRA_ONLY` (mass/recall) |
| `CampaignRecipient` / `CampaignMessage` | Per-recipient send state | `SHARED_INFRA_ONLY` |
| `Message` | Legacy/simple message log | `SHARED_INFRA_ONLY` |
| `Conversation` / `ConversationMessage` | Inbox threads | `REUSE_AS_IS` |
| `Template` | Reusable SMS copy | `SHARED_INFRA_ONLY` |
| `Suppression` | STOP / opt-out | `REUSE_AS_IS` |
| `ConsentRecord` | Opt-in evidence | `REUSE_AS_IS` |
| `MessagingRegistration` | Workspace A2P state | `REUSE_AS_IS` |
| `MessagingProductRegistration` | Per use-case registration | `REUSE_AS_IS` |
| `ListImportAttestation` | Marketing import attestation | `REUSE_AS_IS` (marketing only) |
| `CampaignLaunchAudit` | Pre-send audit / idempotency | `SHARED_INFRA_ONLY` |
| `MassTextingBillingAccount` | Credits / trial / Stripe | `HIDE_PRESERVE` (mass product billing) |
| `MassTextingCreditReservation` | Launch credit hold | `HIDE_PRESERVE` |
| `Keyword` | SMS keyword opt-in | `HIDE_PRESERVE` |
| `AutoReply` | Triggered auto SMS | `HIDE_PRESERVE` |
| `DripCampaign` / `DripCampaignEnrollment` | Drip sequences | `HIDE_PRESERVE` |
| `AiReply` | AI inbox auto-responder | `HIDE_PRESERVE` |
| `JobQueue` / `WorkerHeartbeat` | Async dispatch | `REUSE_AS_IS` |

### Enums (messaging-relevant)

- `ContactStatus`: SUBSCRIBED | UNSUBSCRIBED | BLOCKED | INVALID
- `CampaignStatus`: DRAFT | SCHEDULED | SENDING | COMPLETED | FAILED | PAUSED | CANCELED
- `ConversationProductSource`: MCTB | MASS_TEXT | MANUAL | AUTOMATION
- `MessagingProductUseCase`: MCTB_CUSTOMER_CARE | MASS_TEXT_MARKETING

---

## Cross-cutting: Drip, Grow, Playbooks (hidden product)

| Area | Key paths | Recommendation |
|------|-----------|----------------|
| Drip | `src/components/drip-campaigns/*`, `src/lib/drip-campaigns/*`, `/automations/drip-campaigns` | `HIDE_PRESERVE` |
| Grow | `src/lib/growth/*`, `/grow/*`, `src/app/api/grow/*` | `HIDE_PRESERVE` |
| Playbooks | `src/app/(app)/playbooks/page.tsx`, `src/lib/campaigns/playbook-*.ts` | `HIDE_PRESERVE` |
| Auto/AI replies | `/auto-replies`, `/ai-replies`, `prisma` `AutoReply`, `AiReply` | `HIDE_PRESERVE` |

---

## Absorption priority matrix (business texting → Appointments)

| Priority | Surface | Action |
|----------|---------|--------|
| P0 | `/conversations`, `/api/inbox`, send gate | Already shared — verify `productSource` labeling for appointment threads |
| P0 | `/settings/messaging`, A2P registration | Already in Appointments settings — certify transactional sends |
| P0 | Reminder SMS pipeline | `reminder-delivery.ts` + `unified-send-gate` — no duplicate send path |
| P1 | `/contacts` + detail appointments panel | Add Lists/Segments/Import to Appointments Contacts IA |
| P1 | Appointment segment presets | Promote in Segments UI for recall/targeting |
| P1 | `/appointments/recall-campaigns` | Wire to shared campaign send if not already; avoid mass-text billing UI |
| P2 | Quick send (`/send/quick`) | Contextual action from contact/appointment detail |
| P2 | Media library (`/messaging/media`) | Link from composer for MMS reminders |
| **P0** | **Campaigns under Messages** | **`/appointments/campaigns`** — reuse Kimi UI + mass-texting runtime; Appointments shell |
| P1 | Business Texting activation UI | Settings → Messaging — gate campaigns when no approved sender |
| P1 | Contacts feature-diff | Absorb any SMS-only contact capabilities into `/contacts` only |
| P2 | Template ownership | Prefer Automations → Templates; avoid duplicate sidebar |
| P3 | Grow, Drip, Playbooks, old SMS Dashboard | `DO_NOT_BRING_BACK` |

---

## Related docs & tests

| Doc / script | Relevance |
|--------------|-----------|
| `docs/MASS_TEXTING_GLUE_FLOWS.md` | Glue-layer inventory for Kimi-connected surfaces |
| `docs/V1-APPOINTMENTS-MCTB-UI-REBUILD.md` | V1 nav hiding rules |
| `AGENTS.md` | Mass Texting ↔ MCTB architecture boundary |
| `scripts/test-mass-texting-boundary.ts` | Regression: no MCTB imports in mass-texting |
| `scripts/test-mass-texting-*.ts` | Mass product certification suite |
| `docs/APPOINTMENTS-FEATURE-ABSORPTION-AUDIT-COMPLETE.md` | Prior batch-8A absorption (broader scope) |

---

## Governing principles for absorption

1. **One contact graph** — `Contact` is shared; appointment context is a panel, not a second CRM.
2. **One inbox** — `/conversations` with filters; no duplicate Appointments inbox.
3. **One send pipeline** — `messaging/service`, `unified-send-gate`, `JobQueue`/BullMQ; appointment reminders already on this path.
4. **Separate commercial products** — Mass marketing (`MASS_TEXT_MARKETING`) vs appointment transactional/customer-care; do not route promotional campaigns through reminder config.
5. **Preserve, don’t delete** — Hidden SMS nav routes stay reachable for entitlement/debug; `v1-launch-nav` controls visibility.
6. **MCTB boundary** — Do not merge MCTB voice ingress with mass texting libs (`src/lib/mass-texting/` isolation).

---

*End of audit.*
