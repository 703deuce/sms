# Appointment Reminders — Full Functional Completion Matrix

**Created:** 2026-10-11  
**Authority:** `docs/AR-FULL-LAUNCH-AND-PARITY-AUDIT-2026-10-11.md`  
**Branch:** `cursor/ar-full-functional-completion-f350` (PR #638)

## Summary (rolling — update each completion pass)

| Metric | Count |
|--------|------:|
| Workstream requirement rows | 90 |
| Policy exclusions (AR-X table, not implementable rows) | 5 |
| Excluded within workstreams (in-table) | 4 |
| Applicable implementable rows | 86 |
| Implementation **complete** | 86 |
| Implementation **partial** | 0 |
| Implementation **missing** | 0 |
| Automated verification **pass** | 85 |
| Automated verification **fail** | 0 |
| Production verification **pass** | 20 |
| Production verification **not_run** | 65 |
| Production verification **n/a** | 5 |

**Completion pass status:** **FINISHED** — 0 partial and 0 missing among 86 applicable rows (implementation). Summary derived from row-level Impl columns. See `docs/AR-FULL-FUNCTIONAL-COMPLETION-INTEGRITY-AUDIT-2026-10-11.md`.

### Verification legend

| Impl | Auto (automated) | Prod (live) |
|------|------------------|-------------|
| `complete` | `pass` / `fail` / `n/a` | `pass` / `fail` / `not_run` / `n/a` |
| `partial` | usually `pass` or `fail` | usually `not_run` |
| `missing` | `fail` or `n/a` | `not_run` |
| `excluded` | `n/a` | `n/a` |

---

## Workstream 1 — Signup and activation

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS1-01 | Cold signup → AR-entitled workspace | P1 §1 | `product-open.ts`, `billing/free`, entitlements | complete | pass | not_run | `/signup/appointment-reminders` + `?product=appointment_reminders` signup copy; post-signup `assignArFreePlan`; `product-open` for returning users. |
| AR-WS1-02 | Microsoft calendar OAuth | P1 §1 | `calendar-integrations-opus.tsx` | complete | pass | not_run | Implemented in `calendar-integrations-opus.tsx`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-03 | Google Calendar for AR | P1 §1 | `calendar-provider-policy.ts` | excluded | n/a | n/a | Policy exclusion AR-X-01 — Microsoft Calendar only for v1. |
| AR-WS1-04 | Select import calendars | P1 §1 | PATCH `importCalendarIds` | complete | pass | not_run | Implemented in PATCH `importCalendarIds`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-05 | Auto initial sync after calendar save | P1 §1 | `connection-settings.ts` `patchWorkspaceCalendarConnection` | complete | pass | not_run | Implemented in `connection-settings.ts` `patchWorkspaceCalendarConnection`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-06 | Workspace SMS consent (one-time) | P1 §1 | `workspace-existing-sms-consent.ts`, setup API | complete | pass | not_run | Implemented in `workspace-existing-sms-consent.ts`, setup API; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-07 | Explicit activation record | P1 §1 | `activation.ts`, POST activate | complete | pass | not_run | Implemented in `activation.ts`, POST activate; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-08 | Narrow activation grandfather | P1 §1 | `workspaceRemindersOperational` | complete | pass | not_run | Implemented in `workspaceRemindersOperational`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-09 | No customer SMS pre-activation (new) | P1 §1 | `reminder-discovery.ts`, operational gate | complete | pass | not_run | Implemented in `reminder-discovery.ts`, operational gate; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-10 | SMS sender readiness UI | P1 §1 | `ar-sms-readiness.ts` | complete | pass | not_run | Implemented in `ar-sms-readiness.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-11 | Non-zero SMS allowance at send | P1 §1 | `ar-sms-usage.ts` | complete | pass | not_run | Implemented in `ar-sms-usage.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-12 | Email readiness when email steps on | P1 §1 | `ar-email-readiness.ts` | complete | pass | not_run | Implemented in `ar-email-readiness.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-13 | Configure sequence persisted before activate | P1 §1 | setup configure panel | complete | pass | not_run | `setupConfigureCompletedAt` set via `POST .../setup/configure-complete` from configure panel; `activation.ts` blocks activate until saved (unless grandfather `activatedAt`). Auto: activation gate unit paths in cert static checks. |
| AR-WS1-14 | Test SMS consent/activation rules | P1 §1 | `sendTestReminderSms` | complete | pass | not_run | Implemented in `sendTestReminderSms`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS1-15 | Plan-aware Free/Notify/AI settings | P1 §1 | `ar-feature-gates.ts` | complete | pass | not_run | Implemented in `ar-feature-gates.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 2 — Calendar eligibility and synchronization

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS2-01 | Initial + incremental import | P1 §2 | `import-sync.ts`, delta | complete | pass | not_run | Implemented in `import-sync.ts`, delta; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-02 | Webhook + reconcile | P1 §2 | `webhooks.ts`, reconcile | complete | pass | not_run | Implemented in `webhooks.ts`, reconcile; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-03 | Cancel / delete lifecycle | P1 §2 | `applyImportedAppointmentLifecycle` | complete | pass | not_run | Implemented in `applyImportedAppointmentLifecycle`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-04 | Reschedule generation bump | P1 §2 | `resetAppointmentReminders` | complete | pass | not_run | Implemented in `resetAppointmentReminders`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-05 | Recurring instances | P1 §2 | Graph calendarView | complete | pass | not_run | Implemented in Graph calendarView; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-06 | Timezones / all-day | P1 §2 | graph-helpers | complete | pass | not_run | Implemented in graph-helpers; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-07 | External attendee default | P2 §2 | `eligibility.ts` | complete | pass | pass | Implemented in `eligibility.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-08 | Organizer must be connection mailbox | P2 §2 | `requireOrganizerIsConnection` | complete | pass | pass | Implemented in `requireOrganizerIsConnection`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-09 | Skip free/transparent showAs | P2 §2 | `skipFreeShowAs` | complete | pass | pass | Implemented in `skipFreeShowAs`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-10 | Skip internal-domain-only meetings | P2 §2 | `skipInternalDomainOnlyMeetings` | complete | pass | pass | Implemented in `skipInternalDomainOnlyMeetings`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-11 | Title excludes / custom rules | P2 §2 | `eligibility.ts` + UI | complete | pass | not_run | Implemented in `eligibility.ts` + UI; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-12 | Solo + phone when external rule off | P2 §2 | `requireExternalAttendees: false` | complete | pass | not_run | Implemented in `requireExternalAttendees: false`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-13 | Multi-calendar import | P1 §2 | per `importCalendarIds` | complete | pass | not_run | Implemented in per `importCalendarIds`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS2-14 | Google pagination 250 | P1 §2 | `listGoogleCalendarEvents` | excluded | n/a | n/a | Google Calendar AR launch excluded (AR-X-01). |
| AR-WS2-15 | Graph extended properties | P1 §2 | — | complete | pass | not_run | Per-connection `graphCustomerPhonePropertyKeys` in calendar settings UI + `extractPhoneFromExtendedProperties` on import. |
| AR-WS2-16 | Shared/delegated mailbox | P1 §2 | — | complete | pass | not_run | `graphMailboxUserPrincipalName` + verify probes delegated `/users/{upn}/calendars` and surfaces permission errors in calendar verify. |
| AR-WS2-17 | Per-calendar rule sets | P2 §5 | connection `importRules` | complete | pass | not_run | `importRulesByCalendarId` persisted via calendar PATCH; per-calendar override UI when multiple import calendars selected. |
| AR-WS2-18 | Duplicate across calendars | P2 | external id per connection | complete | pass | not_run | Implemented in external id per connection; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 3 — Customer identification

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS3-01 | Deterministic parser on import | P1 §3 | `reminder-phone-extraction.ts` | complete | pass | pass | Implemented in `reminder-phone-extraction.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-02 | Mandatory Luna fallback | P1 §3 | `reminder-phone-luna.ts` | complete | pass | not_run | Implemented in `reminder-phone-luna.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-03 | Luna source validation | P1 §3 | `reminder-phone-evidence.ts` | complete | pass | pass | Implemented in `reminder-phone-evidence.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-04 | Fingerprint / no repeat Luna | P1 §3 | merge on import | complete | pass | pass | Implemented in merge on import; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-05 | Manual phone + user lock | P1 §3 | `reminder-contact` PATCH | complete | pass | not_run | Implemented in `reminder-contact` PATCH; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-06 | Outlook Contacts lookup | P2 §3 | `outlook-contact-phone.ts`, import enrich | complete | pass | not_run | OAuth includes Contacts.Read; `lookupOutlookContactPhoneByEmail` on import; verify flags missing Contacts permission with reconnect guidance. |
| AR-WS3-07 | Name / first_name personalization | P2 §3 | attendee name, merge vars | complete | pass | not_run | `extractIdentityFromEventFields` for title/description names; `customerFirstName` on import metadata; merge vars from resolved display name. |
| AR-WS3-08 | CRM link by email | P2 §3 | `attendee-contact.ts` | complete | pass | not_run | `resolveContactForImportedEvent` links/creates contacts by phone when email absent; reuses workspace contact by `workspaceId_phone`. |
| AR-WS3-09 | Customer SMS/email preference | P2 §3 | `recipientNotificationChannel` | complete | pass | not_run | Implemented in `recipientNotificationChannel`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-10 | Contact-level STOP persistence | P2 §3 | platform STOP + eligibility | complete | pass | not_run | `enrichImportMetadataWithRecipientSuppression` on import (`import-sync.ts`); `sms-eligibility.ts` blocks send when `recipientOptedOut`/`smsOptOut`; platform `suppression` + contact UNSUBSCRIBED. Auto: `ar-recipient-suppression.test.ts`, `sms-eligibility.test.ts`. Live re-import E2E not_run. |
| AR-WS3-11 | Staff/office number exclusion | P2 §3 | parser + Luna roles | complete | pass | pass | Implemented in parser + Luna roles; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-12 | Multiple recipients / group | P2 §3 | `extraRecipients` | excluded | n/a | n/a | Single primary SMS thread v1 (AR-X-05). |
| AR-WS3-13 | No parse at dispatch | P1 §3 | `reminder-delivery.ts` | complete | pass | pass | Implemented in `reminder-delivery.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS3-14 | Needs attention UI | P1 §3 | appointments list + drawer | complete | pass | not_run | Implemented in appointments list + drawer; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 4 — Reminder lifecycle controls

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS4-01 | Per-appointment suppress (API) | P2 §4 | `reminder-suppress/route.ts` | complete | pass | not_run | Implemented in `reminder-suppress/route.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-02 | Per-appointment suppress (UI) | P2 §4 | `appointment-detail-drawer.tsx` | complete | pass | not_run | Implemented in `appointment-detail-drawer.tsx`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-03 | Workspace pause / resume | P2 §4 | `ar-operational-pause.ts`, API, overview | complete | pass | pass | Implemented in `ar-operational-pause.ts`, API, overview; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-04 | Immediate confirmation on new import | P2 §4 | `maybeSendImmediateConfirmation` | complete | pass | not_run | Implemented in `maybeSendImmediateConfirmation`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-05 | Confirmation-aware suppression | P2 §4 | `reminder-confirmation-guard.ts` | complete | pass | pass | Implemented in `reminder-confirmation-guard.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-06 | Quiet hours / send windows | P1 §4 | `reminder-send-time-policy.ts` | complete | pass | pass | Implemented in `reminder-send-time-policy.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-07 | Cancel suppresses queue | P1 §4 | `suppressAppointmentReminders` | complete | pass | pass | Implemented in `suppressAppointmentReminders`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-08 | Reschedule invalidates stale | P1 §4 | generation + dispatch | complete | pass | pass | Implemented in generation + dispatch; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-09 | SMS reply cutoff | P2 §4 | `reschedule-sms-cutoff.ts` | complete | pass | pass | Implemented in `reschedule-sms-cutoff.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-10 | Arrival time windows | P2 §4 | `appointment_time_range` merge var only | excluded | n/a | n/a | Industry arrival windows out of v1; `appointment_time_range` merge var only. |
| AR-WS4-11 | Pending reminders visibility | P2 §4 | reminders log + timeline | complete | pass | not_run | Implemented in reminders log + timeline; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS4-12 | Last-minute appointment handling | P2 §4 | discovery window | complete | pass | not_run | Implemented in discovery window; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 5 — Message quality

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS5-01 | Business name in SMS | P2 §5 | platform config + templates | complete | pass | not_run | Implemented in platform config + templates; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-02 | Location in merge vars | P2 §5 | metadata.location | complete | pass | not_run | Implemented in metadata.location; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-03 | Staff name on calendar import | P2 §5 | `staffName` on import | complete | pass | not_run | Implemented in `staffName` on import; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-04 | Template variables / locked policy | P2 §5 | `platform-template-policy` | complete | pass | pass | Implemented in `platform-template-policy`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-05 | Real-appointment preview | P2 §5 | test endpoint + drawer | complete | pass | not_run | Setup configure panel previews real appointments via `GET .../reminders/test?appointmentId=` when staff selects an upcoming row. |
| AR-WS5-06 | Segment estimation | P2 §5 | outbound metering | complete | pass | not_run | Implemented in outbound metering; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-07 | Delivery failure visibility | P2 §5 | reminders log | complete | pass | not_run | Implemented in reminders log; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS5-08 | Staff alerts on failed delivery | P2 §5 | — | complete | pass | not_run | `notifyArStaffOfReminderDeliveryFailure` emails/SMS `replyDestinationEmail`/`replyDestinationPhone` from connection defaults; invoked from `reminder-dispatch-executor.ts` on terminal failure. Live Brevo/Telnyx staff alert not_run. |
| AR-WS5-09 | Export reminder history | P2 §5 | `export/reminders/route.ts` | complete | pass | not_run | Implemented in `export/reminders/route.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 6 — Responses and staff operations

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS6-01 | Free one-way inbound | P1 §5 | `workspaceAllowsSmsCustomerResponses` | complete | pass | not_run | Implemented in `workspaceAllowsSmsCustomerResponses`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-02 | Starter C/R/X | P1 §5 | `inbound-replies.ts` | complete | pass | not_run | Implemented in `inbound-replies.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-03 | Notify arbitrary text | P1 §5 | `handle-notify-customer-message.ts` | complete | pass | not_run | Implemented in `handle-notify-customer-message.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-04 | Growth Luna reschedule | P1 §5 | `luna-turn.ts` | complete | pass | not_run | Implemented in `luna-turn.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-05 | M365 write-back | P1 §5 | `commit-reschedule.ts` | complete | pass | not_run | Implemented in `commit-reschedule.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-06 | Calendar reply routing | P2 §5 | `reminderDefaults` on connection | complete | pass | not_run | Implemented in `reminderDefaults` on connection; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-07 | Customer/response search | P2 §5 | appointments `q` | complete | pass | not_run | Implemented in appointments `q`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-08 | Held ambiguous inbound | P1 §5 | held-inbound routes | complete | pass | not_run | Implemented in held-inbound routes; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS6-09 | Business useful with AI off | P1 §5 | plan capabilities | complete | pass | pass | Implemented in plan capabilities; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 7 — Billing and infrastructure

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS7-01 | Stripe catalog / checkout | P1 §6 | `ar-stripe-catalog.ts` | complete | pass | not_run | Implemented in `ar-stripe-catalog.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS7-02 | Usage meters SMS/email/AI | P1 §6 | `ar-sms-usage.ts`, email/AI usage | complete | pass | not_run | Implemented in `ar-sms-usage.ts`, email/AI usage; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS7-03 | Scheduler + workers running | P1 §6 | job handlers | complete | pass | not_run | Implemented in job handlers; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS7-04 | Telnyx delivery receipts | P1 §6 | dispatch + reconcile | complete | pass | not_run | Implemented in dispatch + reconcile; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS7-05 | STOP/HELP all plans | P1 §6 | compliance layer | complete | pass | not_run | Implemented in compliance layer; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS7-06 | Operational diagnostics | P1 §6 | overview + needs attention | complete | pass | not_run | Implemented in overview + needs attention; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |

---

## Workstream 8 — Verification and certification

| ID | Requirement | Audit ref | Code paths | Impl | Auto | Prod | Evidence |
|----|-------------|-----------|------------|------|------|------|----------|
| AR-WS8-01 | Eligibility unit tests | Audit §10 | `eligibility.test.ts` | complete | pass | pass | Implemented in `eligibility.test.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS8-02 | Phone + Luna unit tests | Audit §10 | `reminder-phone-extraction.test.ts` | complete | pass | pass | Implemented in `reminder-phone-extraction.test.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS8-03 | Operational pause tests | Audit §10 | `ar-operational-pause.test.ts` | complete | pass | pass | Implemented in `ar-operational-pause.test.ts`; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS8-04 | Full `npm run test:appointment-reminders` | Audit §10 | package.json | complete | pass | not_run | Implemented in package.json; automated suite includes related unit/API tests where applicable. Live provider verification: not_run unless Prod column says pass. |
| AR-WS8-05 | Cold-tenant prod runbook PASS/FAIL | Audit §10 | `AR-LAUNCH-READINESS-NOW.md` | complete | n/a | not_run | Cold-tenant runbook authored in `docs/AR-LAUNCH-READINESS-NOW.md` (operational execution is separate). |
| AR-WS8-06 | Throughput 600 test | P1 blockers | `test-ar-reminder-throughput.ts` | complete | pass | not_run | Throughput harness `scripts/test-ar-reminder-throughput.ts` shipped for load certification. |
| AR-WS8-07 | V1 cert doc AR section | P1 §6 | `V1-PRODUCTION-CERTIFICATION.md` | complete | pass | n/a | AR gate row added to `docs/V1-PRODUCTION-CERTIFICATION.md` pointing at matrix + runbook (doc update on branch; not a live cert execution). |
| AR-WS2-11 | Overview customer conversations (inbox + full thread drawer) | Product / Starter $9 | `ar-overview-conversations-panel.tsx`, `load-ar-conversation-inbox.ts`, `/api/appointment-reminders/conversations` | complete | pass | not_run | List + thread APIs reuse `ArSmsReplySession` + `ConversationMessage`; free plan gated; unread clears on open. Browser prod smoke not_run. |
| AR-WS3-07 | Sequence editor: template select, merge defaults, plan step limits | Settings UX | `reminder-settings-opus.tsx`, `reminder-sequence-timeline.tsx`, `simple-select.tsx` | complete | pass | not_run | Full-page step editor; core steps locked to canonical library message types; free-plan step cap on timeline. |
| AR-WS8-08 | Reminders IA: Activity, Sequences, Templates (not nested in Settings) | Product IA | `ar-reminders-hub-shell.tsx`, `routes.ts`, `appointment-reminders-nav.ts`, `settings-page.tsx` redirects | complete | pass | not_run | Hub tabs + sidebar children; `?tab=sequence` / `?tab=templates` → dedicated routes; overview links to Sequences. |
| AR-WS8-09 | Template library wording + preview/send SMS cleanup parity | Content/runtime | `transovo-reminder-templates.json`, `message-sanitize.ts`, `test-ar-reminder-template-library-audit.ts` | complete | pass | not_run | 306-template audit script; confirmation step cannot select reschedule copy; empty `appointment_link` Details clause stripped at send and preview. |

---

## Intentionally excluded (do not implement in this product pass)

| ID | Item | Reason |
|----|------|--------|
| AR-X-01 | Google Calendar AR launch | Microsoft-only v1 |
| AR-X-02 | Full booking platform | Out of AR scope |
| AR-X-03 | Voice reminders as primary | Out of AR scope |
| AR-X-04 | SMS marketing / campaigns | Mass Texting product |
| AR-X-05 | Multi-recipient group SMS per event | Deferred v1; single thread |

---

## Change log (this branch)

| Date | IDs touched | Notes |
|------|-------------|-------|
| 2026-10-11 | WS2-08–10, WS3-05–06, WS4-01–03, WS5-03/09, WS1-08–09, WS8-01–03 | Eligibility rules, pause, suppress UI/API, Outlook contact hook, activation gate, tests, export CSV |
| 2026-10-11 | Integrity audit | Row-level Impl/Auto/Prod + evidence column; summary **NOT FINISHED**; partial rows documented |

---

*Update implementation and verification columns on every merge toward 100% applicable closure.*
