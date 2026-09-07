# Transovo MCTB Page Build Spec — 12: Recovery Controls & Follow-up Rules

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup/recovery`  
**Wizard role:** No dedicated first-time step required beyond sensible defaults  
**Product:** Missed Call Text Back  
**Page archetype:** Operational control + focused configuration editor  
**Canonical navigation:** MCTB → Setup → Recovery Controls  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs (including **spec 07 — Setup architecture**)

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-12-recovery-controls.mdc` (`alwaysApply: true`)

**Architecture note:** This spec **replaces** the planned standalone **Business Hours / Schedule** page. MCTB does not use a weekly business-hours scheduler — carrier conditional forwarding determines when unanswered calls reach Transovo.

---

## 1. Master Cursor rule

Recovery Controls manages whether MCTB recovery is currently Active or Paused and limits how frequently repeat missed calls can generate additional automated recovery messages. MCTB does not need a traditional Business Hours schedule because the customer's carrier and conditional-forwarding behavior determine when unanswered calls reach Transovo. Do not recreate a weekly business-hours scheduler. Instead, provide simple operational pause/resume controls and focused follow-up rules such as repeat-caller cooldown and maximum automated recovery attempts. Pausing recovery must not be confused with disabling carrier forwarding, recipient opt-out, sender readiness, or deleting configuration.

---

## 2. Why there is no Business Hours page

This is a hard architecture correction.

MCTB operates because:

```
Customer calls business number
    ↓
Business answers
    → Nothing goes to MCTB
OR
Business doesn't answer / line is busy / unreachable
    ↓
Carrier conditionally forwards call
    ↓
Transovo receives missed call
```

Therefore Transovo does not need to decide:

"Is the business open right now?"

to determine whether a call was missed.

The business itself effectively determines this simply by answering or not answering.

So remove the planned standalone:

**Business Hours / Schedule**

configuration from MCTB.

---

## 3. What this page owns

This page owns two related things:

**Operational recovery control**

* Active
* Pause temporarily
* Pause for one day
* Pause for a chosen duration
* Pause until a specified time
* Pause indefinitely until manually resumed
* Resume now

**Follow-up rules**

* Repeat-caller cooldown
* Maximum automated recovery attempts/messages
* duplicate/repeat recovery behavior
* other existing repeat/follow-up safeguards actually supported by runtime

Nothing more.

---

## 4. What this page does NOT own

Do not add:

* weekly opening hours
* Monday-Friday schedule editor
* after-hours routing
* holiday hours
* employee shifts
* appointment availability
* conditional-forwarding instructions
* carrier forwarding enable/disable
* sender registration
* consent
* generic workflow automation
* drip campaigns
* SMS marketing sequences

---

## 5. Page title

Recommended:

**Recovery Controls**

Supporting text:

Pause missed-call recovery temporarily and control how repeat missed calls are handled.

This is clearer than calling the entire page:

Follow-up Rules

because pause/resume is an important operational control.

---

## 6. Setup Overview representation

Inside `/mctb/setup`:

```
Recovery Controls
Active
Repeat caller cooldown
30 minutes
Maximum recovery attempts
2
[Manage]
```

When paused:

```
Recovery Controls
Paused until 3:00 PM
Recovery texts are temporarily stopped.
[Manage]
```

---

## 7. Home relationship

Pause/Resume is operational enough that Home should also expose it.

Healthy example:

```
Missed Call Text Back
Active
[Pause]
```

Paused example:

```
Missed Call Text Back
Paused until 3:00 PM
[Resume now]
```

Home and Setup must use the same canonical state and actions.

Do not implement two pause systems.

---

## 8. Canonical operational state

At minimum:

```
Active
Paused
```

With pause metadata stored separately:

```
pause_started_at
pause_until
pause_mode
paused_by
```

Exact backend structure may differ.

Do not invent multiple overlapping lifecycle states such as:

* Temporarily inactive
* Sleeping
* Snoozed
* Disabled
* Offline

Use one vocabulary.

---

## 9. Active state

Example:

```
Recovery status
Active
Missed calls that qualify for recovery can continue through the normal MCTB flow.
[Pause recovery]
```

Healthy status should remain visually quiet.

No giant green banner.

---

## 10. Pause action

When user chooses:

Pause recovery

open a short controlled interaction.

Recommended choices:

```
Pause recovery
○ For 1 hour
○ For 4 hours
○ For the rest of today
○ Until a specific time
○ Until I turn it back on
```

Exact preset durations can be adjusted to product needs.

The important part is giving both:

* temporary automatic resume
* indefinite manual resume

---

## 11. One-day pause

Because you specifically want this:

Provide a clear option:

For the rest of today

or:

For 1 day

These are not identical.

I recommend exposing:

For the rest of today

because it has clearer business meaning.

If you specifically want exactly 24 hours, label:

For 24 hours

Do not label a 24-hour duration as "today."

---

## 12. Custom duration

Possible control:

For a custom amount of time

Then:

```
Duration
[ 6 ] [hours ▼]
```

Supported units could include:

* hours
* days

Keep the range bounded.

Do not create an overly complex scheduler.

---

## 13. Pause until specific time

Choice:

Until a specific time

Fields:

```
Resume on
Sep 8, 2026

At
8:00 AM

Timezone
Eastern Time
```

Use canonical date/time components.

Store local civil intent + IANA timezone.

---

## 14. Pause indefinitely

Choice:

Until I turn it back on

Supporting:

Recovery stays paused until someone with permission resumes it.

This must be very clear because there is no automatic recovery.

---

## 15. Pause confirmation

For temporary pause:

A normal Save/Confirm action is sufficient.

Example:

Pause recovery

No heavy destructive confirmation dialog necessary.

For indefinite pause, use slightly stronger consequence text:

Recovery texts will remain paused until someone resumes MCTB.

Still do not require typing confirmation phrases.

---

## 16. What pause actually means

This needs to be based on the existing runtime, but the intended MCTB model should be explicit.

**Preferred behavior:**

Calls may continue to be detected/logged

Because the carrier may still forward missed calls to Transovo.

Automated recovery texts do not send while paused

This is the primary effect.

Consent/runtime evidence still behaves according to architecture

Cursor must inspect whether Press-1 prompt should still run while paused or whether paused calls should bypass the consent recovery flow.

**Voicemail**

Voicemail should continue working if the current architecture supports it independently.

Do not accidentally disable Visual Voicemail just because text recovery is paused unless that is the intended backend behavior.

---

## 17. Pause does NOT mean forwarding is disabled

Very important:

```
Pause MCTB
≠
Turn off carrier forwarding
```

The customer's phone carrier does not automatically change because they pressed Pause in Transovo.

Do not say:

Call forwarding paused

unless Transovo actually controls the carrier.

---

## 18. Pause does NOT mean customer opted out

Pause is workspace/business-level operational behavior.

Customer opt-out is recipient-level messaging state.

Do not create suppressions with reason:

`recipient_opted_out`

because the business paused MCTB.

Use a distinct canonical reason/state such as the existing equivalent of:

`recovery_paused`

---

## 19. Pause does NOT mean sender unavailable

Sender can remain:

Ready

while recovery is:

Paused

Keep those states orthogonal.

---

## 20. Scheduled recovery when pause starts

Cursor must inspect the runtime and define this explicitly.

Recommended safe behavior:

```
If an automated recovery message has not yet sent and MCTB becomes paused before send time:
    Send-time eligibility/control recheck
        ↓
    Recovery is paused
        ↓
    Message suppressed/canceled according to canonical state
```

Do not blindly send queued recovery messages after the user pauses the product.

---

## 21. Resume behavior

When automatic pause expires:

MCTB becomes:

Active

again.

Do not automatically send a backlog of old suppressed recovery messages unless the product explicitly defines that behavior.

Recommended:

No backlog blast.

Calls suppressed because MCTB was paused remain historically suppressed.

New qualifying missed calls after resume use normal recovery.

---

## 22. Manual Resume

When paused:

Primary action:

Resume now

On success:

Recovery is active.

Do not require the user to edit/delete the original pause timestamp manually.

---

## 23. Automatic resume status

Show exact state:

```
Paused
Resumes today at 3:00 PM
Eastern Time
```

or:

```
Paused
Resumes Sep 9 at 8:00 AM
Eastern Time
```

If indefinite:

```
Paused
No automatic resume
```

---

## 24. Timezone

For scheduled resume:

Use the workspace's canonical IANA timezone.

Example:

```
Eastern Time
America/New_York
```

Do not calculate using a permanent UTC-4.

DST must behave correctly.

---

## 25. DST behavior

If user chooses:

Resume tomorrow at 8:00 AM

that means 8:00 AM local business time even across DST transition.

Store civil-time intent correctly.

---

## 26. Pause permissions

Not every user necessarily needs permission to pause all MCTB recovery.

Potential roles:

* Owner/admin — yes
* operational manager — possibly
* normal staff — according to canonical permissions

Server authorizes.

Do not rely on hidden button alone.

---

## 27. Pause audit

If canonical audit infrastructure exists, record:

```
MCTB paused
By Sarah
Until Sep 8 at 3:00 PM
```

and:

```
MCTB resumed
By Michael
Sep 8 at 1:22 PM
```

This is operationally useful.

Do not create a separate full audit page for this.

---

## 28. Follow-up Rules purpose

Follow-up Rules answer:

"If the same person keeps calling, how often should MCTB automatically text them?"

This prevents annoying duplicate recovery messages.

---

## 29. Important architecture distinction

A repeat missed call is still a real missed-call event.

Example:

```
10:00 AM — Missed call #1
10:15 AM — Missed call #2
10:45 AM — Missed call #3
```

All three may appear in Missed Calls.

But automated SMS behavior could be:

```
10:00 AM — Recovery text sent
10:15 AM — Text suppressed — cooldown
10:45 AM — Recovery text sent
```

Do not delete/merge the actual calls merely to avoid duplicate texts.

---

## 30. Repeat-caller cooldown

Primary rule:

Recovery cooldown

Supporting:

After a recovery text is sent, wait this long before sending another automated recovery text to the same caller.

Potential selections:

```
15 minutes
30 minutes
1 hour
2 hours
4 hours
Custom
```

Only offer ranges the runtime supports.

---

## 31. Default cooldown

Use the existing runtime/product default if one exists.

Do not invent a new default just in the UI.

If no authoritative default exists, Cursor should preserve current runtime behavior before changing anything.

---

## 32. Cooldown starts from an authoritative event

Define it centrally.

Recommended likely basis:

last automated recovery send

not simply:

* last call
* last page view
* last conversation open

Exact backend behavior wins.

The frontend should not calculate eligibility itself.

---

## 33. Cooldown display

Example:

```
Recovery cooldown
30 minutes

If the same caller misses you again within 30 minutes, the call is still logged but another automated recovery text won't be sent.
```

That makes the behavior very understandable.

---

## 34. Cooldown suppression

When applicable:

Missed Call Detail:

```
Recovery
Suppressed
Reason
Cooldown active
```

Do not show:

Failed

The system worked exactly as configured.

---

## 35. Maximum recovery attempts

If the existing runtime supports max messages per caller, keep it.

User-facing concept:

Maximum automated recovery messages

Supporting:

Limit how many automated MCTB recovery messages the same caller can receive within the configured period.

The period must be defined.

Do not offer an ambiguous:

Max messages: 3

with no timeframe.

---

## 36. Maximum-message period

Cursor must inspect existing runtime.

Possible actual designs include:

* per day
* per 24 hours
* per recovery window
* some canonical current period

UI must reflect whatever backend actually uses.

Example if daily:

```
Maximum automated recovery messages
2 per 24 hours
```

Do not invent a time window.

---

## 37. Do not count human replies incorrectly

If this limit is for automated MCTB recovery messages, clearly distinguish them from manual business replies in Conversations.

A staff member replying normally should not necessarily consume an MCTB automated-recovery quota unless backend intentionally does that.

---

## 38. Compliance/system confirmation counting

For Press-1:

The locked compliance confirmation should not automatically be treated as another independent recovery attempt if product semantics define one Press-1 sequence as a single recovery attempt.

Example:

```
Recovery attempt #1
├── System confirmation
└── Conversation opener
```

Do not count it as two attempts merely because two SMS records exist.

This distinction should be handled in backend analytics/rules.

---

## 39. Caller replies before repeat call

If caller already has an active conversation and then calls again:

The runtime may decide not to send another automated opener because an active conversation exists.

Only expose a configurable rule if the backend genuinely supports it.

Do not invent:

Don't text people who already replied

without defining exactly what runtime does.

---

## 40. Recommended V1 follow-up controls

Keep this page narrow.

I would expose only:

**Recovery cooldown** — e.g. 30 minutes

**Maximum automated recovery messages** — e.g. 2 per 24 hours

if that is existing runtime behavior.

Do not add more unless already implemented and useful.

---

## 41. Things not to add

Do not add:

* "Send another message after 2 hours"
* "Follow up next day"
* "Send 5-message sequence"
* drip campaigns
* branching sequences
* AI follow-up decisions
* appointment reminder rules
* marketing automation

This is MCTB, not a generic workflow platform.

---

## 42. Incoming reply behavior

Once customer replies, the canonical Conversation becomes the operational home.

Follow-up Rules should not create a competing inbox/reply system.

Potential explanatory text:

Customer replies appear in Conversations.

That's enough.

---

## 43. AI relationship

AI must not decide whether cooldown can be bypassed.

AI must not decide:

"This caller seems important, text them again."

The eligibility/rate rule is deterministic.

---

## 44. Customer opt-out supersedes follow-up rules

Even if:

```
Cooldown expired
Maximum not reached
```

if customer is opted out:

Do not send.

Follow-up Rules cannot override suppression/consent.

---

## 45. Business exclusion supersedes follow-up rules

Same principle.

Cooldown settings do not override:

* business exclusion
* provider suppression
* missing permission
* unavailable sender
* other canonical blockers

---

## 46. Page architecture

Recommended:

```
Recovery Controls

Status
Active
[Pause recovery]
────────────
Follow-up Rules
Recovery cooldown
[30 minutes ▼]
Maximum automated recovery messages
[2] per [runtime-defined period]
[Save changes]
```

Simple.

Do not turn this into a giant configuration page.

---

## 47. Paused-page architecture

```
Recovery Controls

Paused
Resumes today at 3:00 PM Eastern
[Resume now]
[Change pause]
────────────
Follow-up Rules
...
```

Follow-up settings can still be edited while paused.

Pause is operational state, not configuration lock.

---

## 48. First-time wizard

We do not need a dedicated wizard step for this.

Use sensible canonical defaults.

The wizard can optionally show a small summary near final review:

```
Recovery controls
Active
Repeat caller protection
30-minute cooldown
```

Then the user can customize later under Setup.

This keeps first-time setup shorter.

---

## 49. Setup Overview link

Replace the old Business Hours entry with:

Recovery Controls

Example:

```
Recovery Controls
Active · 30-minute repeat-call cooldown
Manage
```

---

## 50. Remove Business Hours references from other specs

Cursor should update the architecture consistently.

Remove/replace references such as:

Setup → Business Hours

from:

* Setup Overview
* Text Back
* wizard
* Analytics if any
* Home health
* manifest/IA docs

Do not leave a ghost Business Hours page in navigation.

---

## 51. Text Back variants correction

The previous Text Back spec mentioned business-hours/after-hours variants.

For the current MCTB architecture, do not require these variants.

Unless runtime already has them and you deliberately decide to retain them later, the primary MCTB configuration should use:

one recovery opener

rather than schedule-based opener variants.

This aligns with the architecture you just clarified.

---

## 52. Existing schedule code

If existing MCTB backend has a weekly schedule:

Do not automatically delete it during UI cleanup.

First audit:

* whether anything still depends on it
* whether it is legacy
* whether pause uses it internally
* whether production users/config records depend on it

Then:

* stop exposing it in the new MCTB UI if unnecessary
* safely migrate/deprecate only when confirmed

Preserve runtime stability.

---

## 53. Pause runtime contract

Cursor should audit/reuse existing fields/services corresponding to concepts such as:

```
enabled
paused
paused_until
pause_reason
pause_mode
```

Exact schema may differ.

Do not build a second pause model purely for the new UI.

---

## 54. Follow-up runtime contract

Existing inventory already indicates:

* cooldown
* max messages
* repeat-caller handling

Cursor should find the actual canonical configuration consumed by:

`src/lib/agents/missed-call-text-back/`

and reuse it.

Potential concepts:

```
cooldown_seconds
max_messages
max_messages_window
```

Exact backend names win.

---

## 55. Central eligibility recheck

Every automated recovery send should evaluate:

```
Operational mode (Active/Paused)
    ↓
Recipient consent/permission
    ↓
Opt-out
    ↓
Business exclusion
    ↓
Sender readiness
    ↓
Cooldown
    ↓
Maximum message rule
    ↓
Other canonical blockers
    ↓
Send
```

Do not make the UI the authority.

---

## 56. Pause reason code

A paused message/event should have a deterministic backend reason code.

Use the existing equivalent where present.

User-facing translation:

Recovery paused

Not raw:

`MCTB_PAUSED_001`

---

## 57. Reason-code consistency

If Missed Calls says:

Suppressed — recovery paused

Missed Call Detail and Analytics must agree.

Likewise:

Suppressed — cooldown active

One mapping.

---

## 58. Pause and Analytics

Analytics should not count paused/suppressed messages as Failed.

Possible suppression breakdown:

```
Recovery paused — 12
Cooldown active — 8
```

if useful.

Do not distort delivery failure metrics.

---

## 59. Pause and Home

Home should clearly distinguish:

MCTB paused

from:

Messaging sender blocked

Both can stop texts, but causes/fixes differ.

---

## 60. Pause and forwarding

If forwarding continues while paused, missed calls may still appear.

That's useful.

The user can see:

We missed the calls, but recovery was paused.

Do not silently erase visibility.

---

## 61. Pause and voicemail

If Visual Voicemail continues during pause, Home/Voicemail should continue receiving records.

If runtime currently pauses voicemail too, Cursor should surface that consequence before pausing.

Do not guess—verify actual behavior and lock it.

---

## 62. Pause modal example

```
Pause missed-call recovery

How long?
○ 1 hour
○ 4 hours
○ Until tomorrow
○ Choose a time
○ Until I turn it back on

While recovery is paused, Transovo will not send automated missed-call recovery texts.

[Cancel] [Pause recovery]
```

If voicemail/call logging continues, the helper can state that truthfully.

---

## 63. "Until tomorrow"

Be explicit.

For example:

Until tomorrow at 8:00 AM

is better than ambiguous:

Until tomorrow

if the resume time matters.

If user hasn't configured a business-start time, do not invent one.

Better to use:

* 24 hours
* choose a time

unless Transovo establishes a standard resume-time rule.

---

## 64. Recommended pause choices for V1

To avoid ambiguity, I would use:

* 1 hour
* 4 hours
* 24 hours
* Choose date & time
* Until I resume it

That covers exactly what you asked for without needing business hours.

---

## 65. Pause modification

If currently paused:

Action:

Change pause

User can:

* shorten
* extend
* switch to indefinite
* select new resume time

Backend replaces canonical pause condition safely.

---

## 66. Loading state

Do not briefly show Active before pause state loads.

Use status skeleton/loading.

This is consequential operational state.

---

## 67. Pause-action failure

Example:

```
Recovery couldn't be paused.
MCTB is still active.
[Try again]
```

Very important: state consequence should be explicit.

---

## 68. Resume-action failure

```
Recovery couldn't be resumed.
MCTB is still paused.
[Try again]
```

Do not optimistically show Active before backend confirms.

---

## 69. Follow-up save failure

```
Follow-up rules couldn't be saved.
Your changes are still here.
[Try again]
```

Pause status remains independently accurate.

---

## 70. Partial/degraded state

If follow-up config fails to load but operational pause state is available:

Pause/Resume can remain usable if backend safely allows it.

Likewise, inability to load pause audit should not necessarily block editing cooldown.

Localize failures.

---

## 71. Read-only permission

Example:

```
Recovery
Active
You don't have permission to pause recovery or change follow-up rules.
```

No fake disabled controls without explanation.

---

## 72. Concurrent admin behavior

Example:

Admin A has page open as Active.

Admin B pauses MCTB.

Admin A attempts to update cooldown.

The response/UI must not accidentally overwrite the newer pause state.

Pause and follow-up config should be patched independently or concurrency-controlled.

---

## 73. Accessibility

At minimum:

* H1
* current state text, not color-only
* Pause/Resume real buttons
* pause-duration choices semantic radios
* custom date/time labels
* timezone visible
* follow-up labels associated
* error state announced
* modal follows APG pattern
* focus returns correctly
* 44px touch targets
* 320px reflow
* 200% zoom

---

## 74. Focus behavior

Opening Pause:

focus enters modal heading/first control.

Cancel/complete:

focus returns to Pause/Resume action.

Automatic resume in background:

do not steal focus; update status and announce appropriately.

---

## 75. Mobile

Simple one-column page.

```
Recovery Controls
Active
[Pause recovery]

Follow-up Rules
Recovery cooldown
[30 minutes]
Maximum automated recovery messages
[2 per 24 hours]
[Save changes]
```

Pause dialog becomes full-width/modal sheet according to Transovo mobile pattern.

---

## 76. Mobile scheduled pause

Use native/canonical date/time controls.

No tiny desktop calendar crammed into phone.

Software keyboard should not obscure actions.

---

## 77. i18n/date-time

* labels externalized
* duration units pluralized properly
* absolute resume time locale-aware
* IANA timezone canonical
* RTL-safe controls
* backend duration/config values remain canonical/nonlocalized

---

## 78. Historical integrity

If a missed call was suppressed while paused:

Resuming MCTB later does not rewrite it to Delivered or Failed.

Likewise cooldown-suppressed calls remain historically suppressed.

New events use current state.

---

## 79. Prohibited patterns

Cursor must not:

* rebuild a weekly Business Hours scheduler
* create opening/closing hours for MCTB
* treat Pause as disabling carrier forwarding
* treat Pause as recipient opt-out
* treat Pause as sender failure
* send a backlog blast automatically on resume
* delete missed-call records while paused
* merge repeat calls into one event
* put SMS cooldown in Missed-call Rules and here simultaneously
* count Press-1's two-message sequence as two recovery attempts without domain definition
* add drip campaigns
* add AI-controlled follow-up decisions
* create a workflow builder
* expose fake timers/progress
* use client-side pause state as authority
* let stale config overwrite newer operational pause state
* expose old Business Hours page in the new MCTB navigation

---

## 80. Test scenarios

Cursor must certify:

**A.** Active → Pause 1 hour  
**B.** Pause 24 hours — timezone/DST correct  
**C.** Pause until custom date/time  
**D.** Pause indefinitely — Resume Now works  
**E.** Resume early  
**F.** Pause failure — remains Active  
**G.** Resume failure — remains Paused  
**H.** Missed call while paused — correct suppression reason  
**I.** Voicemail while paused — matches runtime  
**J.** Repeat caller inside cooldown  
**K.** Repeat caller after cooldown  
**L.** Maximum message limit reached  
**M.** Customer opted out — cooldown does not override  
**N.** Concurrent admin change  
**O.** Mobile/keyboard/screen reader

---

## 81. Definition of done — Recovery Controls & Follow-up Rules

Cursor may mark this final MCTB configuration spec complete only when:

* [ ] Standalone Business Hours/Schedule page has been removed from the new MCTB architecture
* [ ] Existing schedule backend audited before deprecation/removal
* [ ] Setup Overview uses Recovery Controls instead
* [ ] Home and Setup share one Active/Pause state
* [ ] User can pause for preset duration
* [ ] 24-hour/day pause supported as agreed
* [ ] User can pause until custom date/time
* [ ] User can pause indefinitely
* [ ] User can Resume Now
* [ ] Automatic resume is server authoritative
* [ ] Resume time uses IANA timezone
* [ ] DST behavior correct
* [ ] Pause does not falsely claim carrier forwarding changed
* [ ] Pause state remains separate from opt-out
* [ ] Pause state remains separate from sender readiness
* [ ] Paused queued sends recheck before sending
* [ ] Resume does not automatically blast old suppressed messages
* [ ] Calls while paused retain correct historical state
* [ ] Voicemail pause behavior is explicitly verified and represented
* [ ] Repeat caller cooldown uses canonical runtime configuration
* [ ] Repeat calls remain separate missed-call events
* [ ] Cooldown suppression is not labeled failure
* [ ] Maximum automated recovery rule uses actual runtime period
* [ ] Manual business replies are not accidentally treated as automated recovery attempts
* [ ] Press-1 system + opener sequence is counted correctly as domain defines
* [ ] Opt-outs/exclusions override follow-up rules
* [ ] AI cannot override deterministic limits
* [ ] Missed Calls/Detail/Home/Analytics use the same suppression reasons
* [ ] Loading/error/partial/read-only states complete
* [ ] Operational Pause and configuration saves cannot overwrite one another accidentally
* [ ] Mobile/320px/200% zoom pass
* [ ] Keyboard/screen-reader flow passes
* [ ] No generic automation/drip functionality introduced
* [ ] Existing MCTB cooldown/max-message runtime preserved
* [ ] Visual implementation matches completed Transovo Appointment design system

---

## Build handoff — end of page-spec sequence (this MCTB pass)

This is the **final page build spec** for the current MCTB frontend rebuild pass.

**Completed operational + setup specs:** 01–10, 12 (Recovery Controls). **Spec 11 — Consent** remains referenced in architecture but was not produced in this pass.

**Intentionally out of scope for this page-spec series (for now):** Numbers, Exclusions, Links/Request Form, Reports, generic Integrations, and other secondary areas.

Legacy routes such as `/mctb/setup/business-hours` and `/mctb/setup/follow-up` should redirect to `/mctb/setup/recovery` or resolve per migration matrix — do not expose ghost navigation.
