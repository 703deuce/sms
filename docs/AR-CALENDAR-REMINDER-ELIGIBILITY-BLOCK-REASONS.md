# Appointment Reminders — Why calendar events are blocked from SMS

Transovo does **not** treat “anything on the connected calendar” as a customer appointment worth texting. Calendar sync can **import** many events for display, but **SMS reminders use a separate, stricter gate** (`isEventEligibleForReminderImport` in `src/lib/calendar/eligibility.ts`).

When import-time rules fail, the appointment row may still exist, but metadata typically includes:

- `reminderSmsEligible: false`
- `remindersSuppressed: true`
- `reminderSmsIneligibleReason: "<code>"`

Passing import eligibility only means the event is a **reminder candidate**. Phone, consent, sender, timing, and send-time checks still apply.

**Source of truth (code):**

- Import rules: `src/lib/calendar/eligibility.ts`
- Applied on sync: `src/lib/calendar/import-sync.ts` → `applyImportedReminderEligibility`
- Send-time SMS: `src/lib/appointment-reminders/sms-eligibility.ts`
- Discovery queue: `src/lib/appointment-reminders/reminder-discovery.ts`
- Dispatch execution: `src/lib/appointment-reminders/reminder-dispatch-executor.ts`, `src/lib/appointments/reminder-delivery.ts`

**Configurable import rules** (calendar integration UI / connection `config.importRules`): see `CalendarImportRules` in `eligibility.ts`. Defaults are in `defaultImportRules()`.

---

## Layer 1 — Import-time rules (`reminderSmsIneligibleReason`)

Evaluated at sync. **First failing rule wins.**

| Code | What triggers it | Why we block |
|------|------------------|--------------|
| `all_day` | Event is all-day (`skipAllDay` default true). | Timed reminders assume a specific start; all-day entries are usually PTO/holds, not “be here at 3pm” visits. |
| `transovo_originated` | Event is Transovo-booked or matches Transovo-owned import logic. | Avoid **double reminders** — Transovo already runs confirmation/reminder for its own bookings. |
| `title_excluded` | Title matches built-in blocklist **or** custom `titleExcludePatterns`. | Avoid texting **internal/personal blocks** that happen to contain a phone in title/notes. |
| `title_not_included` | `titleIncludePatterns` configured and title matches none. | Opt-in filter: only remind when title matches your patterns (e.g. “Client”). |
| `show_as_free` | Microsoft `showAs: free` or Google transparent (`skipFreeShowAs` default true). | Free/transparent entries are usually placeholders, not firm customer appointments. |
| `show_as_tentative` | Tentative show-as when `skipTentativeShowAs` is enabled. | Optional: don’t remind until the meeting is firm. |
| `organizer_not_connection` | `requireOrganizerIsConnection` default true; organizer is not the connected mailbox. Example: **colleague organized** a meeting on a shared calendar; you are only an attendee. | Prevent texting **someone else’s** client meeting because it appeared on your calendar. **Known bug (fixed):** Graph may report `outlook_{microsoftUserId}@outlook.com` while OAuth stores SMTP (e.g. `you@company.com`) — same user, different string → false `organizer_not_connection`. Fix: `organizerMatchesConnection()` in `eligibility.ts`. |
| `no_external_attendees` | `requireExternalAttendees` default true; no attendee email outside mailbox (non-declined); **and** no SMS-capable customer phone extracted (`customerPhoneE164` on import). | Require a **customer signal** — traditionally another person on the invite. **Solo Outlook entry with phone in title/body** can pass if extraction finds a number (when organizer matches connection). Solo block with no phone still fails. |
| `internal_domain_only_attendees` | External attendees exist but **all** share the organizer’s email domain (`skipInternalDomainOnlyMeetings` default true). | Block **staff-only** meetings, even if a phone appears in description. |
| `no_attendee_email` | Only when `requireAttendeeEmail` is enabled in import rules. | Stricter: require an email on attendee/organizer. |

### Default import rules (unless changed in settings)

From `defaultImportRules()`:

| Setting | Default |
|---------|---------|
| `requireExternalAttendees` | `true` |
| `requireAttendeeEmail` | `false` |
| `requireOrganizerIsConnection` | `true` |
| `skipFreeShowAs` | `true` |
| `skipTentativeShowAs` | `false` |
| `skipInternalDomainOnlyMeetings` | `true` |
| `skipAllDay` | `true` |
| `titleExcludePatterns` | `[]` (built-in list still applies) |

Per-calendar overrides: `resolveImportRulesForCalendar` in import-sync (connection config).

### Built-in title blocklist (always applied)

Case-insensitive **substring** match on event **title**:

- `ooo`
- `out of office`
- `vacation`
- `pto`
- `lunch`
- `focus time`
- `focus block`
- `do not book`
- `blocked`
- `block ` (includes trailing space)
- `personal`
- `gym`
- `commute`
- `hold`

Plus any custom `titleExcludePatterns` from settings.

### External attendee definition

From `externalAttendees()`:

- Must have an email.
- Not the connection mailbox email.
- Not `responseStatus: declined`.

### Calendar mirror vs SMS eligibility

- **Mirror** (`isEventEligibleForCalendarMirror`): mostly imports events for UI; skips `transovo_originated`.
- **SMS** (`isEventEligibleForReminderImport`): stricter rules above.

An event can appear on the calendar but still have `reminderSmsEligible: false`.

---

## Layer 2 — Appointment state and suppression (not always a separate `reason` code)

| Condition | Effect |
|-----------|--------|
| `remindersSuppressed` or `reminderOverride.suppressed` | Discovery and send skip. |
| Status `canceled` / `cancelled` / `completed` / `no_show` | Inactive; reminders/confirmations stop. |
| Import re-evaluated as ineligible | `suppressAppointmentReminders` + `reminderSmsEligible: false` + reason. |
| Reschedule / time change | `resetAppointmentReminders` — generation bump; old dispatches may be `stale_generation`. |
| Opt-out metadata | `smsConsent: false`, `smsOptOut`, `recipientOptedOut` → blocked at send. |
| AI rescheduler hold | `arRemindersHeld`, `arReconcilePending`, `arDurableOperation` processing → hold until reconciled (`shouldHoldRemindersForAppointment`). |
| Customer confirms cancel via SMS | Can call `suppressAppointmentReminders` (inbound flow). |
| Stop-on-reply (reminder engine) | Can set `remindersSuppressed` after reply behavior. |

---

## Layer 3 — Discovery (`discoverAndEnqueueDueAppointmentReminders`)

Even with `reminderSmsEligible: true`, dispatches may not exist yet or may be suppressed:

| Situation | Typical outcome |
|-----------|-----------------|
| Workspace not operational | Skipped — AR not activated, setup incomplete, or `isArRemindersPaused`. |
| `reminderSmsEligible === false` | Skipped. |
| `remindersSuppressed` / override | Skipped. |
| `shouldHoldRemindersForAppointment` | Skipped. |
| `shouldSkipPlatformRemindersForAppointment` | Skipped (platform workflow). |
| Reminder step disabled for service | Step not in filtered list. |
| Recipient notification preference | SMS steps skipped if email-only preference. |
| `shouldSkipReminderStepForConfirmation` | Step skipped per confirmation guard. |
| **Not in fire window** | No dispatch until `intendedFireAt` within ~**4 minutes** (`FIRE_TOLERANCE_MS`). **Future reminders often show zero rows until the window.** |
| `appointmentWithinMinimumLeadTime` | Step skipped — appointment too soon. |
| Fire time **> ~30 min late** | Dispatch `suppressed`, `lastError` late suppression path. |
| No allowed send window | Dispatch `suppressed`, `lastError: no_allowed_send_window` (quiet hours / business hours). |
| Step already sent for generation | Skipped (`wasReminderSent`). |

Constants in `reminder-discovery.ts`: `FIRE_TOLERANCE_MS = 4 * 60_000`, `REMINDER_MAX_LATE_MS = 30 * 60_000`.

---

## Layer 4 — Send time (`evaluateSmsReminderEligibility`)

Authoritative for UI + scheduler + delivery (`src/lib/appointment-reminders/sms-eligibility.ts`).

| `blockReason` | Meaning |
|---------------|---------|
| `suppressed` | `remindersSuppressed` / override, or inactive appointment status. |
| `missing_phone` | No usable reminder phone after `resolveEffectiveReminderPhone`. |
| `invalid_phone` | Phone present but not valid for SMS. |
| `phone_needs_review` | `reminderPhone.status === needs_review` (multiple candidates). |
| `consent_required` | Workspace has not certified existing-customer SMS permission **and** appointment lacks `smsConsent`, `existingConsentCertified`, or `existingConsentAttested`; or `emailOnly` / `smsCapable: false`. |
| `opted_out` | Recipient opted out (`isOptedOut` metadata). |
| `sender_unavailable` | Used in UI hints; sender/route not ready. |
| `none` | Eligible. |

### Additional send / dispatch blockers

From `trySendStepForDispatch` / `trySendStep` / `reminder-dispatch-executor`:

| Detail / `lastError` | Meaning |
|----------------------|---------|
| `appointment_not_found` | Row missing. |
| `reminders_suppressed` | Suppressed at dispatch time. |
| `stale_generation` | Appointment reminder generation changed after dispatch created. |
| `ar_reconcile_pending` | Hold for AI rescheduler reconcile. |
| `step_not_configured` / `step_disabled` | Reminder type off. |
| `no_recipient` | No phone and no email for step channel. |
| `ar_sms_limit_reached` | Monthly AR SMS allowance exhausted (`reserveArReminderSmsUnit`). |
| `unconfigured_limit` | SMS metering limit not configured. |
| `send_failed` / provider errors | Failed dispatch; staff alert may fire. |
| `unknown_submission` / `unknown_timeout` | Ambiguous provider outcome; dispatch `unknown`. |
| Platform session send failure | `markReminderAllowanceBlocked` with platform reason. |

Email steps: parallel checks (e.g. `missing_email` in aggregate status).

---

## Product mental model

**“I put an event in Outlook — why wouldn’t it remind?”**

**Usually intentional:**

1. Personal/internal (title blocklist, all-day, free, staff-only attendees).
2. Not **your** meeting as organizer (colleague organized; shared calendar).
3. No customer signal (no external attendee and no extractable phone).
4. Transovo already owns the booking (`transovo_originated`).
5. Compliance/ops: consent, opt-out, AR paused, SMS cap, sender not ready.
6. Timing: not due yet (discovery window), too late, or no send window.

**Legitimate Outlook workflow (intended support):**

- You create the event on **your** calendar (organizer matches connection, including Outlook OID alias).
- Customer phone in title/body and/or external attendee.
- Timed, not free/all-day/blocklist title.
- Workspace consent + sender + active AR.

**`organizer_not_connection`:** Protects against wrong-meeting texts on shared calendars; must not fire on self-created Outlook events when Graph uses `outlook_*@outlook.com` vs SMTP email.

---

## Policy knobs (without removing safeguards)

| Goal | Approach |
|------|----------|
| Solo entries with phone only | Default already allows if phone extracted; ensure organizer match (Microsoft alias). |
| Remind without attendees | Set `requireExternalAttendees: false` per connection/calendar (documented in AR matrix) — increases risk of texting internal blocks; keep title/consent rules. |
| Remind on colleague-organized client meetings | Set `requireOrganizerIsConnection: false` — increases risk of texting wrong customer on shared calendars. |
| Stricter titles | Add `titleIncludePatterns` or more `titleExcludePatterns`. |

---

## Related docs

- `docs/AR-FULL-LAUNCH-AND-PARITY-AUDIT-2026-10-11.md` — eligibility parity discussion (some rows predate `requireOrganizerIsConnection` / `show_as_free` in code).
- `docs/AR-MICROSOFT-OAUTH-ROOT-CAUSE-2026-10-11.md` — ws_1 `organizer_not_connection` false negative.

---

*Generated for copy/paste and release review. Update this file when `eligibility.ts` or `sms-eligibility.ts` changes.*
