# Transovo Date, Time, Timezone & Locale Standards Guide

**Series:** Implementation standards · **Guide #10 of 12**  
**Status:** Active — mandatory hard standard for how Transovo stores, transmits, interprets, formats, compares, schedules, and displays dates, times, timezones, recurrence, locale-specific formats, and human-readable temporal information  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** ISO 8601 · RFC 3339 · IANA Time Zone Database · Unicode CLDR / LDML · BCP 47 / RFC 5646

---

## Master Cursor rule

> **Transovo date/time behavior must follow ISO 8601 and RFC 3339 for unambiguous machine interchange, the IANA Time Zone Database for civil-time and daylight-saving rules, Unicode CLDR for locale-sensitive human formatting, and BCP 47 for language/locale identifiers. Never conflate an instant, local date/time, UTC offset, or IANA timezone. Store authoritative event timestamps as instants, but preserve IANA timezone and local civil-time intent for future appointments, recurring events, business hours, reminder schedules, and other timezone-dependent rules. UTC alone does not solve future scheduling. Never hard-code UTC offsets or DST rules, never use timezone abbreviations as canonical identifiers, and never allow the server's machine timezone to influence business logic. Date-only, time-only, duration, local datetime, zoned datetime, and instant values must remain distinct domain concepts. Calendar arithmetic must be distinguished from elapsed-duration arithmetic; one day is not always 24 hours, and one month is not 30 days. All timezone conversion, recurrence, availability, reporting boundaries, reminder timing, provider synchronization, and locale formatting must use centralized standards-based utilities and be tested across DST transitions, different IANA zones, leap/calendar boundaries, and provider round trips.**

**This guide controls how Transovo stores, transmits, interprets, formats, compares, schedules, and displays dates, times, timezones, recurrence, locale-specific formats, and human-readable temporal information.**

For Transovo, this is a critical standards document because appointment software can fail catastrophically if it gets timezone conversion, daylight saving transitions, recurrence, imported calendar timezones, customer timezone, workspace timezone, timestamps, or locale formatting wrong.

---

## Core principle

**Store and exchange time unambiguously. Preserve the actual timezone when future civil time matters. Format dates/times for humans according to their locale and context. Never confuse an instant, a local wall-clock time, a UTC offset, and an IANA timezone.**

That last sentence is the most important rule Cursor receives.

**Primary authorities**

| Authority | Role |
|-----------|------|
| **ISO 8601** | International standard for unambiguous date/time representation; ordered `YYYY-MM-DD` avoids regional ambiguity |
| **RFC 3339** | Internet standards-track profile of ISO 8601 for timestamps; requires four-digit years |
| **IANA Time Zone Database** | Authoritative software database for civil-time rules, UTC offsets, and DST changes |
| **Unicode CLDR / LDML** | Locale data for dates, times, numbers, calendars, relative dates, week conventions |
| **BCP 47 / RFC 5646** | Standard language-tag system (`en-US`, `en-GB`, `es-MX`) |

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #5: `docs/TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- **Remaining in series:** Guide #4 — Interaction, Keyboard & Focus Standards (coming)

---

## A. Distinguish four different temporal concepts

These must never be treated as interchangeable.

| Concept | Meaning | Example |
|---------|---------|---------|
| **1. Instant** | A specific point on the global timeline | `2026-09-08T18:00:00Z` |
| **2. Local date/time** | A civil wall-clock value; alone does not uniquely identify an instant | `2026-09-08 14:00` |
| **3. UTC offset** | Difference from UTC at that moment; not a complete timezone policy | `-04:00` |
| **4. Timezone** | Civil-time rules including historical/future DST changes | `America/New_York` |

**Cursor rule:** Never model instant, local date/time, UTC offset, and IANA timezone as the same type or assume they are interchangeable.

---

## B. Use ISO 8601/RFC 3339 for machine interchange

ISO 8601 exists specifically to eliminate ambiguity from regional date conventions. RFC 3339 defines a profile of ISO 8601 specifically for Internet timestamps.

For API/event timestamp exchange, use forms like:

- `2026-09-08T18:00:00Z`
- `2026-09-08T14:00:00-04:00`

Do not transmit ambiguous strings like `09/08/26 2:00`.

**Cursor rule:** Machine-readable timestamps must use an unambiguous standardized representation such as RFC 3339.

---

## C. Always use four-digit years

RFC 3339 says Internet protocols must generate four-digit years and deprecates two-digit years because of ambiguity.

- **Good:** `2026-09-08`
- **Bad:** `26-09-08`
- **Never store** `9/8/26` as an authoritative date representation.

---

## D. Do not use ambiguous numeric date formats in user-critical contexts

ISO specifically highlights ambiguity like `01/05/22`, which can mean January 5 or May 1 depending on culture.

For customer-facing display, either use locale-aware formatting or use month names when ambiguity would be costly.

- Example U.S.: Sep 8, 2026
- Example British locale: 8 Sep 2026

**Cursor rule:** Never assume MM/DD/YYYY is globally understood.

---

## E. Store timestamps in UTC when they represent completed instants

For things that already happened — `created_at`, `received_at`, `sent_at`, `captured_at`, `delivered_at`, `executed_at`, audit events — store a canonical instant, typically UTC.

Example: `2026-09-08T18:03:17Z`

Then format it into the user's appropriate timezone for display. RFC 3339 notes that interoperability is best achieved with UTC when representing instants and defines `Z` as UTC offset `00:00`.

---

## F. Future appointments need the timezone, not merely UTC

This is one of the most important scheduling rules.

Suppose a dental appointment is March 15, 2027 at 9:00 AM `America/New_York`. If you store only the current computed UTC instant without preserving the intended timezone, future timezone-law changes can create incorrect civil time.

IANA explicitly says timezone rules are changed by political authorities and its database is periodically updated to reflect those changes.

**Cursor rule:** For future scheduled civil-time events, preserve the intended IANA timezone in addition to any computed instant.

Conceptually:

```
local_start = 2027-03-15T09:00:00
timezone = America/New_York
instant = computed UTC instant
```

---

## G. Do not use a fixed offset as a timezone

**Bad:** `timezone = -05:00` for New York.

New York can be UTC−05 or UTC−04 depending on DST. IANA exists specifically to encode those changing rules.

Use `America/New_York`, not `EST` or `-05:00`, as the canonical timezone.

---

## H. Do not use abbreviations as canonical timezone identifiers

Examples like EST, CST, and IST are ambiguous or incomplete. CST can refer to different regions.

Use IANA identifiers internally: `America/New_York`, `America/Chicago`, `Europe/London`, `Asia/Kolkata`, `Australia/Sydney`.

Human UI can show friendly names. Canonical storage remains IANA.

---

## I. Use the IANA Time Zone Database as the authority for timezone rules

IANA's database contains the rules/software data needed to calculate local time and UTC offsets and is updated when governments change DST or timezone rules.

**Cursor rule:** Do not maintain a custom hard-coded list of DST rules. Use runtime/library timezone data based on IANA tzdb.

---

## J. Keep timezone data current

IANA can publish timezone-rule changes with relatively little lead time.

Therefore:

- runtime/container dependencies must receive tzdb updates
- timezone libraries should not remain frozen indefinitely
- tests should not assume DST rules never change

As of September 2026, IANA's timezone page lists 2026c as the latest release and notes recent changes to Alberta and Morocco, illustrating that these rules really do change.

---

## K. Store the canonical IANA identifier, not only the display name

**Good storage:** `America/New_York`

**Display:** Eastern Time (potentially Eastern Time (New York))

Never store only `Eastern Time` because the display label may change or be localized.

---

## L. Preserve provider timezone IDs carefully

Microsoft, Google, and other providers may expose timezone identifiers in different forms.

Transovo should:

1. retain provider/source value where useful for round-trip fidelity
2. map it into the canonical timezone model
3. preserve the authoritative IANA zone when possible

Do not repeatedly convert Microsoft → display label → guessed IANA and lose information.

---

## M. Never guess a timezone silently when ambiguity matters

If location/context does not make timezone reliable: ask or use workspace/user default with clear visibility.

- **Bad:** User entered 2 PM → assume server timezone.
- **Good:** 2:00 PM Eastern Time, or clearly established workspace timezone.

**Cursor rule:** A missing timezone must never silently become the server's local timezone.

---

## N. Server timezone must not affect business logic

Production may run in UTC, Germany, Virginia, or container environments. Business logic should give the same result regardless.

Do not use `serverLocalTime()` as appointment interpretation. Server timezone is infrastructure. User/workspace timezone is product state.

---

## O. Database timezone and presentation timezone are separate

**Database:** UTC instant + timezone identifier

**UI:** localized civil time

Do not store a formatted display string as authoritative state.

- **Bad database field:** `"Tuesday at 2 PM EST"`
- **Good structured data:** instant, timezone, locale-independent date/time components where needed

---

## P. Workspace timezone must be explicit

Every Transovo workspace should have a canonical default timezone. Use it for business hours, reporting defaults, manual appointment creation where no other timezone applies, reminder policies, and schedule interpretation.

Display current timezone in settings. Don't hide this as an invisible backend default.

---

## Q. User timezone and workspace timezone may differ

Example: Business `America/New_York`, staff traveling `America/Los_Angeles`, customer `America/Chicago`. Those are distinct.

**Cursor rule:** Do not use one timezone field to represent organization, staff, contact, appointment, and viewer timezone simultaneously.

---

## R. Appointment timezone must remain authoritative to the appointment

An appointment should know the timezone in which its scheduled civil time is defined.

Example: `appointment.timezone = America/New_York`

That remains true even if staff travels, browser timezone changes, or customer views from another region. Viewer can receive converted display. Appointment's scheduling context remains stable.

---

## S. Booking pages need explicit timezone behavior

Customer-facing booking should establish whether available times are shown in customer's detected/selected timezone, business timezone, or booking-type timezone.

If showing converted customer times, display that timezone clearly.

Example: "Times shown in Central Time" or "Your timezone: America/Chicago"

Do not let a customer book 2 PM without knowing whose 2 PM it is.

---

## T. Timezone detection is a convenience, not authority

Browser detection can provide a useful default. But VPN, travel, device configuration, and remote booking can make it wrong. Allow correction where timezone matters.

**Cursor rule:** Never lock timezone solely from browser detection.

---

## U. Customer timezone should be persisted when useful

For recurring/customer communications, a contact timezone may help with localized booking links, appropriate message scheduling, and displaying appointment times.

But don't overwrite confirmed appointment timezone merely because contact profile changes later. Appointment state is historical/scheduled state.

---

## V. "Today" and "tomorrow" require an explicit timezone context

At 11:30 PM New York time, "tomorrow" may already be "today" in London.

Therefore code must never calculate `isTomorrow` without knowing whose timezone.

**Cursor rule:** Relative-day logic must always specify the relevant timezone.

---

## W. Reporting dates also require timezone context

Suppose reminder sent at `2026-09-09T02:30Z`. That's Sep 8 at 10:30 PM Eastern.

A daily report for the New York workspace should count it on Sep 8, not Sep 9. Analytics must group temporal data using the intended reporting timezone.

---

## X. Daylight Saving Time transitions must be explicitly handled

DST creates two major classes of problems:

**Spring-forward gap:** Some local times do not exist (e.g., 2:30 AM may be skipped).

**Fall-back overlap:** Some local times occur twice (e.g., 1:30 AM may have two possible UTC instants).

**Cursor rule:** Scheduling code must explicitly detect nonexistent and ambiguous local times around timezone transitions. Never let a library silently choose an arbitrary interpretation without defined policy.

---

## Y. Nonexistent times must not be scheduled silently

If user chooses a time that does not exist because clocks jump forward, do not silently transform 2:30 AM into 3:30 AM unless product explicitly explains/asks.

Prefer: "2:30 AM does not occur on this date because of the daylight-saving transition. Choose another time." 

---

## Z. Ambiguous times require deterministic policy

During a fall-back transition, local 1:30 AM can happen twice. If users can schedule such times:

- disambiguate using offset/occurrence
- or establish a documented deterministic rule

If ambiguity is relevant, show `1:30 AM EDT` and `1:30 AM EST` or equivalent localized representation. Never map arbitrarily with no audit trail.

---

## AA. Adding "24 hours" is not the same as "same time tomorrow"

This is a classic DST bug. Suppose appointment 9:00 AM Monday. A reminder 1 day before at 9:00 AM should generally use calendar/civil-time semantics.

Subtracting exactly `24 * 60 * 60` seconds can shift local time across DST transitions.

**Cursor rule:** Distinguish elapsed duration arithmetic from calendar/civil-time arithmetic.

---

## AB. "1 day before" and "24 hours before" are different concepts

The UI must preserve the user's intended semantics.

- **1 day before** — calendar-relative
- **24 hours before** — elapsed duration

For appointment reminders, product typically wants civil scheduling semantics. Do not accidentally convert one into the other.

---

## AC. "At 9 AM the day before" must be calculated in the intended appointment/business timezone

Example appointment: Tue 2 PM Eastern. Reminder: day before at 9 AM.

**Correct:** Monday 9 AM Eastern.

**Not:** appointment instant minus 29 hours in whatever server timezone happens to be active.

---

## AD. Specific reminder times should persist as semantic schedules

Instead of only storing computed `send_at_utc`, also preserve rules where needed:

```
1 day before
at 09:00
timezone_basis = appointment
```

Then future changes/reschedules can correctly recalculate.

---

## AE. Rescheduling must recalculate future temporal dependents

If appointment moves Sep 8 → Sep 10, recalculate reminder times, workflow delays, meeting bot join, calendar events, and payment deadlines where appointment-relative.

Do not leave previous UTC timestamps active.

---

## AF. Past-due reminder calculations must be deterministic

If reminder rule is 1 day before at 9 AM but appointment is created same day at noon, product needs documented behavior: skip, send immediately, or move to next valid step.

The temporal engine must evaluate it consistently.

---

## AG. Weekend/closed-day behavior needs calendar semantics

Example: send one business day before must not mean subtract 24 hours.

It requires working-day calendar, holidays, business timezone, and closed days. Keep this separate from elapsed duration.

---

## AH. Holidays need a defined calendar and locale/jurisdiction

Don't code "Dec 25 is the entire holiday system."

Business holidays may depend on country, locale, workspace, and custom closures. Store workspace holiday policies separately from timezone. Timezone tells you when. Holiday calendar tells you whether the business operates.

---

## AI. Business hours need timezone identity

**Bad:** Monday 9:00–17:00 with no timezone.

**Good:** Workspace hours · `America/New_York` · Monday 09:00–17:00

If staff schedules differ, each schedule needs its relevant timezone basis.

---

## AJ. Availability calculations must occur in a consistent temporal model

For each potential slot:

1. interpret requested local slot in scheduling timezone
2. convert provider events to instants
3. determine overlap
4. apply buffers/limits
5. present result in viewer/customer timezone

Do not compare naive local timestamps from different calendars.

---

## AK. Calendar-event overlap must compare instants, not display strings

Do not compare `"2:00 PM"` to `"14:00"`. Normalize underlying event intervals to instants for overlap. Presentation format is irrelevant to conflict calculation.

---

## AL. Preserve original timezone for imported events

Microsoft/Google event 10:00 AM Pacific should not become permanently 1:00 PM Eastern simply because Transovo workspace is Eastern.

You may display converted form, but preserve source timezone/context necessary for round-trip sync.

---

## AM. All-day events are not ordinary midnight-to-midnight appointments

Calendar providers often treat all-day events using date semantics rather than timestamp semantics.

**Cursor rule:** Model all-day events as date-based intervals, not blindly as 00:00 → 23:59:59 instants. Otherwise timezone conversion can shift them into adjacent dates.

---

## AN. Date-only values must remain date-only

Examples: birthday, holiday, all-day event date, reporting date selection.

Do not serialize `2026-09-08` as `2026-09-08T00:00Z` unless the domain actually represents an instant. Midnight UTC may display as the previous day elsewhere.

---

## AO. Time-only values are also distinct

Business opening time `09:00` is not an instant. It belongs to a local schedule plus timezone/date context when evaluated.

Do not attach today's UTC date just to store it.

---

## AP. Recurrence must preserve the recurrence's civil-time intent

Example: Every Monday at 9 AM Eastern. Across DST it should generally remain Monday at 9 AM Eastern, not always 14:00 UTC.

**Cursor rule:** Recurring schedules defined in local civil time must preserve the local time + timezone + recurrence rule.

---

## AQ. Recurrence cannot be modeled as repeated fixed-second intervals

Weekly appointment: do not simply `previous_instant + 604800` forever. DST can shift the displayed local hour. Use recurrence semantics + timezone.

---

## AR. Exceptions to recurrence must be first-class

Recurring series may need one occurrence canceled, one occurrence rescheduled, or series end changed.

Do not rewrite entire series destructively when editing one occurrence. Temporal model should preserve master recurrence, exception, and overridden occurrence.

---

## AS. Editing recurrence scope must be explicit

When user changes one occurrence, support explicit scopes where the product allows:

- This appointment only
- This and following
- Entire series

Never infer the scope silently.

---

## AT. End dates in recurrence should be inclusive/exclusive by specification, not assumption

A recurrence engine needs explicit rules. Don't let one component treat "until Sep 30" as inclusive while another excludes Sep 30. Use the underlying recurrence specification consistently.

---

## AU. Interval boundaries must use a documented convention

For event overlap, prefer half-open intervals conceptually: `[start, end)` — start included, end excluded.

Then 9:00–10:00 and 10:00–11:00 do not conflict.

**Cursor rule:** Define interval-boundary semantics centrally and use them consistently.

---

## AV. Do not subtract arbitrary seconds from end times

Avoid event ends at 9:59:59 so next event can start at 10. Use proper interval semantics instead. Artificial "minus one second" logic creates edge bugs.

---

## AW. Duration must be a duration, not a formatted clock string

Store 30 minutes as duration representation. Not `"00:30"` if that string could be misinterpreted as a clock time. Use domain-appropriate duration types.

---

## AX. Zero-duration and negative-duration events require explicit rules

Appointment end must normally be > start. Zero-duration event probably invalid unless domain allows it. Don't rely on database accident. Validate temporal invariants.

---

## AY. API timestamps should include timezone/offset information

RFC 3339 timestamps represent instants with UTC/offset relationship.

- **Good:** `2026-09-08T14:00:00-04:00` or `2026-09-08T18:00:00Z`
- **Bad:** `2026-09-08T14:00:00` for an instant unless API explicitly defines accompanying timezone.

---

## AZ. Do not confuse RFC 3339 offset with future timezone identity

`2026-09-08T14:00:00-04:00` fully identifies that instant. But it does not tell us future DST rules for recurring 2 PM meetings.

For future scheduling, preserve `America/New_York` as well. RFC 3339 itself notes that its timestamp format focuses on instants and does not encode local timezone-rule behavior.

---

## BA. Avoid floating local timestamps unless domain explicitly needs them

A floating time means something like 9 AM regardless of timezone. This can be appropriate for daily office hours before attaching schedule timezone or generic time-of-day templates, but dangerous for appointments.

If floating values are used, name/type them explicitly. Never accidentally create floating timestamps by forgetting timezone.

---

## BB. Locale and timezone are different

`en-US` does not mean `America/New_York`. A U.S.-English user may live in California, Virginia, or London.

Language/locale governs formatting. Timezone governs civil-time conversion. Store separately.

---

## BC. Language and locale are also not necessarily identical

BCP 47 language tags can represent language/region/script combinations such as `en-US`, `en-GB`, `es-MX`, `fr-CA`. RFC 5646 defines the standard tag system.

Use standardized tags. Don't invent `english_usa`.

---

## BD. Use Unicode CLDR data for locale-specific formatting

Unicode CLDR provides standardized locale data used by software systems to format/display dates, times, relative dates, calendars, numbers, timezones, and week information.

Use platform libraries based on CLDR, such as Intl, rather than writing custom formatting tables.

**Cursor rule:** Do not hard-code month names, weekday names, AM/PM formats, or locale date ordering.

---

## BE. Use Intl/CLDR-aware formatting for user-facing dates

For web: `Intl.DateTimeFormat(...)` or equivalent trusted library.

Do not manually concatenate `month + "/" + day + "/" + year` for all users. Formatting belongs to locale machinery.

---

## BF. Respect 12-hour vs 24-hour preferences

U.S. user: 2:30 PM. Many European locales: 14:30.

Use locale/user setting. Do not hard-code AM/PM globally.

---

## BG. Do not assume week starts Sunday

Locales differ. Some commonly use Sunday, Monday, or other conventions. CLDR carries locale week data. Calendar UI should use locale/workspace conventions where applicable.

---

## BH. Week-number calculations need an explicit standard

If Transovo ever exposes week numbers, specify whether using ISO week date or locale-specific week rules. Don't calculate "week 1" ad hoc. ISO week numbering has specific rules.

---

## BI. Relative dates are context-sensitive

Examples: Today, Tomorrow, Yesterday, 3 hours ago.

Use them only where context benefits (immediate dashboard, recent activity). For invoices, audit records, and compliance evidence, absolute date/time is more appropriate.

---

## BJ. Relative timestamps should expose exact time when consequential

Example: "3 hours ago" could have tooltip/detail "Sep 8, 2026 · 2:13 PM EDT".

For audit/security/history, prefer exact value directly.

---

## BK. Don't use "today" for dates in a different timezone without saying which day model applies

Dashboard for Eastern workspace should calculate "Today" in workspace timezone unless product specifies viewer timezone. Consistency matters more than browser-local convenience.

---

## BL. Appointment customer-facing communication should prefer clear natural language

Good reminder: "Tuesday, September 8 at 2:00 PM" is often clearer than `09/08/2026 14:00` unless locale expects that.

Machine standards and human formats are different layers.

---

## BM. Do not expose ISO timestamps to normal users unnecessarily

ISO/RFC representations are excellent for APIs, logs, exports, and debugging. Normal UI should be localized. Don't show `2026-09-08T18:00:00.000Z` inside an Appointment Detail unless user is in technical diagnostics.

---

## BN. Timezone abbreviations should be used cautiously in UI

Even friendly labels like EST or EDT can be confusing. Often better: "2:00 PM Eastern Time" or "2:00 PM EDT" if date makes DST clear.

When multiple zones appear on the same screen, make them unmistakable.

---

## BO. Prefer location-based timezone names in settings

Timezone selector: "Eastern Time — New York" with canonical `America/New_York` is better than a list of raw offsets. Offsets change seasonally.

---

## BP. Timezone selector should be searchable

There are many IANA zones. Support search by city, region, friendly name, and canonical identifier.

Example: Search "New York" → "Eastern Time — New York (America/New_York)". Don't make user scroll hundreds of items.

---

## BQ. Don't infer timezone from ZIP or country alone without confirmation

Country can contain multiple timezones. U.S. ZIP mapping may be possible but can have edge cases. Use location-derived timezone as suggestion, not unquestionable authority where ambiguity matters.

---

## BR. Contact timezone can be unknown

Do not fabricate `America/New_York` merely because the workspace is there. Represent "Timezone not set" and use documented fallback when needed.

---

## BS. Fallback hierarchy must be centralized

For example, if contact timezone absent: (1) appointment timezone, (2) booking type/workspace timezone, (3) explicitly documented fallback.

Do not let each feature invent a different fallback.

**Cursor rule:** Temporal fallback rules must live in one canonical service/configuration.

---

## BT. User-facing timezone changes need impact analysis

Changing workspace timezone can affect business hours, availability, reminder rules, report grouping, and scheduling defaults.

Before applying, explain what changes and what remains fixed. Do not silently reinterpret existing appointments unless explicitly intended.

---

## BU. Changing display timezone should not change the underlying instant

If viewer changes Eastern → Pacific, appointment 2 PM Eastern may display 11 AM Pacific but must represent the same instant. Display conversion ≠ rescheduling.

---

## BV. Changing appointment timezone can mean two different actions

Suppose 2 PM Eastern changes to Pacific. Does user mean:

- **Preserve instant** → 11 AM Pacific
- **Preserve wall-clock time** → 2 PM Pacific, a different instant

This is a major semantic difference.

**Cursor rule:** When changing an appointment's timezone, explicitly define whether the operation preserves the instant or preserves the local wall-clock time.

---

## BW. Never silently choose between preserve-instant and preserve-wall-time when consequence matters

UI should communicate "Keep the same moment (11 AM Pacific)" or "Keep 2 PM in the new timezone" if such editing is exposed.

---

## BX. Calendar sync must respect provider timezone semantics

When creating/updating Microsoft/Google events, send correct local date/time, correct timezone, correct recurrence, and correct all-day semantics.

Do not create everything in UTC merely because backend prefers UTC if provider expects timezone-aware civil scheduling fields.

---

## BY. Round-trip calendar sync must avoid timezone drift

Test: Transovo 2 PM Eastern → Microsoft → imported back into Transovo must remain 2 PM Eastern, not 1 PM, 3 PM, or UTC after repeated cycles.

This is a high-priority integration invariant.

---

## BZ. Recurring provider events need timezone/recurrence round-trip tests

Especially across spring DST, fall DST, timezone-law changes, and series exceptions. One successful one-off event does not certify recurring scheduling.

---

## CA. Webhook timestamps and event scheduled times are different fields

Webhook metadata `event received_at` is server instant. Appointment `scheduled_start` is business domain time.

Never overwrite `scheduled_start` with webhook delivery timestamp.

---

## CB. Audit logs should record instants plus display timezone context

Canonical: `2026-09-08T18:14:03Z`. Display: Sep 8, 2026 · 2:14 PM EDT.

This allows accurate ordering and understandable presentation.

---

## CC. Sorting temporal data should use underlying temporal values

Don't sort formatted strings. Lexicographic sort of `9/10/2026` and `10/1/2025` can be wrong.

Sort by instant, date, or duration — then format for display.

---

## CD. Filtering date ranges must define boundary timezone

User selects Sep 1 – Sep 30. What exactly is included?

For workspace report: interpret boundaries in workspace timezone, then convert to instants for query. Don't query Sep 1 00:00 UTC unless UTC is actually the report timezone.

---

## CE. Date-range end should use interval semantics, not 23:59:59.999

Prefer `[start_of_sep_1, start_of_oct_1)` not Sep 30 23:59:59.999. This avoids precision bugs, database differences, and DST-day-length assumptions.

---

## CF. A local day is not always exactly 24 hours

DST days may be 23 or 25 hours. Therefore start of day → end of day must use civil-time timezone boundaries.

Never define a day as exactly 86,400 seconds for local scheduling/reporting.

---

## CG. A month is not a fixed duration

Do not represent 1 month as 30 days when user means calendar month. Likewise year ≠ 365 days universally; week ≠ always a duration if civil scheduling semantics matter across timezone changes. Use calendar arithmetic.

---

## CH. Billing duration and appointment duration may use different semantics

Example: subscription renews monthly is calendar period. Appointment lasts 60 minutes is elapsed duration.

Do not use one generic duration implementation blindly.

---

## CI. Leap years must be handled by standard libraries

Do not custom-code `if year % 4` and forget century rules. RFC 3339 explicitly documents Gregorian leap-year behavior. Use standard date libraries.

---

## CJ. Leap seconds should not be hand-implemented

RFC 3339 recognizes leap seconds in timestamp representations. Application scheduling usually should delegate leap-second handling to platform/runtime standards rather than inventing custom logic.

---

## CK. System clocks are not guaranteed perfectly synchronized

For distributed services (database, app server, queues, providers), timestamps can have small skew.

Use trusted time synchronization infrastructure and avoid business logic requiring impossibly perfect simultaneous clock values. For security tokens, use controlled clock-skew tolerances according to relevant protocol.

---

## CL. Ordering by timestamps may need tie-breakers

Two events can share same millisecond timestamp. Audit timelines may need timestamp + sequence/id for deterministic order. Don't assume timestamp alone always creates unique total ordering.

---

## CM. Idempotency cannot rely only on timestamp equality

Two requests can legitimately occur at the same time. Use real idempotency keys/identifiers. Temporal proximity is not identity.

---

## CN. Clock time and monotonic elapsed time are different

For measuring operation took 2.4 seconds, use monotonic clocks where available. Don't subtract wall clocks that can jump due to synchronization/adjustment. This is implementation-level temporal correctness.

---

## CO. API duration units must be explicit

**Bad:** `"duration": 30` — what is 30?

**Good:** `duration_minutes: 30` or standardized duration representation. Avoid unit ambiguity.

---

## CP. Internal temporal types should communicate semantics

Prefer domain names like `appointmentStartInstant`, `appointmentTimezone`, `localStartTime`, `durationMinutes`, `businessDate` over `time1`, `time2`, `timestamp`. Naming prevents semantic mistakes.

---

## CQ. Avoid JavaScript Date misuse with naive dates

JavaScript's legacy Date represents an instant-like value and can cause timezone conversions that corrupt date-only values.

Be careful with `new Date("2026-09-08")` for domain concepts like holiday Sep 8. Use date/time types/libraries that preserve date-only, local datetime, zoned datetime, and instant semantics explicitly.

---

## CR. Use modern temporal libraries/APIs with explicit timezone semantics

Do not manually perform offset math, DST math, or timezone lookup with string arithmetic.

Use reliable timezone-aware libraries/platform APIs backed by IANA data. Centralize those utilities.

---

## CS. Never parse locale-formatted display strings as authoritative data

**Bad:** UI displays `9/8/26, 2:00 PM` then backend/parser tries to understand that string.

Pass structured machine values instead. Display is one-way formatting. Not storage protocol.

---

## CT. Locale parsing must be deliberate

If user manually types a date `09/10/2026`, interpret according to the selected locale or use controls that eliminate ambiguity. Don't guess based on server locale.

---

## CU. Public API documentation must define temporal semantics precisely

For every temporal field specify: type, timezone requirements, format, whether date-only or instant, inclusive/exclusive range behavior, recurrence semantics if relevant.

Example: `start_at`: RFC 3339 timestamp identifying appointment start instant. `timezone`: IANA timezone identifier describing appointment civil-time zone.

---

## CV. Exports should use unambiguous temporal data

CSV may include Start Date, Start Time, Timezone, Start UTC depending on user/report need.

At minimum, avoid exports where `09/08/26 02:00` cannot be interpreted reliably.

---

## CW. ICS calendar files must preserve calendar semantics

When generating .ics: use standards-compliant datetime/timezone representation, correct all-day handling, UID stability, recurrence semantics where applicable.

Don't serialize an appointment email's display string into an ICS field.

---

## CX. Reminder templates must use localized display formatting

Template variable `{{appointment_time}}` should render according to recipient/product rules. Do not expose raw UTC `2026-09-08T18:00:00Z` to the customer.

---

## CY. Template preview and actual send must use same temporal formatter

If preview shows "Tuesday at 2 PM" but send shows `18:00 UTC`, the system is broken.

One canonical formatting layer should power preview, runtime send, and UI.

---

## CZ. AI must receive explicit timezone context

If AI Booking interprets "tomorrow afternoon", the prompt/tool call must include current date, customer/user timezone, business/booking timezone, and availability constraints.

Never ask an LLM to infer timezone from vague context when system knows it.

---

## DA. AI must not calculate authoritative availability by itself

LLM can interpret "next Tuesday around 2" into structured intent. Then deterministic scheduling engine determines date, timezone, available slot, and conflict.

AI does not perform timezone arithmetic as authority.

---

## DB. AI booking must resolve ambiguous dates

Example customer says "Book me Friday at 2." If customer timezone differs, multiple Fridays are plausible, or conversation crosses midnight, system must resolve/confirm.

Do not silently book based on model guess.

---

## DC. AI should confirm important localized result

Example: "I can book Tuesday, September 8 at 2:00 PM Eastern Time."

This gives customer the final interpreted time before commitment when appropriate.

---

## DD. SMS/email scheduled sending windows need timezone semantics

If business says "Don't send before 8 AM", which timezone?

Define contact timezone, appointment timezone, or business timezone according to product/compliance policy. Store this in one rules service.

---

## DE. International messaging scheduling must not assume U.S. timezones

Contacts can span regions. Avoid Eastern Time is global default forever. Use workspace/contact/appointment policy explicitly.

---

## DF. Date/time formatting must remain consistent across connected objects

Appointment row: Sep 8 · 2:00 PM. Appointment detail: Tuesday, Sep 8 · 2:00–2:30 PM. Contact timeline: Sep 8, 2:00 PM.

Different granularity is fine. Contradictory timezone/format rules are not.

---

## DG. Canonical formatting roles should be defined

For example:

| Role | Example |
|------|---------|
| **Compact** | Sep 8 · 2:00 PM |
| **Full** | Tuesday, September 8, 2026 · 2:00 PM |
| **Time only** | 2:00 PM |
| **Audit** | Sep 8, 2026 · 2:14:03 PM EDT |
| **Relative** | 3 minutes ago |

**Cursor rule:** Use named formatting roles instead of ad hoc date formatting on each page.

---

## DH. Do not hard-code ordinal suffixes

Don't manually create 1st / 2nd / 3rd for all languages. Locale rules vary. Use localization libraries.

---

## DI. Month/day names must come from localization data

Do not hardcode arrays `["January", "February", ...]` in user-facing global components. Use CLDR-based platform APIs.

---

## DJ. Relative-time strings should come from localization infrastructure

Use "in 3 hours" / "2 days ago" through locale-aware APIs, not string concatenation `value + " days ago"` because grammar/order varies by language.

---

## DK. Pluralization must be locale-aware

Not "1 days" or manually `if n === 1` for every language. CLDR provides plural rules as part of internationalization data.

---

## DL. Date/time controls must be accessible

All requirements from previous guides still apply: persistent label, keyboard operability, correct focus, zoom/reflow, screen-reader name, no hover-only calendar action.

A perfectly timezone-correct date picker can still be unusable.

---

## DM. Time validation errors must use human language

**Bad:** Invalid ZonedDateTime.

**Good:** This time doesn't exist because daylight saving time begins that morning. Choose another time.

Translate technical temporal problems into user-level explanation.

---

## DN. "Invalid date" is often insufficient

Better: "February has 28 days in 2027." or "End time must be later than start time." or "This time occurs twice because daylight saving time ends; choose which occurrence you mean."

Specific recovery.

---

## DO. Existing appointment displays need source truth after timezone rule updates

If IANA changes future timezone rules, future appointments may need their UTC instants recalculated from intended local date/time + timezone depending on domain design.

This is exactly why preserving civil-time intent matters. Do not treat previously computed future UTC as unquestionably immutable if timezone law changed before the event.

---

## DP. Past events should normally remain historical instants

If timezone rules database is later revised, audit history remains based on the actual recorded instant.

Displaying historical local time can use updated historical tzdb rules, but do not rewrite event chronology casually.

---

## DQ. Future timezone-rule change handling must be centralized

If IANA updates rules: identify affected future appointments/schedules, recalculate where semantics require, update provider events if needed, log changes if materially relevant.

Do not rely on random page reloads to discover shifts.

---

## DR. Calendar subscription renewal timestamps must use instants

Provider subscription expiration expires at a specific instant. Store UTC/RFC timestamp.

Do not interpret it as workspace-local appointment time. Different temporal domains need different types.

---

## DS. OAuth token expiration also uses instant/duration semantics

Token expiration `expires_in 3600 seconds` means elapsed duration from issuance.

Do not apply DST/civil-day rules to authentication expiration. This is why duration semantics matter.

---

## DT. Payments use instant semantics for transaction timestamps

Payment occurred at exact global instant. Display localized.

Do not store payment timestamp as Sep 8 at 2 PM with no timezone.

---

## DU. Customer birthdays/anniversaries use date semantics, not instant semantics

If future product uses birthday, store month/day/date, not UTC midnight. Again: domain type matters.

---

## DV. Do not let database ORM defaults decide temporal semantics

An ORM may map everything to DateTime. That does not mean every domain concept is an instant.

Define date, time, local datetime, instant, and timezone at domain level even if storage implementation requires mapping.

---

## DW. UTC is not a replacement for timezone-aware domain modeling

This is the major anti-pattern: "We store everything in UTC, so timezone problems are solved." No.

UTC solves unique instant storage. It does not encode recurring civil time, business hours, future DST rules, local holidays, or date-only values.

**Cursor rule:** Use UTC for instants; use IANA timezone + local civil semantics for scheduling rules and future civil-time intent.

---

## DX. Timezone conversion should happen at defined system boundaries

Centralize transformations: provider → canonical model, canonical model → user display, user input → canonical model, canonical model → provider.

Do not scatter `addHours(-4)` through components.

---

## DY. Never hard-code timezone offsets

Absolutely no `if (eastern) addHours(-5)`. DST alone makes this wrong. Use IANA timezone data.

---

## DZ. Temporal calculations require unit tests around boundaries

At minimum test: DST spring transition, DST fall transition, leap day, year boundary, month boundary, midnight, different viewer timezone, date-only all-day events, recurring event across DST, reminder before/after DST, timezone conversion, timezone-rule data updates where feasible.

Normal Tuesday at 2 PM is the easiest case. Boundary cases certify the implementation.

---

## EA. Use real representative zones in tests

At least include examples such as `America/New_York`, `America/Los_Angeles`, `Europe/London`, `Asia/Kolkata`, `Australia/Sydney`, and UTC because they cover DST, non-DST, non-whole-hour offsets in some regions, and opposite-season DST patterns.

Do not test only UTC.

---

## EB. Avoid assumptions that offsets are whole hours

Timezones can use offsets such as UTC+05:30 and other non-hour increments. RFC 3339 supports minute-level numeric offsets.

**Cursor rule:** Never store timezone offset as integer hours.

---

## EC. Don't assume every country has one timezone

The U.S., Canada, Australia, Russia and others span multiple zones. Country alone is insufficient.

---

## ED. Don't assume DST always changes by one hour

Timezone rules are political and historical. Use tzdb. Don't encode DST = +1 hour as universal business logic.

---

## EE. Don't assume DST dates are stable forever

IANA explicitly updates the database when political bodies change rules. Never hard-code "DST starts second Sunday in March globally." 

---

## EF. Locale data also changes

Unicode CLDR evolves as locale conventions/data change. Use maintained platform libraries. Don't fork locale conventions into static project code unless necessary.

---

## EG. Language tags must use BCP 47

Use `en-US`, `es-MX`, `fr-CA` — not `EN_USA` or `spanish-mexico`. RFC 5646 defines BCP 47 language tags.

---

## EH. Locale fallback should be deterministic

Example: `es-MX`. If a translation unavailable: `es`, then product default according to localization architecture.

Do not randomly mix English date format with Spanish month names.

---

## EI. Timezone and locale settings should not overwrite each other

User changes language English → Spanish: do not change timezone. User changes timezone New York → Los Angeles: do not change language. Independent preferences.

---

## EJ. Stored timestamps must remain language-neutral

Never store `September 8, 2026` as canonical data. Store `2026-09-08` or appropriate structured temporal type. Formatting happens at presentation boundary.

---

## EK. Database queries should use canonical temporal boundaries

For appointments tomorrow, calculate tomorrow's start/end in target timezone, convert to instants, query using canonical range.

Do not use database server's CURRENT_DATE unless target timezone is intentionally that same timezone.

---

## EL. Background jobs must not depend on machine-local timezone

Scheduler: send reminder at 9 AM Eastern. Job runner could be in Germany/UTC. Convert rules centrally.

Never cron `0 9 * * *` and assume Eastern unless infrastructure explicitly handles timezone and DST correctly.

---

## EM. Long-term schedules should not be precomputed indefinitely when timezone rules can change

You can precompute near-term send jobs. But for schedules months/years ahead, consider preserving semantic rule and recalculating as execution approaches.

The key is: don't throw away the rule and keep only a stale future UTC calculation.

---

## EN. Recompute future reminders when timezone changes materially

If appointment's timezone changes, all future appointment-relative communication needs review/recalculation. Do not leave original UTC `send_at` without checking semantics.

---

## EO. Queue retry timestamps are elapsed/system time

Retry in 5 minutes typically means elapsed duration. This is different from tomorrow at 9 AM. Use the right temporal type.

---

## EP. Rate limits use elapsed windows, not civil scheduling arithmetic

Example: max 5 attempts per hour should not depend on daylight-saving transitions. Use elapsed/system-time semantics.

Again, one generic date library call does not fit every domain.

---

## EQ. Customer-visible time should always be traceable back to authoritative data

If user asks "Why did this reminder send at 8 AM?", support should be able to reconstruct appointment time, timezone, reminder rule, business hours, relevant DST rule, and actual send instant.

Temporal decisions should be auditable.

---

## ER. Timeline events need exact authoritative timestamps

Appointment timeline "Reminder sent · 9:00 AM" should derive from actual send event timestamp.

- **Planned:** Scheduled for 9:00 AM
- **Actual:** Sent at 9:00:03 AM

Keep these distinct.

---

## ES. Planned and actual times are different fields

For reminders: `scheduled_at`, `attempted_at`, `sent_at`, `delivered_at` may all differ. Do not overwrite one timestamp. This supports reliable diagnostics.

---

## ET. Calendar modification timestamps are not appointment start times

Provider APIs often expose created, lastModified, start, end. Preserve semantics. Never use latest modified timestamp as event start accidentally.

---

## EU. User-entered timezone must be validated against supported IANA identifiers

Don't accept arbitrary "Eastern USA Time Zone" as canonical storage. Resolve to valid supported zone. If alias accepted, normalize appropriately.

---

## EV. Timezone aliases need deliberate canonicalization

Timezone databases can contain aliases. Use library/IANA normalization where appropriate.

Don't create duplicate preference records merely because `US/Eastern` and `America/New_York` refer to equivalent zone data.

---

## EW. Preserve unknown provider timezone where mapping fails

If provider returns a timezone Transovo doesn't recognize, do not silently map it to UTC. Flag "Unsupported timezone mapping" and preserve raw source for diagnostics.

Wrong confident conversion is worse than explicit degraded state.

---

## EX. Temporal errors must fail safely

If timezone data unavailable, do not schedule "probably 2 PM." Block consequential scheduling or fall back only if product policy defines a safe explicit fallback.

For appointment systems, uncertain time should not become a silent booking.

---

## EY. Do not use AI to repair timezone corruption automatically

AI should not see "Unknown zone FooTime" and decide "probably New York." Use deterministic mappings or require clarification.

---

## EZ. Temporal normalization belongs in a shared library/service

**Cursor rule:** All appointment/calendar/reminder/workflow/payment/reporting modules must reuse canonical temporal utilities rather than implementing timezone/date arithmetic independently.

This should include parse, format, convert, interval, recurrence, DST validation, range calculation, and locale formatting.

---

## FA. Temporal logic should never be duplicated between client and server without shared contract

Frontend can preview. Server is authoritative.

If frontend calculates reminder = Monday 9 AM and backend calculates Monday 10 AM, the product is broken. Use shared logic/contracts or authoritative server evaluation.

---

## FB. Server should return canonical computed temporal state where helpful

Example Appointment Detail: `appointment.start`, `appointment.end`, `appointment.timezone`, `reminders[].scheduled_at`. UI formats.

Don't make every page recompute domain rules differently.

---

## FC. Temporal formatting and temporal computation must be separated

Formatting function: instant → "Sep 8 · 2:00 PM". Computation function: appointment + reminder rule → send instant.

Do not mix. Localization cannot alter business scheduling semantics.

---

## FD. Test the same instant under multiple locales/timezones

Example instant `2026-09-08T18:00:00Z` should display correctly for en-US + America/New_York, en-GB + Europe/London, es-MX + America/Mexico_City.

This certifies separation of storage and presentation.

---

## FE. Temporal test fixtures should include DST-rule dates, not only current month

Hard-code representative known transition scenarios through supported timezone library/tzdb version. When tzdb rules update, verify affected tests intentionally.

---

## FF. Don't hard-code expected future political timezone rules beyond authoritative tzdb

Tests far into future should account for the fact rules can change. Use current authoritative data, not assumptions.

---

## FG. Timezone database version should be discoverable operationally

For debugging difficult scheduling bugs, it is useful to know tzdb version used by runtime. No need to expose to ordinary customer. Log/diagnostics should allow engineering to identify it.

---

## FH. Calendar sync logs should include timezone context for failures

Developer diagnostics can include provider zone, mapped IANA zone, local start, computed instant without exposing unrelated sensitive data. This makes DST bugs diagnosable.

---

## FI. Timezone bugs are data-integrity bugs

Cursor should treat a booking at the wrong time as serious, not cosmetic.

Temporal correctness affects missed appointments, reminders, calendar conflicts, payments, and customer trust. Time correctness belongs in core domain invariants.

---

## Transovo Date / Time / Timezone / Locale Acceptance Checklist

Every applicable scheduling/time feature should pass:

- [ ] Instant, local date/time, UTC offset, and IANA timezone are modeled separately
- [ ] Machine timestamps use unambiguous ISO 8601/RFC 3339-compatible representation
- [ ] Four-digit years are used
- [ ] Ambiguous locale numeric dates are not used as canonical data
- [ ] Historical/event timestamps are stored as authoritative instants
- [ ] Future civil-time appointments preserve their IANA timezone
- [ ] UTC offset is never substituted for timezone identity
- [ ] Timezone abbreviations are not canonical identifiers
- [ ] IANA tz database is used for timezone/DST rules
- [ ] Runtime timezone data has an update strategy
- [ ] Server machine timezone cannot alter product logic
- [ ] Workspace, user, contact, appointment, and viewer timezone are not conflated
- [ ] Appointment timezone remains authoritative to the scheduled event
- [ ] Booking page clearly identifies timezone
- [ ] Browser timezone detection can be corrected
- [ ] Today/tomorrow logic specifies timezone context
- [ ] Analytics/reporting date boundaries specify timezone
- [ ] DST nonexistent times are detected
- [ ] DST ambiguous times are handled deterministically
- [ ] Calendar-day arithmetic is not replaced with fixed-second arithmetic
- [ ] 1 day and 24 hours are treated as different semantics
- [ ] Reminder scheduling uses intended civil timezone
- [ ] Rescheduling recalculates dependent future times
- [ ] Past-due reminder policy is deterministic
- [ ] Business-day/weekend/holiday handling uses civil calendar semantics
- [ ] Business hours have an explicit timezone basis
- [ ] Availability conflicts compare authoritative instants
- [ ] Imported events preserve original timezone context
- [ ] All-day events use date semantics
- [ ] Date-only values are not converted into arbitrary UTC midnights
- [ ] Time-only values are not treated as instants
- [ ] Recurring schedules preserve local time + timezone + recurrence
- [ ] Recurrence is not implemented as fixed seconds between occurrences
- [ ] Recurrence exceptions are preserved
- [ ] Recurring edit scope is explicit
- [ ] Interval boundaries use one documented convention
- [ ] Adjacent appointments do not require fake one-second gaps
- [ ] Duration has explicit units/type
- [ ] APIs include offset/timezone semantics where required
- [ ] Future recurrence preserves IANA zone in addition to RFC timestamp
- [ ] Locale and timezone are stored separately
- [ ] Language tags follow BCP 47
- [ ] Human formatting uses Unicode CLDR/platform Intl data
- [ ] 12/24-hour format follows locale/user settings
- [ ] Week-start rules are locale-aware where appropriate
- [ ] Relative dates are used only in appropriate contexts
- [ ] Exact time remains available for consequential/audit states
- [ ] Timezone selector uses/searches canonical IANA zones
- [ ] Missing timezone is represented honestly
- [ ] Temporal fallback hierarchy is centralized
- [ ] Timezone changes explain impact
- [ ] Display timezone changes preserve the underlying instant
- [ ] Appointment timezone changes distinguish preserve-instant vs preserve-wall-time
- [ ] Microsoft/Google sync preserves correct timezone semantics
- [ ] Calendar round-trip does not drift event times
- [ ] Recurrence round-trip is tested across DST
- [ ] Audit logs record authoritative instants
- [ ] Sorting uses temporal values rather than formatted strings
- [ ] Date-range queries use timezone-aware half-open boundaries
- [ ] Local day is not assumed to equal exactly 24 hours
- [ ] Calendar month/year arithmetic is not replaced by fixed durations
- [ ] Standard libraries handle leap-year/calendar rules
- [ ] Non-whole-hour timezone offsets are supported
- [ ] No hard-coded DST/offset math exists
- [ ] Canonical temporal types have descriptive names
- [ ] Locale-formatted strings are never parsed as authoritative stored values
- [ ] APIs document each temporal field's semantics
- [ ] CSV/ICS exports preserve unambiguous timezone/date meaning
- [ ] Template preview and runtime use the same temporal formatter
- [ ] AI receives explicit date/time/timezone context
- [ ] AI does not authoritatively calculate availability/timezone conversion
- [ ] Messaging windows specify timezone basis
- [ ] Planned, attempted, sent, and delivered times remain distinct
- [ ] Unknown timezone mappings fail explicitly rather than silently becoming UTC
- [ ] Temporal computation is centralized
- [ ] Client/server temporal logic cannot diverge
- [ ] DST/month/year/timezone boundary tests exist
- [ ] Multiple representative IANA zones are covered in tests

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & auth
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale (this file)
Guide #4 (coming)                                        → Interaction, keyboard & focus
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #10: Date, Time, Timezone & Locale Standards. Next: Guide #11 — `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`.*
