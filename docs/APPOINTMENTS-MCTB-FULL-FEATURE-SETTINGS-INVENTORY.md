# Appointments + MCTB — Full Feature & Settings Inventory

**Generated:** 2026-09-07  
**Authority:** Repository source (routes, nav, Prisma, config types, setup UIs)  
**Route scan:** `docs/.generated/appointments-mctb-route-inventory.json` (53 appointment pages · 64 appointment APIs · 58 MCTB pages · 83 MCTB APIs)

This is a **complete catalog** of customer-facing features and configurable settings — not a test matrix.

---

## Part 1 — Appointments

### 1.1 Primary navigation (V1 shell)

| Nav item | Child destinations |
|----------|-------------------|
| **Home** | `/appointments/overview` |
| **Appointments** | Calendar, List, Waitlist, Recalls |
| **Booking** | Booking Types, Booking Pages, Availability, AI Booking, Routing, Meeting Polls |
| **Contacts** | `/contacts` (shared) |
| **Messages** | `/conversations` inbox (shared) |
| **Automations** | Reminder Sequences, Workflows, Templates, Activity |
| **Meetings** | Upcoming (`/video`), Recaps (`/meetings`) |
| **Payments** | Transactions |
| **Analytics** | Overview, Booking, Reminders, Automations, Reports |
| **Integrations** | Calendars, Payments |
| **Settings** | Business, Team, Messaging, Calendar, Meetings (AI Notetaker), Security, Billing |
| **Help** | `/getting-started` |

### 1.2 Operational pages & features

| Feature | Route | What users can do |
|---------|-------|-------------------|
| Overview / Home | `/appointments/overview` | KPIs, setup health, recent activity, drilldowns |
| Calendar | `/appointments/calendar` | Month/week/day view, create, drag-reschedule (where enabled) |
| List | `/appointments` | Filterable appointment table |
| Appointment detail | `/appointments/[id]` | Lifecycle actions, notes, reminders timeline, video, notetaker, payments |
| Manual create | `/appointments/new` | Staff books on behalf of customer |
| Waitlist | `/appointments/waitlist` | Queue management, offer slots |
| Recalls | `/appointments/recalls` | Recall hub / campaigns entry |
| No-show recovery | `/appointments/no-show-recovery` | No-show follow-up configuration |
| Recall campaigns | `/appointments/recall-campaigns` | Campaign-style recall outreach |
| Get started / setup | `/appointments/setup` | First-time onboarding wizard |
| Enterprise / team | `/appointments/enterprise` | Org-level team scheduling |
| Integrations hub | `/appointments/integrations` | In-product integration status |

### 1.3 Booking configuration pages

| Feature | Route | Settings / controls |
|---------|-------|---------------------|
| **Booking types** | `/appointments/types` | Per-type editor (see §1.5) |
| **Booking pages** | `/appointments/booking` | Public links, embed codes, slugs |
| **Availability** | `/appointments/availability` | Workspace hours, overrides, blackout dates |
| **Staff** | `/appointments/staff` | Staff members, hours, calendar links, assignment pools |
| **Locations** | `/appointments/locations` | Multi-location names, addresses, timezones, kinds |
| **Routing forms** | `/appointments/routing-forms` | Qualifying forms → route to type/staff |
| **Routing rules** | `/appointments/routing` | Condition → destination rule builder |
| **Meeting polls** | `/appointments/polls` | Group availability polls |
| **Team booking pages** | `/appointments/team-pages` | Multi-host collective pages |
| **AI Booking** | `/appointments/ai-booking` | SMS/email/web AI scheduling channels |

### 1.4 Automations

| Feature | Route | Settings |
|---------|-------|----------|
| **Reminder sequences** | `/appointments/reminders` | Confirmation + timed reminders (SMS/email/voice per step) |
| **Voice reminders** | `/appointments/voice-reminders` | Outbound call templates, TTS/audio, keypad actions, retry rules |
| **Workflows** | `/appointments/workflows` | Trigger → step automation builder |
| Workflow setup | `/appointments/workflows/setup/[templateId]` | Template-based workflow install |
| Workflow editor | `/appointments/workflows/[id]/edit` | Edit live workflow |
| **Templates** | `/appointments/automations/templates` | Reusable automation templates |
| **Activity** | `/appointments/automations/activity` | Execution log / audit |

### 1.5 Platform-level settings (`AppointmentPlatformConfig`)

Stored in workspace `SolutionSetup` / settings APIs.

| Setting | Description |
|---------|-------------|
| `bookingEnabled` | Master on/off for public booking |
| `timezone` | Default workspace timezone |
| `businessPhone`, `businessAddress`, `businessDisplayName` | Identity on booking surfaces |
| `consentText`, `consentVersion` | SMS consent disclosure |
| `termsUrl`, `privacyUrl` | Legal links |
| `onboardingComplete` | Setup wizard completion flag |
| `weeklyHours` | Default open hours by weekday |
| `dateOverrides` | Per-date closed or custom windows |
| `blackoutDates` | Dates blocked from booking |
| `minimumBookingNoticeMinutes` | Earliest bookable slot offset |
| `maximumBookingDaysAhead` | Furthest bookable horizon |
| `bookingProtection.mode` | `standard` \| `strict` \| `off` — fraud/challenge |
| `suspiciousBookings[]` | Risk-scored booking attempts |
| `staff[]` | Bookable staff roster (see below) |
| `locations[]` | Bookable locations |
| `routingRules[]` | Workspace routing rules |
| `bookingLimits` | Per-day/week/month caps |
| `roundRobinState` | Round-robin assignment counters |
| `externalCalendarBlocking` | Block slots from connected calendars |
| `namedSchedules[]` | Reusable availability schedules |
| `holidays[]` | Holiday calendar |
| `routingForms[]` | Routing form definitions |
| `schedulingGroups[]` | Team/group scheduling |
| `teamBookingPages[]` | Team page configs |
| `organizationPolicy` | Org-wide scheduling policy |
| `singleUseLinks[]` | One-time booking links |
| `meetingPolls[]` | Poll definitions |
| `reminders.confirmation` | Booking confirmation message step |
| `reminders.reminder24h` | 24h reminder step |
| `reminders.reminder2h` | 2h reminder step |
| `voiceReminders` | Voice reminder platform config (templates, caller ID, transfer) |

**Per reminder step:** `enabled`, `channel` (sms/email/voice), `minutesBefore`, `timeOfDay`, `skipWeekends`, `skipClosedDays`, `skipOffHours`, `stopOnReply`, `template`, `label`, `voiceReminderTemplateId`

### 1.6 Per booking type settings (`AppointmentTypeConfig` / `VoiceService`)

| Setting | Description |
|---------|-------------|
| `enabled` | Type active |
| `description`, `location`, `locationId`, `priceDisplay`, `bookingHours` | Display & placement |
| `minimumBookingNoticeMinutes`, `maximumBookingDaysAhead` | Type-specific horizons |
| `bufferBeforeMinutes`, `bufferAfterMinutes` | Slot buffers |
| `timezone` | Type timezone override |
| `visibility` | `public` \| `unlisted` \| `secret` |
| `managed`, `displayOrder` | Catalog management |
| `durationOptions[]` | Multiple durations per type |
| `permissions[]` | Who can book |
| `ownerTeamId` | Owning scheduling group |
| `bookingApproval` | Require approval before confirm |
| `redirectAfterBooking` | Post-book redirect URL |
| `confirmationPage` | Custom confirmation resources |
| `bookingQuestions[]` | Custom intake fields (text, select, etc.) |
| `staffAssignment` | `any_eligible`, `specific_staff`, `customer_chooses`, `round_robin`, etc. |
| `staffIds[]`, `collectiveStaffIds[]` | Assigned staff |
| `groupCapacity` | Group event capacity |
| `locationIds[]` | Allowed locations |
| `bookingLimits` | Per-type caps |
| `cancellationPolicy` | Cancel rules + cutoff |
| `reschedulePolicy` | Reschedule rules + cutoff |
| `payment` | `none` \| `deposit` \| `full` + Stripe/Square |
| `groupBooking`, `recurring` | Group/recurring options |
| `namedScheduleId` | Link to named schedule |
| `notetaker` | Per-type AI Notetaker defaults |
| `transovoVideo` | Per-type Transovo Video defaults |

### 1.7 Staff member settings (`BookableStaffMember`)

| Field | Description |
|-------|-------------|
| `name`, `active`, `customerSelectable` | Identity & visibility |
| `appointmentTypeIds[]`, `locationIds[]` | Scope |
| `calendarConnectionId` | External calendar busy blocking |
| `weeklyHours`, `dateOverrides`, `blackoutDates` | Personal availability |

### 1.8 Location settings (`AppointmentLocation`)

| Field | Description |
|-------|-------------|
| `name`, `address`, `timezone` | Identity |
| `kind` | office, store, phone, video, transovo_video, custom, etc. |
| `active` | Included in booking |

### 1.9 AI & intelligent booking

| Surface | Route / entry | Capability |
|---------|---------------|------------|
| **AI Booking admin** | `/appointments/ai-booking` | Configure AI scheduling channels |
| **Public AI book** | `/book/[slug]` AI widget | `POST /api/public/book/[slug]/ai` — natural language booking |
| **Inbound SMS AI** | Conversations | `tryHandleInboundAppointmentAi()` on inbound SMS |
| **Owner Amy** | Settings / agent runtime | Natural language settings changes (LLM agent) |
| **Caller Amy** | Telnyx voice assistant | Phone booking (separate Telnyx LLM) |
| **Workflow architect** | Workflow builder AI assist | LLM workflow generation |
| **Write verifier** | AI mutation pipeline | Validates AI-proposed writes before commit |

**AI Booking channels** (`/api/appointments/ai-booking/channels`):
- SMS (shared inbox number)
- Email (`booking+{slug}@inbound.transovo.com`)

### 1.10 Meetings, video & AI Notetaker

| Feature | Route | Settings |
|---------|-------|----------|
| Upcoming meetings | `/video` | Join/host scheduled video |
| Meeting recaps | `/meetings`, `/meetings/[id]` | Transcript, summary, action items |
| Host video room | `/appointments/[id]/video/host` | Transovo Video host |
| Public recap share | `/recap/[token]` | External stakeholder recap |
| **AI Notetaker settings** | `/settings/ai-notetaker` | Platform notetaker config (below) |
| Transovo Video settings | `/settings/transovo-video`, `/video/settings` | Video product settings |
| Per-appointment notetaker | Detail page `NotetakerPanel` | Enable/view recap per appointment |

**Notetaker platform settings** (`NotetakerPlatformConfig`):
- `enabled`, `joinRule` (all_supported, transovo_only, connected_calendar, external_participants, selected_types, manual_only)
- `selectedEventTypeIds[]`, `externalParticipantsOnly`
- `recordingEnabled`, `transcriptEnabled`, `summaryEnabled`, `actionItemsEnabled`, `followUpEnabled`
- `botName`, `summaryTemplate` (general, sales, consultation, etc.)
- `notifyAttendeesAdvance`, `advanceNoticeText`
- `emailOnRecapReady`, `autoShareWith`
- `recordingRetentionDays`, `transcriptRetentionDays`

### 1.11 Public / customer-facing routes

| Route | Purpose |
|-------|---------|
| `/book/[slug]` | Public booking page |
| `/book/[slug]/[serviceId]` | Direct type book |
| `/book/[slug]/reminders` | Reminder preferences (public) |
| `/book/payment/success`, `/book/payment/canceled` | Payment return URLs |
| `/embed/book/[slug]` | Embeddable booking iframe |
| `/appointments/confirm/[token]` | SMS/email confirm |
| `/appointments/cancel/[token]` | Self-service cancel |
| `/appointments/reschedule/[token]` | Self-service reschedule |
| `/waitlist/accept/[token]` | Accept waitlist offer |
| `/routing/[slug]/[formSlug]` | Public routing form |
| `/team/[slug]/[pageSlug]` | Public team booking page |
| `/video/public/[token]/*` | Guest video join flow |

### 1.12 Integrations & payments

| Integration | Route | Capability |
|-------------|-------|------------|
| Google / Microsoft calendar | `/integrations/calendars` | OAuth sync, busy blocking |
| Stripe / Square | `/integrations/payments` | Merchant connect |
| Payments ledger | `/payments/transactions` | Transaction history |
| Native appointments bridge | `/integrations/native/appointments` | Native app integration |

### 1.13 Analytics

| Report | Route |
|--------|-------|
| Overview | `/appointments/analytics` |
| Booking | `/appointments/analytics/booking` |
| Reminders | `/appointments/analytics/reminders` |
| Automations | `/appointments/analytics/automations` |
| Reports / export | `/appointments/analytics/reports`, `.../export` |

### 1.14 Shared platform settings (Appointments context)

| Settings page | Route | Relevant to appointments |
|---------------|-------|--------------------------|
| Business | `/settings/business` | Name, timezone, branding |
| Team | `/settings/users` | Staff accounts, roles |
| Messaging | `/settings/messaging` | SMS sender, A2P |
| Calendar | `/settings/calendar` | Default calendar behavior |
| Meetings | `/settings/ai-notetaker` | Notetaker defaults |
| Security | `/settings/security` | Auth, 2FA |
| Billing | `/settings/billing` | Subscription |

### 1.15 Appointment APIs (admin)

Full list in route inventory. Key groups:
- CRUD: `/api/appointments`, `/api/appointments/[id]`
- Types: `/api/appointments/types`, `.../types/[id]`, `.../types/bulk`
- Availability: `/api/appointments/availability`, `.../diagnostics/slots`
- Booking links: `/api/appointments/booking-links`, `.../booking/approval`
- Waitlist, recalls, no-show, recall-campaigns
- Workflows: CRUD, preview, test, logs, unknown-replies
- Reminders: test send, open/click tracking
- AI booking: `/api/appointments/ai-booking`, `.../channels`
- Voice reminders + caller ID
- Analytics + export
- Meetings/video on appointment: `.../[id]/meetings`, `.../video`, `.../reminder-timeline`
- Public: `/api/public/book/*`, token confirm/cancel/reschedule

### 1.16 Voice reminder template settings

Per template: `name`, `contentMode` (tts/audio), `humanScript`, `voicemailScript`, `audioUrl`, `voice`, `keypadOptions[]` (confirm/reschedule/cancel/transfer), `retryRules` (noAnswer, busy, voicemail)

Platform: `enabled`, `defaultTemplateId`, `templates[]`, `provisionedPhoneNumberId`, `defaultTransferE164`

### 1.17 Workflow automation capabilities

Triggers and steps (appointment workflows): confirmation requests, reminders, no-show handling, unknown-reply routing, recall sequences, internal notifications — configured per workflow in builder UI.

---

## Part 2 — Missed Call Text Back (MCTB)

### 2.1 Primary navigation (MCTB shell)

| Nav item | Route |
|----------|-------|
| **Home** | `/mctb` |
| **Missed Calls** | `/mctb/missed-calls` |
| **Conversations** | `/mctb/conversations` (shared inbox, MCTB filter) |
| **Voicemail** | `/mctb/voicemail` |
| **Analytics** | `/mctb/analytics` |
| **Setup** | `/mctb/setup` |
| **Numbers** | `/mctb/numbers` |

**Contextual (not primary nav):** Consent Log `/mctb/compliance/consent`, onboarding `/onboarding/mctb`, public request form `/f/mctb/[token]`

### 2.2 Operational pages & features

| Feature | Route | What users can do |
|---------|-------|-------------------|
| Overview | `/mctb` | Service status, today KPIs, needs attention, recent calls/conversations, setup health |
| Missed calls list | `/mctb/missed-calls` | Search, filter, paginate recovery outcomes |
| Missed call detail | `/mctb/missed-calls/[id]` | Full lifecycle timeline, call back, open conversation |
| Conversations | `/mctb/conversations` | SMS thread reply, handoff panel, takeover |
| Voicemail inbox | `/mctb/voicemail` | Listen, transcript, AI summary, follow-up actions |
| Analytics | `/mctb/analytics` | Recovery funnel, suppression breakdown, trends |
| Numbers | `/mctb/numbers` | Business line, forwarding destination, text-back sender, TFV/A2P status |
| Consent log | `/mctb/compliance/consent` | Audit consent events |

### 2.3 Setup sections (local nav)

| Section | Route |
|---------|-------|
| Overview | `/mctb/setup` |
| Phone & Forwarding | `/mctb/setup/phone` |
| Missed-call rules | `/mctb/setup/missed-call-rules` |
| Text Back | `/mctb/setup/text-back` |
| Consent | `/mctb/setup/consent` |
| Notifications & Handoff | `/mctb/setup/notifications` |
| Recovery controls | `/mctb/setup/recovery` |
| Voicemail | `/mctb/setup/voicemail` |
| Exclusions | `/mctb/setup/exclusions` |
| Test & diagnostics | `/mctb/setup/test` |
| Guided wizard | `/mctb/setup/start`, `/onboarding/mctb` |

**Known gap:** `/mctb/setup/links` — request form + default link settings exist in runtime but no dedicated links setup page yet.

### 2.4 Runtime database settings (`MissedCallTextConfig`)

| Field | Description |
|-------|-------------|
| `enabled` | MCTB service on/off |
| `delaySeconds` | Delay before first recovery SMS |
| `messageTemplate` | Primary recovery opener |
| `messageTemplateBusinessHours` | Legacy hours variant (being consolidated) |
| `messageTemplateAfterHours` | Legacy after-hours variant |
| `requireCarrierForward` | Require verified forwarding |
| `sendAfterNoAnswer` | Trigger: no answer |
| `sendAfterBusy` | Trigger: busy |
| `sendAfterRejected` | Trigger: rejected |
| `sendAfterTimeout` | Trigger: unreachable/timeout |
| `sendAfterVoicemail` | Trigger: voicemail |
| `businessHoursOnly` | Restrict sends to hours window |
| `allowedStartTime`, `allowedEndTime` | Send window |
| `timezone` | Schedule timezone |
| `quietHoursEnabled`, `quietHoursStart`, `quietHoursEnd` | Quiet hours suppression |
| `maxMessagesPerCaller` | Max automated texts per caller |
| `cooldownMinutes` | Repeat-caller cooldown |
| `suppressKnownSpam` | Spam suppression |
| `suppressBlockedNumbers` | Block list suppression |
| `suppressOptedOutNumbers` | STOP/opt-out suppression |
| `conversationEnabled` | Two-way conversation after text-back |
| `phoneNumberId` | Voice ingress / business line association |
| `smsPhoneNumberId` | Outbound SMS sender DID |
| `directDialForwardE164` | Optional direct-dial forward target |
| `requestFormEnabled` | Public request form on |
| `requestFormToken` | Public form token |
| `defaultLinkUrl` | Default `{{link}}` in templates |
| `leadCaptureEnabled` | Lead capture on request form |
| `requestFormFieldsJson` | Custom form fields |

### 2.5 Setup API payload settings (`/api/mctb/setup`)

Additional workspace-level fields (custom fields + solution config):

| Setting | Description |
|---------|-------------|
| `consentMode` | `press_1` \| `existing_consent` |
| `existingConsentAttested` | Attestation checkbox for existing consent mode |
| `businessLineE164` | Customer's public business number |
| `triggerRules.*` | Mirrors missed-call rule toggles |
| `scheduleMode` | always_on, business_hours, after_hours, custom |
| `weeklySchedule` | Per-day enabled + start/end |
| `pauseUntil` | Timed pause end |
| `replyNotifications` | Notify on caller reply |
| `activate` | Activate after wizard |

### 2.6 Phone & forwarding settings

| Control | Description |
|---------|-------------|
| Business line (E.164) | Customer public number |
| Carrier selection | Forwarding guide source |
| Forwarding destination | Hidden toll-free ingress (workspace-assigned) |
| Text-back sender | Separate SMS DID selection |
| Forwarding verification | Real call evidence checkpoints |
| "I've turned it on" | Starts verification session |
| Re-verify / troubleshoot | Re-run verification |

### 2.7 Missed-call rules settings

| Trigger | Default |
|---------|---------|
| No answer | On |
| Busy | On |
| Rejected | On |
| Unreachable (timeout) | On |
| Voicemail | Off (when supported) |

### 2.8 Consent settings

| Mode | UI label | Behavior |
|------|----------|----------|
| `press_1` | Ask callers to press 1 | Voice disclosure → DTMF 1 → compliance SMS → opener |
| `existing_consent` | Use permission my business already has | Attestation required; no Press-1 on call |

Press-1: locked system compliance confirmation message (not editable) + editable conversation opener preview.

### 2.9 Text back settings

| Control | Description |
|---------|-------------|
| Recovery message template | Editable opener with merge tags |
| `{{link}}` insertion | Default link variable |
| Initial delay | Seconds before send |
| Segment preview | GSM-7/Unicode segment count |
| Press-1 dual preview | System confirmation + opener bubbles |
| Sender readiness display | Separate from message validity |
| Consent mode context | Link to Consent section |

Legacy workflow config (`MissedCallTextBackConfig` / SolutionSetup): `initialDelayMinutes`, `initialDelaySeconds`, `firstMessage`, `replyWindowMinutes`, `followUpEnabled`, `followUpDelayMinutes`, `followUpMessage`, `stopOnReply`

### 2.10 Recovery controls settings

| Control | Description |
|---------|-------------|
| **Active / Pause** | Operational pause (does not disable carrier forwarding) |
| Pause presets | 1h, 4h, until tomorrow, indefinite |
| Custom pause until | Date-time resume |
| Resume now | Clear pause |
| **Cooldown minutes** | Repeat-caller text suppression window |
| **Max messages per caller** | Cap automated recovery texts |
| Timezone | For pause display |

### 2.11 Voicemail settings

**Operational inbox** (`/mctb/voicemail`): audio playback, transcript, AI summary, related missed call/conversation links, mark reviewed

**Setup** (`/mctb/setup/voicemail`):
- Greeting source: Transovo TTS, ElevenLabs AI voice, record, upload
- Preview before activate
- Behavior after voicemail (text-back trigger when supported)

### 2.12 Exclusions settings

| Capability | Description |
|------------|-------------|
| Suppression list | Numbers excluded from recovery |
| Opt-out honored | STOP recipients blocked |
| Spam / blocked sync | Automatic suppression sources |

### 2.13 Notifications & handoff settings (`MctbHandoffConfig`)

| Setting | Options / description |
|---------|---------------------|
| **Response mode** | `notify_only`, `guided_collection`, `ai_conversation`, `immediate_handoff` |
| **Emergency detection** | On/off |
| **Emergency criteria** | Free-text urgency rules |
| **Emergency action** | notify_only, callback_request, notify_emergency_contacts, ai_continue_notify, stop_ai_handoff |
| **Emergency uncertain behavior** | treat_normal, clarify, handoff_human |
| **Booking behavior** | off, on_request, selected_services, ai_when_fit |
| **Lead field schema** | Per-field requirement: off / optional / required |

**Lead fields:** caller_name, service_reason, urgency, location_zip, service_address, callback_time, customer_type, appointment_intent, additional_details

| Setting | Description |
|---------|-------------|
| **Routing matrix** | Per event type → channels (sms, email, in_app) + recipient IDs |
| **Event types** | missed_call_detected, caller_replied, lead_captured, callback_requested, urgent_detected, human_required, appointment_booked, voicemail_received, recovery_failure |
| **Quiet hours** | enabled, start, end, emergency bypass, non-urgent SMS delay |
| **Recipients** | name, email, mobile, role, per-event channel prefs, enabled |

**Conversation automation states:** waiting_for_caller, automation_active, collecting_information, waiting_for_customer, needs_human, human_active, callback_requested, urgent, appointment_offered, appointment_booked, resolved

**Follow-up statuses:** needs_follow_up, acknowledged, called_back, resolved, appointment_booked

### 2.14 Test & diagnostics

| Tool | Description |
|------|-------------|
| Try It (demo line) | End-to-end demo with consent mode picker |
| Setup test | Server-authoritative pipeline checkpoints |
| Live test | Real forward + SMS delivery verification |
| Diagnostics log | `/api/mctb/debug/log` (when enabled) |

Checkpoints include: call received, greeting played, press-1, consent recorded, missed call event, SMS queued/sent/delivered, reply in inbox.

### 2.15 Public / customer

| Route | Purpose |
|-------|---------|
| `/f/mctb/[token]` | Missed-call request form (lead capture) |
| `/api/public/mctb-request-form` | Form submission API |

### 2.16 MCTB runtime pipeline (not UI settings — product capabilities)

| Component | Entry | Capability |
|-----------|-------|------------|
| TeXML CFNA ingress | `/api/telnyx/voice/mctb-entry` | Certified PSTN ingress |
| Press-1 consent | mctb-consent, mctb-press-1 | DTMF consent capture |
| Existing consent voicemail | mctb-texml-voicemail, texml-status | Auto SMS after hangup |
| Missed call classifier | Voice webhooks | Event creation |
| Eligibility engine | Send path | Centralized send gates |
| Recovery SMS job | BullMQ | Delayed send |
| Inbound SMS | Telnyx webhook | Reply handling → John LLM / handoff |
| Handoff orchestrator | `process-inbound-reply` | Four response modes |
| Voicemail transcription | Voicemail pipeline | Transcript + AI summary |

### 2.17 Legacy routes (redirect / preserved)

| Legacy | Canonical target |
|--------|------------------|
| `/voice/missed-calls` | `/mctb/missed-calls` |
| `/voice/setup` | `/mctb/setup` |
| `/voice/analytics` | `/mctb/analytics` |
| `/voice/conversations` | `/mctb/conversations` |
| `/voice/schedule` | `/mctb/setup/recovery` |
| `/mctb/setup/business-hours` | `/mctb/setup/recovery` |
| `/mctb/setup/follow-up` | `/mctb/setup/recovery` |

### 2.18 MCTB APIs (summary)

83 routes in inventory. Key groups:
- Overview, missed calls, detail, analytics
- Setup CRUD, onboarding, live-test, setup-test, try-it
- Handoff config, actions, context
- Exclusions, consent-log, consent-prompt, TFV
- Telnyx voice: mctb-entry, consent, press-1, voicemail, texml-voicemail
- Public request form

---

## Part 3 — Shared between products

| Feature | Route | Used by |
|---------|-------|---------|
| Conversations inbox | `/conversations` | Both (MCTB filter `source=mctb`) |
| Contacts | `/contacts`, lists, segments | Both |
| Compliance | `/compliance` | SMS/A2P shared |
| Numbers management | workspace numbers | Both |
| Settings (business, messaging, billing) | `/settings/*` | Both |

---

## Part 4 — Entitlements & feature flags

| Flag / entitlement | Effect |
|--------------------|--------|
| `APPOINTMENTS_IN_V1_NAV` | Appointments in shell |
| `APPOINTMENTS_V1_PRIMARY` | Default product on login |
| Workspace `mctb` feature | Gates MCTB |
| `ai_notetaker` feature | Meeting AI |
| `transovo_video` feature | Native video rooms |
| `visual_voicemail` | Voicemail product add-on |
| `MASS_TEXTING` | Separate from MCTB (hidden at V1 launch) |

---

## Certification authority

**This document is the authoritative feature inventory for product certification** (2026-09-07).

Derived artifacts:
- Matrix: `docs/certification/APPOINTMENTS-MCTB-CERTIFICATION-MATRIX.md`
- Settings proof: `docs/certification/APPOINTMENTS-MCTB-SETTINGS-COVERAGE.md`
- Route/API classification: `docs/certification/APPOINTMENTS-MCTB-ROUTE-API-CLASSIFICATION.md`
- Results: `docs/certification/APPOINTMENTS_MCTB_CERTIFICATION_RESULTS.md`

```bash
npm run inventory:appointments-mctb
npm run cert:matrix:appointments-mctb    # regenerate matrix from inventory
npm run cert:appointments-mctb-staged      # crash-safe automated pipeline
```

### Known gaps (certification flags)

| ID | Issue |
|----|-------|
| **MCTB-DEFECT-SETUP-LINKS** | `requestFormEnabled`, `defaultLinkUrl`, `requestFormFieldsJson` exist in runtime/DB but **no** `/mctb/setup/links` page |
| **MCTB-LEGACY-SCHED-001** | Legacy `businessHoursOnly` / schedule fields remain in data model — test backward compatibility only; **Business Hours UI must not reappear** as canonical MCTB nav |

Related docs:
- `docs/APPOINTMENTS-MCTB-SOURCE-DRIVEN-INVENTORY.md` — workflow/action maps (superseded for cert authority by this doc + matrix)
- `docs/TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST.md` — MCTB route manifest authority
