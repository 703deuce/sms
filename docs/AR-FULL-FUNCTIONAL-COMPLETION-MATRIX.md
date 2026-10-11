# Appointment Reminders — Full Functional Completion Matrix

**Created:** 2026-10-11  
**Authority:** `docs/AR-FULL-LAUNCH-AND-PARITY-AUDIT-2026-10-11.md`  
**Branch (in progress):** `cursor/ar-full-functional-completion-f350`

## Summary (rolling — update each completion pass)

| Metric | Count |
|--------|------:|
| Unique requirements | 68 |
| Implementation **complete** | 22 |
| Implementation **partial** | 28 |
| Implementation **missing** | 6 |
| **Excluded** (intentional / out of product) | 5 |
| **Blocked** (external / prod-only) | 7 |
| Verification **PASS** (automated) | 18 |
| Verification **UNVERIFIED** (needs prod/live) | 42 |

**Completion pass status:** **NOT FINISHED** — this matrix is the exhaustive inventory; rows must not be hidden until implemented + verified or explicitly excluded.

### Status legend

| Implementation | Verification |
|----------------|--------------|
| `complete` | `pass` / `fail` / `unverified` / `blocked` |
| `partial` | |
| `missing` | |
| `excluded` | N/A |
| `blocked` | `blocked` |

---

## Workstream 1 — Signup and activation

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS1-01 | Cold signup → AR-entitled workspace | P1 §1 | `product-open.ts`, `billing/free`, entitlements | partial | unverified | Needs dedicated AR-only signup UX + E2E |
| AR-WS1-02 | Microsoft calendar OAuth | P1 §1 | `calendar-integrations-opus.tsx` | complete | pass | Existing connect flow |
| AR-WS1-03 | Google Calendar for AR | P1 §1 | `calendar-provider-policy.ts` | excluded | n/a | **Microsoft-only launch** — env flag only |
| AR-WS1-04 | Select import calendars | P1 §1 | PATCH `importCalendarIds` | complete | pass | Setup readiness |
| AR-WS1-05 | Auto initial sync after calendar save | P1 §1 | `connection-settings.ts` `patchWorkspaceCalendarConnection` | complete | partial | Inline sync when AR + import change; verify webhook-only tenants |
| AR-WS1-06 | Workspace SMS consent (one-time) | P1 §1 | `workspace-existing-sms-consent.ts`, setup API | complete | unverified | Unit `sms-eligibility.test.ts`; prod cold tenant pending |
| AR-WS1-07 | Explicit activation record | P1 §1 | `activation.ts`, POST activate | complete | partial | `activatedAt` required for **new** workspaces |
| AR-WS1-08 | Narrow activation grandfather | P1 §1 | `workspaceRemindersOperational` | complete | partial | Sends only if `activatedAt` OR prior dispatch + `canActivate` |
| AR-WS1-09 | No customer SMS pre-activation (new) | P1 §1 | `reminder-discovery.ts`, operational gate | complete | partial | Grandfather for legacy dispatch history only |
| AR-WS1-10 | SMS sender readiness UI | P1 §1 | `ar-sms-readiness.ts` | complete | unverified | Prod TF diagnosis script |
| AR-WS1-11 | Non-zero SMS allowance at send | P1 §1 | `ar-sms-usage.ts` | partial | blocked | **Prod plan/trial config** |
| AR-WS1-12 | Email readiness when email steps on | P1 §1 | `ar-email-readiness.ts` | partial | blocked | **Brevo live cert** |
| AR-WS1-13 | Configure sequence persisted before activate | P1 §1 | setup configure panel | partial | unverified | Optional gate not enforced |
| AR-WS1-14 | Test SMS consent/activation rules | P1 §1 | `sendTestReminderSms` | partial | unverified | Document or gate |
| AR-WS1-15 | Plan-aware Free/Notify/AI settings | P1 §1 | `ar-feature-gates.ts` | partial | unverified | Matrix script covers some |

---

## Workstream 2 — Calendar eligibility and synchronization

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS2-01 | Initial + incremental import | P1 §2 | `import-sync.ts`, delta | complete | unverified | Lifecycle E2E manual |
| AR-WS2-02 | Webhook + reconcile | P1 §2 | `webhooks.ts`, reconcile | partial | unverified | Calendar scoping audit open |
| AR-WS2-03 | Cancel / delete lifecycle | P1 §2 | `applyImportedAppointmentLifecycle` | complete | pass | Unit + import paths |
| AR-WS2-04 | Reschedule generation bump | P1 §2 | `resetAppointmentReminders` | complete | pass | `reminder-state` |
| AR-WS2-05 | Recurring instances | P1 §2 | Graph calendarView | complete | unverified | Prod series smoke |
| AR-WS2-06 | Timezones / all-day | P1 §2 | graph-helpers | complete | partial | DST edge cases |
| AR-WS2-07 | External attendee default | P2 §2 | `eligibility.ts` | complete | pass | `eligibility.test.ts` |
| AR-WS2-08 | Organizer must be connection mailbox | P2 §2 | `requireOrganizerIsConnection` | complete | pass | `eligibility.test.ts` |
| AR-WS2-09 | Skip free/transparent showAs | P2 §2 | `skipFreeShowAs` | complete | pass | `eligibility.test.ts` |
| AR-WS2-10 | Skip internal-domain-only meetings | P2 §2 | `skipInternalDomainOnlyMeetings` | complete | pass | `eligibility.test.ts` |
| AR-WS2-11 | Title excludes / custom rules | P2 §2 | `eligibility.ts` + UI | complete | partial | UI in calendar integrations |
| AR-WS2-12 | Solo + phone when external rule off | P2 §2 | `requireExternalAttendees: false` | complete | partial | Configurable per connection |
| AR-WS2-13 | Multi-calendar import | P1 §2 | per `importCalendarIds` | complete | unverified | Two-calendar smoke |
| AR-WS2-14 | Google pagination 250 | P1 §2 | `listGoogleCalendarEvents` | excluded | n/a | Google AR launch excluded |
| AR-WS2-15 | Graph extended properties | P1 §2 | — | missing | blocked | Needs customer field mapping spec |
| AR-WS2-16 | Shared/delegated mailbox | P1 §2 | — | missing | blocked | **Graph permissions / tenant** |
| AR-WS2-17 | Per-calendar rule sets | P2 §5 | connection `importRules` | partial | partial | One rules object per connection, not per calendar id |
| AR-WS2-18 | Duplicate across calendars | P2 | external id per connection | partial | unverified | Dedup policy doc |

---

## Workstream 3 — Customer identification

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS3-01 | Deterministic parser on import | P1 §3 | `reminder-phone-extraction.ts` | complete | pass | `reminder-phone-extraction.test.ts` |
| AR-WS3-02 | Mandatory Luna fallback | P1 §3 | `reminder-phone-luna.ts` | complete | partial | Mock tests; live Luna script separate |
| AR-WS3-03 | Luna source validation | P1 §3 | `reminder-phone-evidence.ts` | complete | pass | evidence tests |
| AR-WS3-04 | Fingerprint / no repeat Luna | P1 §3 | merge on import | complete | pass | extraction tests |
| AR-WS3-05 | Manual phone + user lock | P1 §3 | `reminder-contact` PATCH | complete | partial | Sets `reminderPhoneUserLocked` |
| AR-WS3-06 | Outlook Contacts lookup | P2 §3 | `outlook-contact-phone.ts`, import enrich | partial | blocked | **Contacts.Read** + reconnect OAuth |
| AR-WS3-07 | Name / first_name personalization | P2 §3 | attendee name, merge vars | partial | unverified | Title-only weak |
| AR-WS3-08 | CRM link by email | P2 §3 | `attendee-contact.ts` | complete | partial | Phone-only identity thin |
| AR-WS3-09 | Customer SMS/email preference | P2 §3 | `recipientNotificationChannel` | partial | unverified | Drawer preferences tab |
| AR-WS3-10 | Contact-level STOP persistence | P2 §3 | platform STOP + eligibility | partial | unverified | Re-import same phone risk |
| AR-WS3-11 | Staff/office number exclusion | P2 §3 | parser + Luna roles | partial | pass | Parser tests; eligibility internal meeting rule |
| AR-WS3-12 | Multiple recipients / group | P2 §3 | `extraRecipients` | missing | n/a | v1 single primary SMS thread |
| AR-WS3-13 | No parse at dispatch | P1 §3 | `reminder-delivery.ts` | complete | pass | Code review |
| AR-WS3-14 | Needs attention UI | P1 §3 | appointments list + drawer | partial | unverified | Browser cert |

---

## Workstream 4 — Reminder lifecycle controls

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS4-01 | Per-appointment suppress (API) | P2 §4 | `reminder-suppress/route.ts` | complete | unverified | New route |
| AR-WS4-02 | Per-appointment suppress (UI) | P2 §4 | `appointment-detail-drawer.tsx` | complete | unverified | Reminders tab control |
| AR-WS4-03 | Workspace pause / resume | P2 §4 | `ar-operational-pause.ts`, API, overview | complete | partial | `ar-operational-pause.test.ts` |
| AR-WS4-04 | Immediate confirmation on new import | P2 §4 | `maybeSendImmediateConfirmation` | complete | unverified | Prod smoke |
| AR-WS4-05 | Confirmation-aware suppression | P2 §4 | `reminder-confirmation-guard.ts` | complete | pass | unit tests |
| AR-WS4-06 | Quiet hours / send windows | P1 §4 | `reminder-send-time-policy.ts` | complete | pass | policy tests |
| AR-WS4-07 | Cancel suppresses queue | P1 §4 | `suppressAppointmentReminders` | complete | pass | |
| AR-WS4-08 | Reschedule invalidates stale | P1 §4 | generation + dispatch | complete | pass | |
| AR-WS4-09 | SMS reply cutoff | P2 §4 | `reschedule-sms-cutoff.ts` | complete | pass | unit tests |
| AR-WS4-10 | Arrival time windows | P2 §4 | — | missing | n/a | Industry-specific; range merge vars TBD |
| AR-WS4-11 | Pending reminders visibility | P2 §4 | reminders log + timeline | partial | unverified | No approve-before-send gate |
| AR-WS4-12 | Last-minute appointment handling | P2 §4 | discovery window | partial | unverified | 4-min due window |

---

## Workstream 5 — Message quality

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS5-01 | Business name in SMS | P2 §5 | platform config + templates | complete | unverified | |
| AR-WS5-02 | Location in merge vars | P2 §5 | metadata.location | partial | unverified | Import location path |
| AR-WS5-03 | Staff name on calendar import | P2 §5 | `staffName` on import | complete | partial | `config.displayName` |
| AR-WS5-04 | Template variables / locked policy | P2 §5 | `platform-template-policy` | complete | pass | unit tests |
| AR-WS5-05 | Real-appointment preview | P2 §5 | test endpoint + drawer | partial | unverified | Configure uses samples |
| AR-WS5-06 | Segment estimation | P2 §5 | outbound metering | partial | unverified | |
| AR-WS5-07 | Delivery failure visibility | P2 §5 | reminders log | partial | unverified | |
| AR-WS5-08 | Staff alerts on failed delivery | P2 §5 | — | missing | blocked | Needs notification channel design |
| AR-WS5-09 | Export reminder history | P2 §5 | `export/reminders/route.ts` | complete | unverified | CSV export API added |

---

## Workstream 6 — Responses and staff operations

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS6-01 | Free one-way inbound | P1 §5 | `workspaceAllowsSmsCustomerResponses` | complete | unverified | |
| AR-WS6-02 | Starter C/R/X | P1 §5 | `inbound-replies.ts` | complete | blocked | **Live SMS E2E** |
| AR-WS6-03 | Notify arbitrary text | P1 §5 | `handle-notify-customer-message.ts` | partial | blocked | Live E2E |
| AR-WS6-04 | Growth Luna reschedule | P1 §5 | `luna-turn.ts` | complete | blocked | Live Luna + Graph |
| AR-WS6-05 | M365 write-back | P1 §5 | `commit-reschedule.ts` | complete | blocked | **Prod PSTN/SMS cert** |
| AR-WS6-06 | Calendar reply routing | P2 §5 | `reminderDefaults` on connection | partial | unverified | |
| AR-WS6-07 | Customer/response search | P2 §5 | appointments `q` | partial | unverified | |
| AR-WS6-08 | Held ambiguous inbound | P1 §5 | held-inbound routes | partial | unverified | |
| AR-WS6-09 | Business useful with AI off | P1 §5 | plan capabilities | complete | partial | Feature gates |

---

## Workstream 7 — Billing and infrastructure

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS7-01 | Stripe catalog / checkout | P1 §6 | `ar-stripe-catalog.ts` | complete | blocked | Live Stripe smoke |
| AR-WS7-02 | Usage meters SMS/email/AI | P1 §6 | `ar-sms-usage.ts`, email/AI usage | partial | unverified | |
| AR-WS7-03 | Scheduler + workers running | P1 §6 | job handlers | partial | blocked | **Prod ops** |
| AR-WS7-04 | Telnyx delivery receipts | P1 §6 | dispatch + reconcile | complete | blocked | **Prod webhook trace** |
| AR-WS7-05 | STOP/HELP all plans | P1 §6 | compliance layer | complete | unverified | |
| AR-WS7-06 | Operational diagnostics | P1 §6 | overview + needs attention | partial | unverified | |

---

## Workstream 8 — Verification and certification

| ID | Requirement | Audit ref | Code paths | Impl | Verify | Evidence / blockers |
|----|-------------|-----------|------------|------|--------|---------------------|
| AR-WS8-01 | Eligibility unit tests | Audit §10 | `eligibility.test.ts` | complete | pass | in `test:appointment-reminders` |
| AR-WS8-02 | Phone + Luna unit tests | Audit §10 | `reminder-phone-extraction.test.ts` | complete | pass | in bundle |
| AR-WS8-03 | Operational pause tests | Audit §10 | `ar-operational-pause.test.ts` | complete | pass | in bundle |
| AR-WS8-04 | Full `npm run test:appointment-reminders` | Audit §10 | package.json | partial | unverified | Run full bundle in CI |
| AR-WS8-05 | Cold-tenant prod runbook PASS/FAIL | Audit §10 | `AR-LAUNCH-READINESS-NOW.md` | missing | blocked | **Manual prod execution** |
| AR-WS8-06 | Throughput 600 test | P1 blockers | `test-ar-reminder-throughput.ts` | partial | unverified | |
| AR-WS8-07 | V1 cert doc AR section | P1 §6 | `V1-PRODUCTION-CERTIFICATION.md` | missing | n/a | Process doc update pending |

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

---

*Update implementation and verification columns on every merge toward 100% applicable closure.*
