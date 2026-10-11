# Appointment Reminders — Full Launch Gap + Customer Experience Parity Audit

**Date:** 2026-10-11  
**Mode:** READ-ONLY — no implementation in this pass  
**Scope:** Existing Transovo Appointment Reminders vs. end-to-end customer journey (Outlook → phone → consent → reminders → responses). Not a booking platform expansion.

**Competitor references (behavioral, not feature-copy):**

- Primary: [Apptoto appointment reminders](https://www.apptoto.com/appointment-reminders/), [Apptoto support/FAQ](https://www.apptoto.com/support-faq)
- Cross-check: AppointmentReminder.com, GoReminders, Calendly notifications/SMS/consent, Cal.com workflows

**Implementation note:** Draft **PR #637** (workspace SMS consent, deterministic parser, mandatory Luna fallback on import) is treated as **implemented on branch, not production-certified** unless stated otherwise.

**Status legend (both audits):**

| Status | Meaning |
|--------|---------|
| **WORKING IN CODE** / **Already works** | Logic + unit/script evidence in repo |
| **PARTIAL** / **Partially works** | Implemented with known gaps |
| **MISSING** / **Missing** | No meaningful implementation |
| **UNVERIFIED** | Code exists; no signed production or CI proof |
| **Not applicable** | Out of scope for calendar-first Outlook SMS v1 |

---

# Part 1 — Full Functional Launch Gap Audit

## Method

Traced runtime paths under `src/lib/appointment-reminders/`, `src/lib/calendar/`, `src/lib/appointments/reminder-delivery.ts`, AR APIs, and job handlers; cross-checked `docs/AR-LAUNCH-GAP-INVENTORY-2026-10-10.md`, `docs/APPOINTMENT-REMINDERS-E2E-WIRING-AUDIT.md`, and competitor positioning.

---

## Part 1 — Executive summary

Transovo is **closest on calendar → appointment row → scheduled SMS → inbound C/R/X + Luna**. Gaps concentrate in **contact enrichment (Outlook contacts)**, **event eligibility (who should get an SMS at all)**, **production certification**, **commercial packaging**, and **operational proof**—not rebuilding the core scheduler.

**Journey vs. reality (final standard):**

| Step | Assessment |
|------|------------|
| Sign up + connect Outlook | **PARTIAL** — works with product-open/free; not a polished AR-only cold path |
| Select customer calendar | **WORKING IN CODE** |
| Auto import + phone (parser + Luna) | **PARTIAL** — on **#637 branch**; **UNVERIFIED** live; no Graph contact enrichment |
| See ready vs needs attention | **PARTIAL** — list + drawer; clearer after #637 |
| Certify consent + activate | **PARTIAL** — #637 + activate flow; grandfather quirks |
| Cancel/time change without duplicate SMS | **WORKING IN CODE** (generation/suppress) |
| Deliveries + paid responses | **UNVERIFIED** on production for **new** tenant |

---

## Part 1 — Section 1: Onboarding and activation

| Feature / behavior | Competitor ref | Transovo code path | Status | What happens today | What should happen | Severity | Smallest correction | Proof test |
|-------------------|----------------|-------------------|--------|-------------------|-------------------|----------|---------------------|------------|
| Cold signup → AR product access | Apptoto trial | `commercial/ar-workspace-plan.ts`, `entitlement.ts`, `GET /api/appointment-reminders/product-open`, `POST …/billing/free` | **PARTIAL** | Free/legacy paths; broad entitlements; AR pages load but APIs 403 until plan open | Dedicated AR signup → entitled workspace | **IMPORTANT** | Server redirect or gate AR routes until entitled | New workspace: product-open → setup connect |
| Microsoft calendar OAuth | Apptoto Outlook | `calendar-integrations-opus.tsx` (`appointment_reminders`), `connection-settings.ts` | **WORKING IN CODE** | M365 connect + save import calendars | Same | — | — | OAuth + save import IDs |
| Google for AR | Apptoto multi-calendar | `calendar-provider-policy.ts` (`AR_MICROSOFT_ONLY_CALENDAR` default true) | **PARTIAL** (by policy) | Google hidden/disabled for AR launch | M365-only OK if intentional | **POST-LAUNCH** | Document + env flag | Connect Google when flag off |
| Select import calendars | Apptoto calendar pick | PATCH connection `importCalendarIds`, readiness `hasImportCalendars` | **WORKING IN CODE** | Blocker until ≥1 calendar | Same | — | — | Setup status GET |
| Initial sync required | — | `activation.ts` (`!lastSyncAt` blocker), `ensure-calendars-synced.ts` | **PARTIAL** | Sync on setup status GET / manual sync; not automatic right after OAuth alone | Auto first sync after calendar save | **IMPORTANT** | Enqueue sync on import-calendar save | Activate without manual sync step |
| Workspace SMS consent (one-time) | Apptoto SMS consent | **#637:** `workspace-existing-sms-consent.ts`, `setup/existing-sms-consent`, `sms-eligibility.ts` | **WORKING IN CODE** (branch) / **UNVERIFIED** (prod) | Attestation on platform config; blocks new activation when SMS on; grandfather for already-activated | Business certifies once, not per appointment | **LAUNCH BLOCKER** (merge + cert) | Merge #637; one signed cold-tenant activation | `sms-eligibility.test.ts` + setup POST consent + send |
| Explicit activation record | — | `activation.ts`, `solutionSetup` `appointment-reminders-product` | **PARTIAL** | POST activate sets `activatedAt`; **grandfather:** `workspaceRemindersOperational()` allows sends without row if `canActivate` | Explicit activate for audit | **IMPORTANT** | Remove or narrow grandfather if GTM requires click | Workspace with readiness but no POST → no sends |
| SMS sender readiness UI | — | `ar-sms-readiness.ts` + `activation.ts` | **WORKING IN CODE** | Platform toll-free via `resolveAppointmentOutboundSmsRoute` | Truthful sender + allowance | — | — | `ar-prod-diagnose-appointment-send.ts` |
| SMS monthly allowance at send | GoReminders plans | `ar-sms-usage.ts`, `resolveArMonthlySmsLimit` | **PARTIAL** | Metering active; limit can be **0** → block at send | Non-zero trial/plan on new workspaces | **LAUNCH BLOCKER** | Prod config: trial messages / plan limits | Send after `reserveArReminderSmsUnit` |
| Email readiness | Apptoto email | `ar-email-readiness.ts` | **UNVERIFIED** | Blocks activation only if email steps enabled | Brevo live if email in sequence | **IMPORTANT** if email sold | SMS-first launch or certify Brevo | One live email + tracking |
| Configure sequence / preview | Apptoto templates | `ar-setup-configure-panel.tsx`, `PATCH …/settings`, `GET …/reminders/test` | **WORKING IN CODE** | Defaults + preview; configure step can skip save | Save before activate (optional) | **POST-LAUNCH** | Gate continue on save | Settings patch + preview |
| Test SMS before activate | Apptoto test reminder | `sendTestReminderSms` in `reminder-delivery.ts` | **PARTIAL** | Admin test send; **no** activation/consent gate | Optional: require attestation | **POST-LAUNCH** | Document or gate | Test route with dev workspace |
| No customer messages pre-activation | — | `workspaceRemindersOperational`, `reminder-discovery.ts`, `maybeSendImmediateConfirmation` | **PARTIAL** | Discovery skips non-operational; **grandfather** can send without `activatedAt` | No automated customer SMS until intentional go-live | **LAUNCH BLOCKER** (policy) | Decide grandfather vs strict activate | New tenant E2E without activate |

---

## Part 1 — Section 2: Calendar ingestion

| Feature / behavior | Competitor ref | Code path | Status | Today | Should | Severity | Fix | Test |
|-------------------|----------------|-----------|--------|-------|--------|----------|-----|------|
| Initial + incremental import | Apptoto sync | `import-sync.ts`, `microsoft-delta-sync.ts` | **WORKING IN CODE** | Delta + list fallback; checkpoint on success | Same | — | — | `ar-calendar-microsoft-production-lifecycle-e2e.ts` (manual) |
| Webhook + reconcile backstop | — | `webhooks.ts`, `microsoft-reconcile-discovery.ts`, `reconcile.ts` | **WORKING IN CODE** / **PARTIAL** | `me/events` subscription; webhook may not scope calendarId perfectly | Reliable sync within minutes | **IMPORTANT** | Webhook calendar scoping audit | `ar-calendar-microsoft-webhook-e2e.ts` |
| Cancel / delete | Apptoto | `applyImportedAppointmentLifecycle`, delta `@removed` | **WORKING IN CODE** | Suppress reminders on cancel | Same | — | — | Lifecycle E2E delete |
| Reschedule time change | — | `resetAppointmentReminders` on time change | **WORKING IN CODE** | Bumps `reminderGeneration` | Same | — | — | Import update time → new generation |
| Recurring instances | — | Google `singleEvents`; Graph `calendarView` | **WORKING IN CODE** | Per-occurrence rows | Same | — | — | Recurring series import |
| Timezones / all-day | — | `graph-helpers`, `providers.ts` | **WORKING IN CODE** | Parsed + stored | Same | — | — | All-day eligibility test |
| **Which events get SMS** (rules) | Apptoto rule-based | `eligibility.ts` `isEventEligibleForReminderImport` | **WORKING IN CODE** | External attendee, title excludes, skip all-day for SMS; mirror vs SMS split | Client appointments not staff blocks | **IMPORTANT** | `showAs` free / organizer-only rules if needed | `eligibility.test.ts` + `ar-calendar-prod-list-skips.ts` |
| Phone not required at eligibility | — | Eligibility does **not** check phone | **PARTIAL** | Event imported; SMS fails later | Loud “needs phone” on list | **IMPORTANT** | Phone column + Luna (#637) | Appointments filter `needs_attention` |
| Multi-calendar | Apptoto | Per `importCalendarIds` loop | **WORKING IN CODE** | Separate delta per calendar | Same | — | — | Two calendars import |
| Google pagination 250 cap | — | `listGoogleCalendarEvents` | **PARTIAL** | Single page | Full pagination if Google enabled | **POST-LAUNCH** | Pagination | Large calendar import |
| Graph extended/custom fields | Apptoto CRM fields | — | **MISSING** | Only subject, body, location, attendees in map | Use extensions if customers store phone there | **POST-LAUNCH** | Graph select extensions | Event with custom field |
| Shared/delegated mailbox | — | — | **MISSING** / **UNVERIFIED** | `me/events` only | Supported tenant types | **POST-LAUNCH** | Permissions doc | Delegated mailbox smoke |

---

## Part 1 — Section 3: Customer contact resolution

| Feature / behavior | Competitor ref | Code path | Status | Today | Should | Severity | Fix | Test |
|-------------------|----------------|-----------|--------|-------|--------|----------|-----|------|
| Parser on import/update | Apptoto extract | **#637:** `reminder-phone-extraction.ts`, `import-sync.ts` `buildImportMetadata` | **WORKING IN CODE** (branch) | Labels, single candidate, multi → uncertain | Deterministic first | **LAUNCH BLOCKER** (merge) | Merge #637 | `reminder-phone-extraction.test.ts` |
| **Luna mandatory fallback** | AI disambiguation | **#637:** `reminder-phone-luna.ts`, `resolveReminderPhoneWithLunaFallback` | **WORKING IN CODE** (branch) / **UNVERIFIED** (live Luna) | Runs on missing/ambiguous; validates against source text | Parser → Luna → save; never at dispatch | **LAUNCH BLOCKER** | Merge + prod OpenAI + spot-check | Mock tests + live Luna pattern |
| Fingerprint / no repeat Luna | — | `reminderPhoneRelevantFingerprint`, `lunaAttemptedAt` | **WORKING IN CODE** (branch) | Skip re-extract when unchanged | Same | **IMPORTANT** | — | Unchanged event sync twice |
| Manual phone correction | Apptoto contact prefs | `PATCH …/reminder-contact`, `appointment-detail-drawer.tsx` | **PARTIAL** | Saves `reminderOverride` + `inviteePhone`; merge treats override as lock | Staff fix + preserve on sync | **IMPORTANT** | Set `reminderPhoneUserLocked` explicitly on PATCH | PATCH then re-sync |
| Outlook **Contacts** / People API | Apptoto address book | `attendee-contact.ts` → CRM by **email only** | **MISSING** (Graph contacts) | No Graph contact lookup by name | Optional enrichment when event has name only | **POST-LAUNCH** (Part 2: **Critical**) | Graph contacts scope + match | Event with phone in Outlook contact only |
| Name-only events (no email) | — | `resolveContactForImportedEvent` | **PARTIAL** | Phone can come from event text via parser/Luna | Phone without email OK for SMS | **IMPORTANT** | Parser/Luna path doesn’t require email | Import event phone in body, no attendee |
| `needs_review` UI | — | `appointments-page.tsx`, `sms-eligibility` `phone_needs_review` | **PARTIAL** (branch) | Column + blocked SMS | Clear “confirm phone” | **IMPORTANT** | Drawer prominence | UI + eligibility |
| Dispatch never parses | — | `reminder-delivery.ts` uses stored phone | **WORKING IN CODE** | No parser/AI at send | Same | — | — | Code review + dispatch test |
| CRM phone overrides extraction | Apptoto contact record | `mergeReminderPhoneOnImport` prefers `contactPhone` | **PARTIAL** | Contact phone wins when present | CRM phone when authoritative | **POST-LAUNCH** | Document precedence | Contact with phone + event text |

---

## Part 1 — Section 4: Reminder scheduling and delivery

| Feature / behavior | Competitor ref | Code path | Status | Today | Should | Severity | Fix | Test |
|-------------------|----------------|-----------|--------|-------|--------|----------|-----|------|
| Scheduled scan → enqueue | — | `reminder-discovery.ts`, job `appointments_platform_reminder_scan` | **WORKING IN CODE** / **UNVERIFIED** (prod scheduler) | 4‑min due window, generation idempotency | Timely sends at scale | **LAUNCH BLOCKER** | Prod scheduler + workers healthy | `test-ar-reminder-throughput.ts` |
| Quiet hours / send windows | GoReminders | `reminder-send-time-policy.ts`, `reminder-effective-fire-time.ts` | **WORKING IN CODE** | Defer/suppress outside window | Same | — | — | `reminder-send-time-policy.test.ts` |
| Sequence steps | Apptoto multi-touch | `reminder-engine.ts`, platform config | **WORKING IN CODE** | Configurable steps | Same | — | — | Settings + timeline API |
| Cancel suppresses queued intent | — | `suppressAppointmentReminders` | **WORKING IN CODE** | Metadata suppress + generation | Same | — | — | Cancel import → no send |
| Reschedule invalidates old generation | — | `resetAppointmentReminders` | **WORKING IN CODE** | Stale jobs suppressed at execute | Same | — | — | `stale_generation` in executor |
| SMS send + platform session | — | `trySendStep`, `outbound-reminder.ts` | **WORKING IN CODE** / **UNVERIFIED** live | Eligibility recheck at send | One live SMS on new tenant | **LAUNCH BLOCKER** | Prod cert script | `ar-prod-microsoft-2h-reminder-live.ts` |
| Delivery receipts | Apptoto tracking | `arReminderDispatch`, `delivery-status.ts` | **WORKING IN CODE** / **UNVERIFIED** | Telnyx reconcile path | `delivered` in UI/logs | **LAUNCH BLOCKER** | One prod webhook trace | Dispatch row → delivered |
| Email + ICS | Apptoto email | `sendReminderEmailWithTracking` | **UNVERIFIED** | Implemented | If product promises email | **IMPORTANT** | Brevo cert | Live email step |
| STOP / opt-out | Apptoto compliance | `sms-eligibility`, platform compliance inbound | **WORKING IN CODE** | Pre-send + compliance layer | Same | — | — | `sms-eligibility.test.ts` + STOP inbound |
| Wrong recipient prevention | — | Eligibility + Luna validation (#637) | **PARTIAL** | Multi-number → review/block | Never guess wrong number | **LAUNCH BLOCKER** | Merge #637 + manual review UX | Ambiguous event matrix |
| Segment metering | — | `ar-sms-usage.ts` | **WORKING IN CODE** | Reserve/release units | Same | — | — | `ar-sms-usage-reserve.test.ts` |

---

## Part 1 — Section 5: Customer responses

| Feature / behavior | Competitor ref | Code path | Status | Today | Should | Severity | Fix | Test |
|-------------------|----------------|-----------|--------|-------|--------|----------|-----|------|
| Free plan: no auto two-way | — | `workspaceAllowsSmsCustomerResponses` | **WORKING IN CODE** | Inbound not auto-handled on free | Same | — | — | Free inbound smoke |
| Starter C/R/X | Apptoto confirm/cancel | `inbound-replies.ts`, `handle-inbound-body.ts` | **WORKING IN CODE** / **UNVERIFIED** | Letter replies + policy ack | Paid plan live proof | **LAUNCH BLOCKER** (if selling Starter) | `test-ar-ws1-live-sms-crx-e2e.ts` |
| Growth Luna reschedule | Apptoto + AI | `luna-turn.ts`, `inbound-follow-up.ts` | **WORKING IN CODE** / **UNVERIFIED** | Tool loop + commit | Metered AI on paid | **IMPORTANT** | Live Luna cert | `test-ar-sms-luna-conversation-e2e.ts` |
| Calendar write-back (M365) | Apptoto calendar update | `commit-reschedule.ts`, `provider-mutations.ts` | **WORKING IN CODE** / **UNVERIFIED** | Patch/cancel provider | SMS reschedule updates Outlook | **LAUNCH BLOCKER** (if promised) | Prod write-back smoke | Live R → Graph time change |
| Staff notify (notify mode) | Apptoto staff alerts | `handle-notify-customer-message.ts` | **PARTIAL** / **UNVERIFIED** | Records; notify path | Staff sees arbitrary text | **IMPORTANT** | E2E notify mode | Inbound free text → notification |
| Duplicate outbound guard | — | Session seeding, idempotency | **WORKING IN CODE** | Generation + dispatch keys | No double replies | **IMPORTANT** | — | Concurrency tests |
| Held / ambiguous shared TF | — | `ambiguous_workspace` routing | **PARTIAL** | Held inbound path | Runbook for shared sender | **POST-LAUNCH** | Support docs | Multi-tenant TF test |

---

## Part 1 — Section 6: Operations and billing

| Feature / behavior | Competitor ref | Code path | Status | Today | Should | Severity | Fix | Test |
|-------------------|----------------|-----------|--------|-------|--------|----------|-----|------|
| Appointments / Responses / Reminders log UI | — | Opus pages + loaders | **WORKING IN CODE** | Operational surfaces exist | Same | — | — | Browser cert scripts |
| Overview readiness | — | `load-ar-overview.ts` | **WORKING IN CODE** | KPIs + block hints | Same | — | — | Overview load |
| Analytics | Apptoto reporting | AR analytics page | **PARTIAL** | Thin vs competitors | Core funnel metrics | **POST-LAUNCH** | — | — |
| Stripe checkout / plans | — | `commercial/stripe-checkout.ts`, `ar-stripe-catalog` | **WORKING IN CODE** / **UNVERIFIED** | Catalog + checkout routes | AR-only buyer can pay | **LAUNCH BLOCKER** (standalone SKU) | One checkout → entitled → remind | `verify-ar-stripe-catalog.ts` + live checkout |
| Usage counters vs limits | — | `ar-sms-usage`, email usage | **PARTIAL** | Code paths; limits config-dependent | UI matches runtime | **IMPORTANT** | Plan header accuracy | Billing concurrency script |
| Workers / observability | — | `job-handlers.ts`, pipeline logs | **UNVERIFIED** | Jobs defined | Scan + dispatch + inbound processed in prod | **LAUNCH BLOCKER** | Ops dashboard / queue depth | Prod job metrics |
| AR in V1 cert gate | — | `V1-PRODUCTION-CERTIFICATION.md` | **MISSING** | MCTB/Fax only | AR launch checklist signed | **LAUNCH BLOCKER** (process) | Add AR section to cert doc | One signed runbook PASS |
| `npm run test:appointment-reminders` | — | `package.json` | **PARTIAL** | Many unit tests; phone/Luna tests not in bundle (#637) | Include new tests in CI | **IMPORTANT** | Add extraction tests to script | Full npm script green |

---

## Part 1 — Missing code vs. untested code (summary)

| Area | Mostly missing | Mostly built but untested |
|------|----------------|---------------------------|
| Consent + phone foundation | Graph contacts; custom Graph fields | **#637** Luna live; consent on cold tenant prod |
| Calendar ingestion | Delegated mailbox; extensions | Webhook E2E at scale; Google pagination |
| Scheduling/delivery | — | Live SMS/email/webhook; throughput 600; scheduler ops |
| Responses | — | C/R/X live; Luna live; M365 write-back |
| Billing/ops | AR row in V1 cert doc | Stripe checkout on clean buyer; analytics |

---

## Part 1 — Prioritized launch blockers

1. **Merge and certify foundational phone pipeline** — workspace consent + parser + **mandatory Luna** + import-only persistence (**PR #637**). Prove on real Outlook samples (labeled, ambiguous, missing, office-labeled).
2. **One signed AR production runbook** — new workspace: M365 → import → sync → attest → activate → **one SMS** with Telnyx **delivered** → inbound **C/R/X** (plan tier under test). Not covered by `V1-PRODUCTION-CERTIFICATION.md` today.
3. **Production scheduler + workers** — `appointments_platform_reminder_scan`, `ar_dispatch_reminder`, `ar_process_inbound_sms` running on interval with evidence.
4. **Non-zero SMS allowance** for new workspaces when metering is on (`reserveArReminderSmsUnit` / plan trial).
5. **Platform SMS sender** available in prod (`evaluateArSmsOutboundReadiness`).
6. **Policy decision: activation grandfather** — sends allowed without `activatedAt` when readiness passes; conflicts with strict “activate before any customer SMS.”
7. **Wrong-number risk** — until #637 is live, ambiguous multi-number events stay **needs_review** (good); Luna path must be certified, not only unit-tested.
8. **Standalone AR commercial path** — Stripe + entitlement for buyers who are not MCTB/voice bundle (**PARTIAL**).
9. **Microsoft write-back** after SMS reschedule — if marketed, needs live proof (**UNVERIFIED**).
10. **Initial sync friction** — activation blocked without `lastSyncAt`; businesses may stall before first reminder.

---

## Part 1 — Post-launch list

- **Outlook Graph Contacts / People** matching when phone is not in event body (Apptoto-style contact sync).
- **Rule refinements:** `showAs` free/tentative, organizer-only meetings, per-calendar rule sets.
- **Graph extended properties** for custom `customer_phone` fields.
- **Google calendar** full support if `AR_MICROSOFT_ONLY_CALENDAR` is relaxed.
- **Setup discoverability** (setup not in primary AR nav; overview CTAs).
- **Configure-step save gate** and **test SMS** consent/activation alignment.
- **Customer analytics** depth, industry presets, CSV import as primary onboarding, iCloud.
- **Webhook calendar scoping** hardening for multi-calendar tenants.
- **Stale dispatch job cleanup** (noise only; `stale_generation` is safe).
- **Explicit `reminderPhoneUserLocked`** on staff save API for clearer audit trail.
- Add **phone/Luna tests** to `npm run test:appointment-reminders`.

---

## Part 1 — Competitor takeaway (Apptoto-led)

Apptoto’s public story matches audit pillars: **pull appointments from calendar**, **extract/match phone**, **rule-based who gets reminded**, **consent**, **multi-channel sends**, **two-way confirm/reschedule**. Transovo is **closest on calendar → appointment row → scheduled SMS → inbound C/R/X + Luna**, with gaps in **contact enrichment**, **production certification**, **commercial packaging**, and **operational proof**.

---

## Part 1 — Recommended next step (when implementing)

Turn launch blockers 1–3 into a single **certification runbook** (checklist + scripts in `scripts/ar-prod-*` and `docs/AR-LAUNCH-READINESS-NOW.md`), run on a clean tenant after **#637** merges, record PASS/FAIL per row—not new features until blockers are green or explicitly deferred.

---

# Part 2 — Customer Experience Parity Audit (Addendum)

Read-only pass focused on additional gaps (participant model, reminder controls, staff ops), ranked by **customer impact**. Builds on Part 1.

---

## Part 2 — The overlooked question (answer first)

**What qualifies an Outlook event for automatic SMS?**

Today, eligibility is **`isEventEligibleForReminderImport`** in `src/lib/calendar/eligibility.ts`, applied at import into `metadata.reminderSmsEligible` (separate from calendar **mirror**).

| Rule (default) | Effect |
|----------------|--------|
| `skipAllDay` | All-day → not SMS-eligible |
| Title blocklist (OOO, lunch, focus, personal, …) + custom excludes/includes | Blocks many internal blocks |
| `requireExternalAttendees: true` | Needs ≥1 attendee email ≠ mailbox owner, not `declined` |
| Transovo-originated | Excluded |

**What this does *not* do (Apptoto-style gaps):**

- **No “I am the organizer” / “skip events organized by others”** — if you are an attendee on a colleague’s meeting that includes an external client, the event can still be SMS-eligible.
- **No `showAs: free` / tentative** for reminders (busy filtering exists elsewhere for availability, not reminder eligibility).
- **No “customer appointment” vs “internal meeting”** by domain — any non-self attendee email counts as “external,” so **all-staff meetings can be SMS-eligible** if a phone appears in the event.
- **No phone required at eligibility** — a valid number in the body can still mark an event eligible; send fails or needs attention later.
- **`requireExternalAttendees: false`** (configurable in calendar integrations UI) → **solo calendar entries with a phone in text could get SMS** without a participant model.

**Verdict:** **Partially works** — strong default for “must have external attendee,” weak for “only *my* customer appointments.” This is likely the next **“How did we forget that?”** class of bug: **parser + Luna + consent can all pass on the wrong *class* of event.**

**Proof test:** Connect main calendar; create (1) coworker invite with client, (2) internal staff-only meeting with phone in notes, (3) solo block with phone in title — record `reminderSmsEligible` and whether discovery enqueues.

**Smallest correction (conceptual):** Organizer/self-role rules + optional “organizer must be mailbox owner” + `showAs` + same-domain internal attendee policy — **before** more template polish.

---

## Part 2 — Priority area 1: Event eligibility

| Behavior | Apptoto ref | Transovo path | Parity | Limitation / N/A | Impact | Proof |
|----------|-------------|---------------|--------|------------------|--------|-------|
| External attendee required (default) | Client vs internal | `eligibility.ts`, `eligibility.test.ts` | **Already works** | Solo events mirrored but not SMS-eligible | High | Vitest mirror vs reminder |
| Declined attendees excluded | Don’t text declined | `externalAttendees` filters `declined` | **Already works** | Only at attendee list, not “meeting declined” | Critical | Import event with declined guest |
| Title / OOO exclusions | Skip internal | `DEFAULT_TITLE_EXCLUDES` + UI patterns | **Partially works** | Keyword-only; easy to mis-title | Important | Custom title not in list |
| Organizer-is-me / not organized by others | Skip coworker invites | — | **Missing** | Colleague-organized + client still eligible | **Critical** | Scripted Graph fixtures |
| Free/tentative (`showAs`) | Skip non-appointments | Parsed on events, **not** in eligibility | **Missing** | Free busy blocks can import for SMS | Important | `showAs: free` event |
| Phone not required to qualify | — | Eligibility ignores phone | **Partially works** | By design; UI shows needs attention later | Important | Import eligible, no phone |
| Which calendar | Per-calendar rules | `importCalendarIds` only | **Partially works** | Same `importRules` for all calendars | Table stakes | Two calendars different rules |
| Recurring exception cancel | One occurrence | Delta + per-instance id | **Already works** | Instance-level rows | Critical | Cancel one occurrence E2E |
| Wrong time after edit | No stale SMS | `resetAppointmentReminders` + generation | **Already works** | Stale jobs suppressed, not deleted | Critical | Reschedule import + generation |
| Transovo booking vs import | — | `transovo_originated` skip | **Already works** | N/A for pure Outlook | — | — |

---

## Part 2 — Priority area 2: Recipient / contact resolution

| Behavior | Apptoto ref | Transovo path | Parity | Limitation | Impact | Proof |
|----------|-------------|---------------|--------|------------|--------|-------|
| Parser from event fields | Extract from body | `reminder-phone-extraction.ts` (#637) | **Already works** (branch) | Not prod-certified | High | Unit tests |
| Luna when parser uncertain | AI on messy text | `reminder-phone-luna.ts` (#637) | **Partially works** | Cannot invent; needs API; not in `npm run test:appointment-reminders` | High | Mock + live Luna sample |
| **Outlook Contacts / address book** | Retrieve missing numbers | — | **Missing** | Luna only reads **event** text | **Critical** | Graph People with phone off-event |
| Exclude business/staff numbers | Don’t text employees | `OFFICE_LABEL_RE` in parser; Luna `number_role` | **Partially works** | **Eligibility** still allows staff-only meetings; office label only in parser | **Critical** | Internal meeting + mobile in notes |
| Customer name / `first_name` | Personalization | `inviteeName` from primary attendee; `appointmentMergeVars` | **Partially works** | Name from title/Luna not first-class; `staff_name` null on import | High | Template preview vs import |
| Multiple customers / group | Multiple recipients | `extraRecipients` in types only | **Missing** for calendar import | One primary attendee + one SMS thread | Table stakes (salon/class) | Group event |
| Customer prefers email not SMS | Channel preference | `recipientNotificationChannel`, `emailOnly`, `smsCapable` | **Partially works** | Drawer can set; import defaults from contact phone presence | Critical (regulated) | PATCH prefs + eligibility |
| Manual correction | Fix without Outlook | `PATCH …/reminder-contact`, drawer | **Partially works** | Override locks re-extract via `reminderOverride.phone`; no explicit `reminderPhoneUserLocked` flag set | High | PATCH + re-sync |
| Same customer across appointments | Contact continuity | `attendee-contact.ts` → CRM by email, `contactId` on row | **Partially works** | No email → weak linking; phone-only identity thin | Table stakes | Two imports same email |
| Contact-level suppression | Don’t rediscover STOP | Per-appointment `smsOptOut` / eligibility; platform STOP | **Partially works** | STOP honored at send; **new** appointments may re-import same number unless metadata/contact updated | **Critical** | STOP then new import same phone |
| Participant model (not just E.164) | Apptoto participant | Phone + optional contact row | **Partially works** | Participant ≈ primary attendee + optional CRM contact | High | — |

**Key finding:** Luna is **complementary**, not a substitute for **Graph contact lookup** — there is **no** `src/lib/calendar` Graph contacts integration.

---

## Part 2 — Customer and recipient management (expanded table)

| Behavior | Why it matters | Priority | Parity | Transovo path / notes |
|----------|----------------|----------|--------|------------------------|
| Outlook contacts lookup | Recover numbers absent from the event | High | **Missing** | No Graph People/Contacts read |
| Customer name extraction | Personalize + identify recipient | High | **Partially works** | Primary attendee name; weak title-only |
| Exclude business/staff phone numbers | Prevent texting employees | Critical | **Partially works** | Parser/Luna only; eligibility gap on internal meetings |
| Multiple customers on one appointment | Group appointments | Table stakes | **Missing** | Single primary recipient |
| Customer-level SMS preference | Email vs SMS | Critical | **Partially works** | Metadata + drawer PATCH |
| Manual customer correction | Fix without editing Outlook | High | **Partially works** | `reminder-contact` API + drawer |
| Same customer across appointments | Continuity | Table stakes | **Partially works** | CRM link by email |
| Contact-level suppression/exclusion | Don’t rediscover blocked numbers | Critical | **Partially works** | STOP at send; re-import risk |

---

## Part 2 — Priority area 3: Reminder lifecycle controls

| Behavior | Competitor | Transovo path | Parity | Limitation | Impact | Proof |
|----------|------------|---------------|--------|------------|--------|-------|
| Skip one appointment | Per-appt exclude | `suppressAppointmentReminders` in `reminder-state.ts` | **Partially works** | **AR UI/API** — no suppress in `appointment-detail-drawer` or AR `PATCH …/appointments/[id]` (exists in legacy Appointments Kimi detail) | Table stakes | API suppress + discovery skip |
| Pause all reminders | Business pause | — for AR workspace | **Missing** | MCTB has recovery pause; **no AR global pause** | Table stakes | — |
| Immediate confirmation on book/import | Booking message | `maybeSendImmediateConfirmationForAppointment` on **new** import | **Already works** | Only if `reminderSmsEligible` + operational; historical skip pref | Table stakes | New import smoke |
| Don’t repeat confirmation | Stop after confirm | `reminder-confirmation-guard.ts`, `skipConfirmationStepsWhenConfirmed` | **Already works** | Workspace default on; per-step `skipIfAppointmentConfirmed` | Table stakes | `reminder-confirmation-guard.test.ts` |
| Pending reminders before send | Staff review queue | `reminders-page.tsx`, `reminders-log-query.ts` future rows | **Partially works** | Operational list, not “approve before send” gate | High | Reminders horizon UI |
| Cancel/reschedule cutoff (SMS actions) | Customer cutoff | `reschedule-sms-cutoff.ts`, AI policy | **Partially works** | SMS **reply** cutoff; not “don’t send reminder within X of start” | Table stakes | Cutoff unit tests |
| Arrival windows (2–4 hr) | AppointmentReminders.com | `appointment_time` single instant | **Missing** | `{{staff_name}}` unused on calendar import | Industry-specific | — |
| Recurring exceptions | Series safety | Per-instance external ids | **Already works** | — | Critical | Lifecycle E2E |
| No outdated reminders after edit | — | `resetAppointmentReminders` | **Already works** | UNVERIFIED at prod scale | Critical | Time change import |
| Don’t send before activation | — | `workspaceRemindersOperational`, discovery | **Partially works** | Grandfather without `activatedAt` | Critical | New tenant policy test |
| STOP/HELP | — | Platform compliance + eligibility | **Already works** | UNVERIFIED live | Critical | Inbound STOP |

### Reminder behavior and controls (expanded table)

| Behavior | Why it matters | Priority | Parity |
|----------|----------------|----------|--------|
| Skip a specific appointment | Staff opt-out per event | Table stakes | **Partially works** (engine yes, AR UI missing) |
| Pause all reminders | Business closure | Table stakes | **Missing** |
| Send immediately after booking | Confirmation | Table stakes | **Already works** (new import) |
| Don’t repeat confirmation requests | Avoid noise | Table stakes | **Already works** |
| Show pending reminders before sending | Catch wrong numbers/dates | High | **Partially works** |
| Cancellation/rescheduling cutoff | Protect operations | Table stakes | **Partially works** (SMS reply cutoff) |
| Support arrival windows | Home services | Industry-specific | **Missing** |
| Handle recurring-event exceptions | One cancel ≠ whole series | Critical | **Already works** |
| Don’t send to declined meetings | Not every invite is a customer appt | Critical | **Partially works** (declined attendee filtered, not full meeting decline semantics) |
| Don’t send outdated reminders after edit | Wrong date/time | Critical | **Already works** (code) |

---

## Part 2 — Priority area 4: Message customization

| Behavior | Competitor | Transovo path | Parity | Limitation | Impact | Proof |
|----------|------------|---------------|--------|------------|--------|-------|
| Business name in SMS | Branding | Platform config `businessName`, templates | **Already works** | Must be configured in settings | Critical | Preview/send |
| Location / address | Directions | `metadata.location`, `businessAddress`, `directions_link` | **Partially works** | Calendar `locationDisplay` → verify merge path | Table stakes | Import with location |
| Staff / provider | Who they meet | `{{staff_name}}` in `appointmentMergeVars` | **Partially works** | `staffName: null` on calendar import | Table stakes | — |
| Template variables | Merge fields | `reminderAppointmentMergeVars`, template library | **Already works** | Platform-locked SMS on paid tiers | High | `platform-template-policy.test.ts` |
| Preview with **real** appointment | Catch gaps | Settings test `GET …/reminders/test`; configure panel uses **sample** vars | **Partially works** | Not always same row as production send | High | Preview from drawer with real id |
| Failed delivery visibility | Alerts | Reminders log, analytics `failed`, overview | **Partially works** | **No proactive staff alert** | High | Dispatch `failed` row |
| Export history | Records | CSV **import** exists; export API | **Missing** for AR export | Import route only | Later | — |

### Staff and business operations (expanded table)

| Behavior | Why it matters | Priority | Parity |
|----------|----------------|----------|--------|
| Multiple staff logins | Ten calendars / employees | Table stakes | **Partially works** (workspace roles) |
| Calendar-specific notification routing | Replies to owner | Table stakes | **Partially works** (`replyDestination*` on connection) |
| Business information in reminders | Recognition | Critical | **Already works** (config) |
| Location/address variables | Wrong location | Table stakes | **Partially works** |
| Staff/provider variables | Who they’re meeting | Table stakes | **Partially works** (`staff_name` empty on import) |
| Reminder preview with real appointment data | Catch gaps | High | **Partially works** |
| Failed-delivery alerts | Ops awareness | High | **Partially works** (logs only) |
| Exportable history | Troubleshooting | Useful | **Missing** export |
| Contact/customer search | Volume | Table stakes | **Partially works** |

---

## Part 2 — Priority area 5: Multi-calendar / staff operations

| Behavior | Competitor | Transovo path | Parity | Limitation | Impact | Proof |
|----------|------------|---------------|--------|------------|--------|-------|
| Multiple staff logins | Apptoto users | Workspace users + `permissions.ts` / granular roles | **Partially works** | One workspace shares AR config | Table stakes ($19/$39) | Role matrix |
| Calendar-specific reply routing | Owner gets reply | `reminderDefaults.replyDestinationPhone/Email` on connection in `calendar-integrations-opus.tsx` | **Partially works** | Inbound routing UNVERIFIED E2E | Table stakes | Inbound + connection config |
| Ten calendars = ten employees | — | Multi `importCalendarIds` | **Partially works** | No per-calendar staff identity in messages | Table stakes | — |
| Customer / message search | Find person | Appointments `q` filter, Responses | **Partially works** | Not unified contact inbox | Table stakes | Search UI |
| Held inbound (ambiguous sender) | — | `held-inbound` routes | **Partially works** | Shared platform TF | Important | Held queue |

---

## Part 2 — Three priority tiers (mapped)

### Critical — must be proven before launch

| Item | Parity today | Notes |
|------|----------------|-------|
| Correct **customer** identification | **Partial** | Parser + Luna (#637); **no** Outlook contacts; staff/internal meeting gap |
| Consent + suppression | **Partial** | Workspace attestation (#637); STOP at send; cross-appointment suppression weak |
| Exclude internal / wrong events | **Partial** | External attendee default good; **not** organizer/showAs/domain/internal staff |
| Cancel / reschedule / recurring | **Already works** (code) | Prod E2E UNVERIFIED |
| Duplicate prevention | **Already works** | Generation + dispatch idempotency |
| Time zones | **Already works** (code) | Certify DST edge cases |
| No send before activation | **Partial** | Grandfather path |
| STOP/HELP | **Already works** (code) | Live cert |

### Table stakes — customers will look for these

| Item | Parity |
|------|--------|
| Manual recipient correction | **Partial** (API + drawer; no suppress toggle in AR drawer) |
| Confirmation stop / immediate confirm | **Already works** |
| Per-appointment skip | **Partial** (engine yes, AR UI **missing**) |
| Reminder preview | **Partial** |
| Failed delivery visibility | **Partial** (logs, not alerts) |
| Team / multi-calendar | **Partial** |
| Customer history | **Partial** (appointments + responses, not Apptoto-grade CRM) |

### Later — don’t confuse with launch readiness

Voice reminders as primary, multilingual campaigns, CSV as **primary** onboarding, workflow builders, marketing campaigns, unlimited calendars marketing — mostly **Not applicable** or **Missing by intent** for v1 Outlook SMS.

---

## Part 2 — Recommended next audit work (no build yet)

1. **Event eligibility matrix (scripted)** — 15–20 synthetic Graph event shapes → expected `reminderSmsEligible` + whether SMS should fire (product-defined). Include Apptoto “organized by others” and all-hands internal.
2. **Recipient resolution matrix** — event-only phone vs Outlook contact vs manual override vs STOP on prior thread.
3. **Lifecycle script** — import → immediate confirm → 24h step → edit time → cancel occurrence → assert dispatch states.
4. **Certification runbook** — fold into one PASS/FAIL doc (extends `AR-LAUNCH-READINESS-NOW.md`).

---

## Part 2 — Bottom line

- **Luna (#637)** improves **messy event text**; it does **not** replace **Outlook contact lookup** (**missing**).
- The largest structural gap is **eligibility**: *having a customer phone and consent does not mean the event should get an SMS.* Transovo’s default (`requireExternalAttendees`) helps but **does not match Apptoto’s organizer/participant semantics** or internal-meeting safety.
- Next audit/implementation effort should prioritize **event eligibility + contact resolution**, then lifecycle controls UI, then message/staff polish — aligned with “connect Outlook, find the right customer, send the right reminder, manage the response.”

**Suggested implementation sequence (when ready):**

1. Eligibility rules + tests  
2. Graph contact enrichment (read-only phone)  
3. AR UI for per-appointment suppress + failed-send surfacing  

---

## Key file index (both audits)

| Area | Primary files |
|------|----------------|
| Entitlement / billing | `entitlement.ts`, `commercial/ar-workspace-plan.ts`, `commercial/stripe-checkout.ts` |
| Setup / activation | `activation.ts`, `setup-pages.tsx`, `api/appointment-reminders/setup/*` |
| Consent | `workspace-existing-sms-consent.ts`, `sms-eligibility.ts` |
| Calendar import | `import-sync.ts`, `microsoft-delta-sync.ts`, `eligibility.ts` |
| Phone discovery | `calendar/reminder-phone-extraction.ts`, `reminder-phone-luna.ts` (#637) |
| Contact on import | `attendee-contact.ts` |
| Scheduling | `reminder-discovery.ts`, `reminder-dispatch-executor.ts`, `reminder-effective-fire-time.ts`, `reminder-send-time-policy.ts` |
| Delivery | `reminder-delivery.ts`, `ar-sms-usage.ts` |
| Inbound / C/R/X / Luna | `handle-inbound-body.ts`, `inbound-replies.ts`, `luna-turn.ts` |
| Manual contact fix | `api/.../reminder-contact/route.ts`, `appointment-detail-drawer.tsx` |
| Templates | `template-library/merge-context.ts`, `appointments-service.ts` (`appointmentMergeVars`) |
| Tests bundle | `npm run test:appointment-reminders` |

---

*End of combined audit document.*
