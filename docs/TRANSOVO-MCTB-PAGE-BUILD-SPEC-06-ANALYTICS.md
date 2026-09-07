# Transovo MCTB Page Build Spec — 06: Analytics

**Status:** Active — mandatory implementation specification  
**Route:** `/mctb/analytics`  
**Product:** Missed Call Text Back  
**Page archetype:** Operational analytics / performance reporting  
**Canonical navigation:** MCTB → Analytics  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product analytics/reporting screenshots + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-06-analytics.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

The MCTB Analytics page exists to measure whether Missed Call Text Back is operating and recovering missed-call opportunities. It must use authoritative runtime data, explicit metric definitions, consistent date/time boundaries, and meaningful drilldowns into canonical operational records. It must not become generic voice analytics, AI-agent analytics, provider diagnostics, or a dashboard full of vanity metrics. Metrics shown here must describe actual MCTB activity such as missed calls, eligible recoveries, recovery texts, delivery, replies, voicemail, suppression, failures, and downstream recovery outcomes only where those outcomes are truly known. No mock data, fake percentages, inferred bookings, invented revenue, or ambiguous "success" metrics are allowed.

---

## 2. Primary user question

"Is Missed Call Text Back actually recovering my missed calls?"

Secondary questions:

* How many calls did I miss?
* How many were eligible to text?
* How many texts were actually sent?
* Were they delivered?
* How many customers replied?
* How many conversations required follow-up?
* How many left voicemail?
* Why were some callers not texted?
* Is performance changing over time?
* Which records make up these numbers?

---

## 3. Primary job

Exactly one primary job:

Measure the MCTB recovery funnel and expose enough drilldown to explain the results.

Do not turn Analytics into:

* Setup
* Compliance center
* Missed Calls list
* Conversation inbox
* provider monitoring console
* AI dashboard

---

## 4. Screenshot calibration requirement

Before styling this page, Cursor must inspect/screenshoot finished Appointment pages demonstrating:

* analytics page header
* date-range controls
* KPI strip/cards
* chart treatment
* legend/tick typography
* segmented controls
* table drilldowns
* empty/loading/error states
* mobile analytics transformation

Reuse the same:

* typography
* spacing
* card/surface language
* chart system
* date control
* filter controls
* status treatment

MCTB metrics are different; visual language is shared.

---

## 5. Page anatomy

Recommended:

```
Global shell
    ↓
Page header
    ↓
MCTB local nav
    ↓
Date range / timezone controls
    ↓
Primary KPI region
    ↓
Recovery funnel
    ↓
Trend charts
    ↓
Suppression / failure breakdown
    ↓
Voicemail / engagement section
    ↓
Operational drilldowns
```

Do not put ten charts above the fold.

---

## 6. Page header

**H1**

Analytics

Optional description:

See how missed-call recovery is performing.

**Right-side controls**

Primary controls:

* Date range
* possibly Business line for multi-line workspace

Do not put Setup actions in the Analytics header.

---

## 7. Date ranges

Current known supported ranges:

* 7 days
* 30 days
* 90 days

Potentially Custom if runtime supports it.

Recommended control:

Last 7 days  
Last 30 days  
Last 90 days  
Custom

Do not fabricate custom range support if backend only supports fixed windows.

---

## 8. Reporting timezone

Analytics must explicitly use a canonical reporting timezone.

Usually:

Workspace timezone

Display somewhere appropriate:

Times shown in America/New_York

or user-friendly:

Eastern Time

Do not group "Today" using server timezone.

---

## 9. Primary KPI set

Recommended top metrics:

1. Missed calls
2. Recovery texts sent
3. Customers replied
4. Recovered conversations

Fourth metric only if "Recovered conversation" has a formally defined authoritative meaning.

If not yet defined, use:

Reply rate

with explicit denominator.

---

## 10. KPI definitions must be locked

Examples:

**Missed calls**

Count of canonical MCTB missed-call events in date range.

**Recovery texts sent**

Count of actual MCTB recovery conversation messages successfully sent.

Clarify whether system compliance confirmation is excluded from this metric.

Recommended:

Do not count the Press-1 compliance confirmation as a separate recovery text.

It is a required system message, not the business recovery outreach KPI.

**Customers replied**

Distinct missed-call conversations in which caller sent at least one inbound reply during the applicable recovery journey.

**Reply rate**

Recommended denominator:

Customers replied ÷ Recovery conversations with at least one recovery message delivered

Or another explicitly agreed denominator.

Do not use different denominators on different pages.

---

## 11. Do not confuse send rate with consent rate

These are different metrics.

Potential:

Eligible for text-back  
Recovery texts sent  
Delivered  
Replied

Do not label:

Consent rate

when denominator actually includes sender blocks or schedule suppression.

---

## 12. Recovery funnel

This is likely the most useful visualization.

Canonical conceptual funnel:

```
Missed calls
    ↓
Eligible for recovery
    ↓
Recovery text sent
    ↓
Delivered
    ↓
Customer replied
```

Potential later:

Business followed up  
    ↓  
Recovered

only if those downstream states are authoritative.

---

## 13. Press-1 handling in funnel

For Press-1 mode, the funnel may include:

```
Missed calls
    ↓
Consent captured
    ↓
Recovery text sent
    ↓
Delivered
    ↓
Replied
```

But if a workspace uses mixed consent modes, use a more general funnel:

```
Missed calls
    ↓
Eligible
    ↓
Texted
    ↓
Delivered
    ↓
Replied
```

Then show consent method breakdown separately.

This avoids forcing Press-1 terminology into Existing Consent accounts.

---

## 14. Eligibility metric

"Eligible" must come from the centralized eligibility engine.

Do not infer it as:

missed calls - failed sends

That is wrong.

Ineligibility can occur before send.

---

## 15. Funnel drop-off drilldown

Every meaningful funnel stage should support investigation.

Examples:

12 ineligible → opens filtered Missed Calls showing relevant reason codes.

5 failed delivery → filtered Missed Calls with message-failure filter.

18 replied → filtered Conversations.

This prevents analytics from becoming a dead-end visualization.

---

## 16. Trend section

**Heading**

Recovery over time

Potential chart series:

* Missed calls
* Recovery texts
* Replies

Avoid charting ten series together.

A second chart may show:

* Reply rate

if useful.

---

## 17. Chart requirements

* Real data only
* Canonical shared chart component
* Accessible data equivalent
* Locale-aware axes
* Clear series labels
* No misleading 3D charts
* No decorative gradients
* No truncated zero axis where that would mislead
* No huge chart area for tiny data

---

## 18. Empty chart state

If no data:

No recovery activity in this period.

Do not render zero-value fake chart lines across the entire period if that creates visual noise.

---

## 19. Suppression breakdown

**Heading**

Why some callers weren't texted

This is more user-friendly than:

Suppression reasons

though "Suppressed" remains valid canonical state.

Show real reason categories such as:

* Customer opted out
* Consent not available
* Business exclusion
* Cooldown active
* Message limit reached
* Sender unavailable
* Sender registration required
* Outside allowed window
* Provider suppression

Only actual runtime reason codes.

---

## 20. Suppression is not failure

This section must visually distinguish:

**Correctly suppressed**

System intentionally did not send.

Examples:

* opted out
* excluded
* cooldown
* no consent

**Failed**

System attempted but could not complete.

Examples:

* provider rejection
* delivery failure
* system error

Do not combine these into one "Failed texts" metric.

---

## 21. Suppression drilldowns

Example:

Customer opted out  
14  
View calls

→ filtered Missed Calls.

Same canonical data.

---

## 22. Delivery breakdown

Potential section:

Message delivery

Metrics:

* Sent
* Delivered
* Failed
* Suppressed before send

Do not treat:

* Queued
* Sending

as final analytics categories unless reporting period contains legitimately still-processing messages.

---

## 23. Delivery rate

Define denominator explicitly.

Recommended:

Delivered recovery messages ÷ Recovery messages sent

Do not include suppressed messages in denominator if they were never sent.

---

## 24. Consent analysis

Potential section if useful:

Consent method

Breakdown:

* Verified Call Consent
* Existing Consent

Potential stats:

* events by method
* Press-1 completion rate if meaningful

Be cautious.

Do not display a broad legal/compliance quality score.

---

## 25. Press-1 completion rate

If shown:

Consent captured ÷ Callers actually presented with the Press-1 prompt

not all missed calls.

A caller who never reached the prompt should not necessarily count as failed consent.

Metric definition must match actual instrumentation.

---

## 26. Voicemail analytics

Now that Visual Voicemail is first-class, Analytics should include meaningful voicemail outcomes.

Recommended section:

Voicemail

Possible metrics:

* Voicemails received
* Voicemail rate
* Voicemails with customer reply afterward
* Voicemails needing follow-up
* Average voicemail duration only if genuinely useful
* Transcription availability only if operationally useful

Do not show AI-summary generation count as a vanity business KPI.

---

## 27. Voicemail rate definition

Possible:

Voicemails received ÷ Missed-call events where voicemail was available

or another actual product definition.

Do not simply divide by every call without validating the denominator.

---

## 28. Voicemail drilldown

17 voicemails → `/mctb/voicemail` filtered to selected period.

4 need follow-up → Voicemail filtered to Needs follow-up.

---

## 29. Conversation analytics

Potential:

* Conversations started
* Customers replied
* Needs reply
* Median first business response time

Response-time metrics are useful if authoritative.

---

## 30. Response time

If shown, define:

Time from customer's first reply to business's first response

or whatever exact definition is adopted.

Do not mix:

* time from missed call
* time from text delivery
* time from customer reply

under one "Response time" label.

---

## 31. Median vs average

For response times, median may often be more robust than average.

But Cursor must not arbitrarily change metric type.

Lock the product definition once chosen.

If using median:

Label:

Median response time

not simply:

Response time

---

## 32. Recovery outcome

This must be handled carefully.

Do not show:

Recovered revenue

unless payment/appointment/business outcome is authoritative.

Do not show:

Recovered calls

if current definition is merely "customer replied."

A reply is not necessarily recovered revenue.

---

## 33. Recommended V1 outcome terminology

Until downstream conversion is authoritative:

Use:

* Replied
* Conversation started
* Business responded

Potential KPI:

Engaged conversations

if formally defined.

Avoid overclaiming "Recovered."

---

## 34. Future appointment integration

If MCTB can later authoritatively link to appointments booked after recovery:

Potential:

Appointments booked

can appear.

But only when:

* appointment is canonical
* attribution logic is defined
* timeframe is defined
* duplicate attribution is prevented

Do not infer booking from link click.

---

## 35. Link activity

Potential supporting metrics:

* Recovery-link clicks
* Request-form opens
* Request-form submissions

These are secondary.

Do not elevate above replies/recovery.

---

## 36. Link click != conversion

Never label:

Recovered

just because customer clicked.

Use:

Link clicked

or:

Request submitted

---

## 37. Repeat caller analytics

Potential useful secondary section:

* Repeat callers
* repeat-call rate

Definition must be explicit.

Example:

Caller with 2+ missed-call events in selected period

Only if this provides actionable value.

---

## 38. Business-line filter

For customers with multiple lines:

Filter:

Business line

This should update:

* KPIs
* funnel
* charts
* breakdowns

consistently.

Single-line customers should not need a useless filter.

---

## 39. Sender filter

Usually do not expose sender filter unless customers genuinely manage multiple senders.

Remember:

Business line and text-back sender are separate.

Do not confuse them in analytics.

---

## 40. Analytics event identity

Metrics should be derived from canonical domain events, not UI state.

Possible event families:

missed_call_detected  
eligibility_evaluated  
consent_captured  
recovery_message_scheduled  
recovery_message_sent  
recovery_message_delivered  
recovery_message_suppressed  
recovery_message_failed  
customer_replied  
business_replied  
voicemail_received  
link_clicked  
request_form_submitted

Exact backend event names may differ.

Do not rename stable event contracts casually.

---

## 41. Distinct counts vs event counts

Be explicit.

Example:

Replies

Could mean:

* number of inbound SMS messages  
  or
* number of conversations where customer replied

Recommended KPI is usually the latter:

Customers replied

This avoids one caller sending six messages inflating the metric.

Detailed analytics may separately show inbound message count if useful.

---

## 42. Multi-call caller handling

If one caller has three missed calls:

Missed calls = 3

If they enter one SMS conversation:

Customers replied = 1

Do not accidentally count one thread three times.

Metric entity/denominator must be explicit.

---

## 43. Period attribution

If missed call occurs Sep 7 at 11:58 PM and reply occurs Sep 8 at 12:05 AM, decide attribution.

Two valid approaches:

**Event-date reporting**

Missed call counted Sep 7; reply counted Sep 8.

**Cohort reporting**

Reply attributed back to Sep 7 missed-call cohort.

Do not mix approaches silently.

For general dashboard analytics, event-date reporting is simpler unless product explicitly needs cohort recovery.

---

## 44. Recommended V1 date model

Use:

* Missed-call metrics by event timestamp
* Send/delivery metrics by message event timestamp
* Reply metrics by reply timestamp

If recovery-rate calculation uses cohorts, clearly define it.

Cursor should not invent cohort logic in frontend.

---

## 45. Date/time DST handling

All range queries must honor IANA timezone and DST.

Use half-open ranges:

[start, end)

No server-local midnight assumptions.

---

## 46. Comparison period

If Appointment analytics already supports prior-period comparison, MCTB may reuse it.

Examples:

+12% vs previous 30 days

Only if:

* comparison algorithm real
* ranges comparable
* zero-denominator handled
* label is understandable

Do not add comparison arrows decoratively.

---

## 47. Percentage edge cases

If previous period = 0:

Do not show:

+∞%

Use appropriate language:

No activity in previous period

or omit percentage.

---

## 48. Partial current period

If selected period includes today, data is naturally incomplete.

Usually no warning needed.

But do not compare today's partial day to full yesterday as though identical without a deliberate algorithm.

---

## 49. Data freshness

If analytics is near-real-time, simply show current data.

If analytics pipeline has known delay:

Data may take up to 5 minutes to appear.

only if factual.

Do not invent freshness messaging.

---

## 50. Needs-attention analytics

Analytics should not become a diagnostic queue.

However, useful performance issue callouts can appear:

Delivery failures increased this week

only if derived from real data and threshold definition.

Do not use AI to invent vague warnings.

Operational fixes belong in Home/Setup.

---

## 51. Diagnostics vs analytics

Do not show:

* provider webhook health
* Telnyx SIP response codes
* call-control errors
* raw A2P states

as analytics charts.

Those belong in Setup/diagnostics/compliance.

---

## 52. Analytics card hierarchy

Top KPI cards:

4 maximum-ish at first glance.

Secondary metrics can live in grouped sections.

Avoid 14 equal cards.

The page should tell a story:

Missed → Reached/eligible → Texted → Delivered → Replied

---

## 53. Color discipline

Use same Transovo chart/status palette.

Do not assign random colors per metric.

Healthy charts should be neutral/accent-oriented.

Use warning/error colors only for actual warning/failure semantics.

---

## 54. Funnel visual accessibility

If visual funnel used, include textual/tabular equivalent.

Screen reader should understand:

Missed calls: 100  
Eligible: 72  
Recovery texts sent: 68  
Delivered: 65  
Customers replied: 24

No reliance on shape width alone.

---

## 55. Chart hover alternatives

Tooltips are supplemental.

Critical values must not exist only on hover.

Keyboard/focus equivalent where chart library supports it.

Text/data table equivalent for accessibility.

---

## 56. Analytics loading state

Use geometry-matched skeletons.

Do not flash zeros.

Controls can remain visible but disabled appropriately during initial load.

---

## 57. First-use state

If MCTB setup incomplete:

Do not show fake empty analytics.

Show:

Analytics will appear after Missed Call Text Back is active.  
Finish setup and run a live test to begin collecting recovery data.  
[Continue setup]

---

## 58. Active but no-data state

No MCTB activity in this period.  
Try a different date range.

Do not imply setup is broken if it is active.

---

## 59. Filtered no-data

If business-line filter causes zero data:

No activity for this business line in the selected period.

Provide clear filter reset/change.

---

## 60. Error state

If all analytics fails:

Analytics couldn't be loaded.  
[Retry]

Keep shell/nav/date control context where possible.

---

## 61. Partial/degraded state

Some metrics may load while a secondary dataset fails.

Example:

* missed calls/replies available
* voicemail analytics unavailable

Show voicemail section local error.

Do not wipe the entire page.

---

## 62. Data disagreement prevention

Analytics must not compute parallel frontend definitions that disagree with:

* Home
* Missed Calls
* Conversations
* Voicemail

Use shared metrics backend/service where possible.

---

## 63. Drilldown routes

Examples:

Missed calls → `/mctb/missed-calls?from=...&to=...`  
Customers replied → `/mctb/conversations?status=replied&from=...&to=...`  
Suppressed → `/mctb/missed-calls?recovery=suppressed&...`  
Voicemails → `/mctb/voicemail?from=...&to=...`

Preserve reporting period in drilldown.

---

## 64. Drilldown return context

If user drills from Analytics:

Analytics · Last 30 days → Suppressed calls → call detail → back

the context should remain meaningful.

At minimum, filtered operational destination retains date/reason filter.

---

## 65. Export

Do not add export by default unless existing analytics product supports it and there is real user need.

If CSV export already exists as a canonical pattern, it can be considered.

Export must reflect active filters/date range and real data.

No mock export button.

---

## 66. Reports relationship

MCTB Analytics is the product-specific performance home.

Global Reports may contain summarized MCTB data.

Do not create a separate MCTB Reports page with the same charts.

One canonical MCTB analytics surface.

---

## 67. Mobile layout

Order:

Analytics  
Date range  
KPIs  
Recovery funnel  
Recovery trend  
Why callers weren't texted  
Delivery  
Replies  
Voicemail

Stack charts vertically.

Do not put two unreadable charts side by side on phone.

---

## 68. Mobile chart interaction

Charts must work without hover.

Tap/focus data points if supported.

Critical data remains available in textual/table form.

No horizontal page scrolling.

---

## 69. Tablet layout

KPI cards 2×2 if needed.

Charts may remain full-width or two-column only when readable.

Do not preserve desktop density at cost of legibility.

---

## 70. 320px reflow

Must pass with:

* date selector
* KPI values
* funnel
* chart legends
* breakdown labels
* drilldown links

Long translated labels must wrap.

---

## 71. 200%/400% zoom

Audit:

* chart legend overlap
* KPI truncation
* dropdowns
* date controls
* sticky headers if any
* data table equivalents

No content obscured.

---

## 72. Accessibility

At minimum:

* one H1
* semantic section headings
* date controls labeled
* KPI meaning programmatic
* charts have accessible alternatives
* data tables semantic
* status/failure not color-only
* drilldown links descriptive
* keyboard operation
* visible focus
* no hover-only information
* 200% text
* 320px reflow
* localized numeric/date formatting

---

## 73. Number formatting

Use locale-aware formatting.

Examples:

1,248  
45.2%

depending locale.

Do not hard-code commas/periods.

---

## 74. Percent precision

Do not show fake precision like:

43.71842%

Recommended:

* whole percentage
* one decimal where materially useful

Stay consistent with Transovo analytics conventions.

---

## 75. Metric tooltips

If a metric could be misunderstood, provide info/help.

Example:

**Reply rate**

Percentage of delivered recovery conversations where the customer replied.

Use the exact locked definition.

This is especially important for:

* Reply rate
* Delivery rate
* Recovery rate
* Consent completion
* Voicemail rate

---

## 76. Analytics terminology

Prefer:

* Missed calls
* Recovery texts
* Delivered
* Customers replied
* Reply rate
* Voicemails
* Suppressed
* Delivery failures

Avoid:

* Leads saved
* Revenue rescued
* Opportunities recovered

unless those concepts are formally defined and measured.

---

## 77. No AI-generated analytics narrative by default

Do not put:

"AI says your recovery performance is excellent!"

on the page.

If an analytics summary is later introduced, it must be grounded and clearly assistive.

V1 should favor direct metrics.

---

## 78. Privacy

Analytics should aggregate wherever possible.

Do not expose caller PII in charts.

Drilldown into operational records remains permission-controlled.

---

## 79. Tenant scoping

All analytics queries are workspace scoped server-side.

Business line filters cannot be used to escape workspace scope.

No cross-customer counts.

---

## 80. Authorization

A role may have:

* Analytics view access
* no Setup edit access

That should work.

Do not require configuration permission merely to view performance.

---

## 81. Runtime metrics service

Cursor should prefer a centralized MCTB metrics service rather than every page independently querying/counting raw records.

Conceptually:

getMctbSummary(range, filters)  
getMctbFunnel(range, filters)  
getMctbTrends(range, filters)  
getMctbSuppressionBreakdown(range, filters)  
getMctbVoicemailMetrics(range, filters)

Exact architecture depends on existing backend.

Do not duplicate logic across components.

---

## 82. Metric contracts should be tested

Each important metric should have tests for edge cases:

* zero data
* one caller multiple messages
* repeat caller multiple calls
* Press-1 not completed
* suppression
* failed delivery
* opt-out
* voicemail
* cross-midnight
* DST
* multiple business lines

---

## 83. Performance

Analytics queries should not scan uncontrolled raw message history client-side.

Use backend aggregation/pagination/caching where appropriate.

Do not download 50,000 records to calculate four KPI cards in React.

---

## 84. URL state

Prefer meaningful URL state for:

* date range
* business line
* possibly selected tab/view

Example:

`/mctb/analytics?range=30d`

or canonical app pattern.

This improves back/forward/deep-link behavior.

---

## 85. Refresh behavior

Refreshing page preserves:

* range
* filters

through URL or canonical state persistence.

Do not reset unexpectedly to 7 days.

---

## 86. Visual hierarchy

Strongest:

1. KPI outcomes
2. Recovery funnel
3. Trend
4. Suppression/failure explanations
5. Voicemail/secondary engagement

Do not make secondary provider or AI metrics louder.

---

## 87. Analytics prohibited patterns

Cursor must not:

* reuse generic voice-AI analytics without remapping to MCTB
* show AI minutes
* show call transfer metrics
* show agent sentiment
* show talk-time metrics
* show hallucinated bookings
* show mock percentages
* combine suppression and failure
* call every reply a recovered sale
* count compliance confirmation as a separate recovery outreach
* infer consent from sent message
* use server-local reporting dates
* render inaccessible charts
* expose raw provider reason codes
* create duplicate `/voice/analytics` implementation

---

## 88. Test scenarios

Cursor must certify at least:

**A. Full healthy 30-day period**

* missed
* eligible
* sent
* delivered
* replied
* voicemail
* drilldowns agree with lists

**B. Mixed Press-1 + Existing Consent**

* funnel remains conceptually correct
* consent breakdown accurate

**C. High suppression**

* suppression not counted as failure
* reason breakdown sums correctly

**D. Delivery failures**

* sent denominator correct
* delivery rate accurate

**E. Repeat caller**

* missed call count counts events
* customer-replied count does not inflate per message

**F. Voicemail**

* voicemail counts match Voicemail page

**G. Midnight/date boundary**

* correct reporting timezone

**H. DST transition**

* no duplicate/missing daily buckets

**I. No data**

* real empty state

**J. Partial analytics service failure**

* unaffected sections remain

**K. Mobile**

* charts readable
* drilldowns accessible
* no horizontal page scroll

**L. Screen reader/keyboard**

* all key analytics understandable without visual chart alone

---

## 89. Definition of done — Analytics

Cursor may mark `/mctb/analytics` complete only when:

* [ ] Uses canonical Transovo shell
* [ ] Uses canonical MCTB navigation
* [ ] Matches finished Appointment analytics visual language
* [ ] Date range is real and preserved
* [ ] Reporting timezone is canonical
* [ ] Missed-call metric definition locked
* [ ] Recovery-text metric definition locked
* [ ] Compliance confirmation is not incorrectly counted as separate recovery outreach
* [ ] Customer reply metric counts the intended entity
* [ ] Reply-rate denominator is documented
* [ ] Eligibility comes from canonical eligibility engine
* [ ] Funnel stages use real events
* [ ] Suppression and failure remain distinct
* [ ] Delivery-rate denominator is documented
* [ ] Consent metrics do not overstate legal conclusions
* [ ] Voicemail metrics integrated
* [ ] Voicemail drilldowns use canonical Voicemail page
* [ ] Conversation drilldowns use canonical Conversations
* [ ] Missed-call drilldowns use canonical Missed Calls
* [ ] No invented recovery/revenue metric
* [ ] No mock analytics
* [ ] No generic Voice AI metrics leak into MCTB
* [ ] Charts have accessible equivalents
* [ ] Empty/loading/error/partial states complete
* [ ] Multi-line filter works where applicable
* [ ] URL/query state persists where appropriate
* [ ] Refresh preserves range/filter context
* [ ] Cross-page totals agree
* [ ] DST/timezone tests pass
* [ ] Locale formatting works
* [ ] Tenant scoping enforced
* [ ] Permission model correct
* [ ] Desktop/tablet/mobile complete
* [ ] 320px reflow passes
* [ ] 200%/relevant 400% zoom passes
* [ ] Keyboard/screen-reader QA passes
* [ ] Legacy `/voice/analytics` does not remain a separate competing MCTB analytics implementation

---

## Build handoff

Next page-spec: **07 — Setup & Guided Setup** — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-07-SETUP.md`.
