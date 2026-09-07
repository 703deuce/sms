# Transovo MCTB Page Build Spec — 09: Missed-call Rules

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup/missed-call-rules`  
**Wizard role:** First-time setup Step 2  
**Product:** Missed Call Text Back  
**Page archetype:** Focused configuration editor  
**Canonical navigation:** MCTB → Setup → Missed-call Rules  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs (including **spec 07 — Setup architecture**, **spec 08 — Phone & Forwarding**)

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-09-missed-call-rules.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

Missed-call Rules defines which inbound call outcomes enter the MCTB recovery flow and how duplicate/repeat events are handled. It must remain a focused configuration surface, not a generic call-routing builder, PBX rule engine, or automation canvas. The UI may expose only conditions and controls that are backed by the canonical MCTB runtime. Defaults should handle the common case, while uncommon timing/repeat controls should use progressive disclosure. The page must distinguish call classification from messaging eligibility: a call may correctly qualify as "missed" and later still be ineligible for SMS because of consent, opt-out, cooldown, sender state, or another centralized eligibility rule.

---

## 2. Primary user question

**First-time setup:**

"Which calls should Transovo treat as missed?"

**Existing customer:**

"When should MCTB start the recovery flow?"

---

## 3. Exact responsibility of this page

This page owns:

* missed-call trigger/condition configuration
* supported call classifications
* applicable no-answer timing if MCTB actually owns it
* repeat-call/cooldown-related event rules where appropriate
* advanced event-classification settings that genuinely affect MCTB

It does not own:

* carrier forwarding instructions
* consent
* sender registration
* SMS message content
* business hours
* voicemail greeting creation
* Smart Routing flows
* generic IVR
* conversation follow-up
* opt-out policy

---

## 4. Core mental model

The simplest model should be:

```
A call is not answered normally
        ↓
Does it match one of the configured missed-call conditions?
        ↓
Yes
        ↓
Create canonical missed-call event
        ↓
Central eligibility/consent engine decides whether recovery messaging may proceed
```

The rules on this page decide whether the call enters the MCTB event pipeline.

They do not decide whether SMS is legally/operationally eligible.

---

## 5. Screenshot calibration requirement

Before styling this page, Cursor should inspect completed Transovo configuration screens demonstrating:

* checkbox groups
* radio choices
* advanced settings disclosure
* helper text
* status/preview treatment
* Save changes behavior
* inline validation
* mobile one-column forms

Use the same actual components and spacing.

---

## 6. Page header

**H1**

Missed-call Rules

Supporting line:

Choose which unanswered call outcomes should start Missed Call Text Back.

Do not use:

* Call Event Classifier
* Routing Conditions
* Telephony Triggers Engine

---

## 7. First-time wizard version

Keep this step intentionally simple.

Recommended prompt:

What should count as a missed call?

Then supported choices.

Example:

* ☑ No answer
* ☑ Busy
* ☑ Unreachable

Potential:

* ☑ Voicemail

only if voicemail is actually a distinct runtime trigger/classification rather than an outcome of the same forwarded call.

Cursor must inspect runtime before deciding.

---

## 8. Default behavior

For a normal small business, sensible defaults should be preselected only for operational call rules, where no consent/privacy issue exists.

Example:

* No answer — on
* Busy — on
* Unreachable — on

This is different from affirmative consent controls, which must not be prechecked when attestation/permission is required.

Do not force the user to understand telecom edge cases before getting value.

---

## 9. Trigger definitions

**No answer**

Plain language:

The call rings but your business doesn't answer before forwarding occurs.

Use actual runtime classification.

Do not expose CFNA or provider disposition terms.

**Busy**

Plain language:

The line is busy and your carrier forwards the call to Transovo.

Only offer if supported by the forwarding/runtime path.

**Unreachable**

Plain language:

The business line can't be reached and the carrier forwards the call to Transovo.

Examples can include phone off/network unavailable, but do not overpromise because carriers vary.

**Rejected/declined**

Only expose if runtime can distinguish this reliably and the product intentionally treats it as missed.

Do not invent a checkbox because an old provider webhook had a rejected string.

**Voicemail**

If enabled as a trigger, wording should be:

Start the recovery flow when the caller reaches Transovo voicemail.

But this must match actual voice architecture.

Do not duplicate the generic No answer trigger if voicemail is simply what happens afterward.

---

## 10. Trigger state source

These settings must map to one canonical MCTB configuration.

Conceptually:

```
missed_call_conditions:
  no_answer
  busy
  unreachable
  rejected
  voicemail
```

Exact stable backend names may differ.

Do not rename stable contract values casually.

---

## 11. Call classification vs recovery eligibility

This distinction should exist in both runtime and UI logic.

Example:

```
Call outcome
No answer
→ qualifies as missed

Then

Messaging eligibility
Customer opted out
→ recovery message suppressed
```

The Missed-call Rules page should not have an option such as:

Text opted-out callers anyway

That belongs nowhere.

---

## 12. No-answer timing

Only expose a no-answer/ring timeout if Transovo actually controls it.

There are two possible architectures:

**Carrier-controlled ring timing**

Then this page should not pretend to control it.

Link to Phone & Forwarding instructions if the carrier supports changing the delay.

**MCTB-controlled timing**

If actual runtime receives the call before deciding missed status and owns the timer, then expose a supported control.

Runtime truth decides.

---

## 13. Avoid duplicate timing controls

Do not have:

* Phone & Forwarding → Ring 10 seconds
* Missed-call Rules → Wait 15 seconds

both controlling overlapping behavior without a defined authority.

There must be one owner.

---

## 14. Recommended basic/advanced split

**Basic:**

```
What should count as missed?
☑ No answer
☑ Busy
☑ Unreachable
```

Then:

**Advanced**

Potential controls:

* repeat-call handling
* cooldown
* maximum recovery attempts
* voicemail-trigger behavior

But note that cooldown/message limits may belong more naturally under Follow-up Rules.

Do not duplicate them here and later.

---

## 15. Ownership rule for cooldown

Preferred ownership:

**Follow-up Rules** owns SMS cooldown and maximum recovery sends.

Missed-call Rules may show a read-only note:

Repeat calls may still be logged as separate missed calls. Text-back frequency is controlled under Follow-up Rules.

This preserves object truth:

* every missed call event can still exist
* messaging frequency is a separate policy

---

## 16. Repeat callers

A repeat caller should generally still create separate canonical missed-call events if separate calls actually occurred.

Example:

```
10:00 AM — Missed call
10:15 AM — Missed call
11:20 AM — Missed call
```

Do not merge them into one event.

Messaging suppression/cooldown may prevent three texts.

That is correct.

---

## 17. Repeat-call configuration

If runtime has meaningful repeat-call classification settings, expose only those needed.

Avoid vague controls like:

Treat repeat calls differently

unless there is an actual defined behavior.

Potentially useful future option:

Highlight callers who call multiple times

That is display/attention behavior, not event classification.

Do not put it here unless it changes runtime classification.

---

## 18. Caller ID missing

If forwarded call arrives without a usable caller number:

The call can still potentially be a missed-call event, but SMS recovery cannot proceed.

This is not necessarily a Missed-call Rule.

The canonical event should record:

No phone number available

and eligibility should block messaging.

Do not silently discard the call if product can still show it operationally.

---

## 19. Unknown/unsupported outcome

If runtime receives a call event it cannot classify confidently:

Possible state:

Unknown call outcome

Do not map it arbitrarily to No answer.

Product policy should define whether unknown events:

* are logged but not recovered
* are excluded
* require diagnostics

Do not let frontend choose.

---

## 20. Business-hours interaction

Missed-call classification and schedule are separate.

Example:

* call is missed at 9 PM
* condition = No answer
* event is a valid missed call
* Business Hours/Schedule determines whether/how recovery messaging should proceed

Do not make Missed-call Rules silently ignore after-hours calls unless that is the explicit product rule.

---

## 21. Paused-state interaction

If MCTB is paused:

The runtime may still log missed calls while suppressing recovery messages.

If that is current architecture, preserve it.

Do not redefine paused as:

Stop detecting missed calls

unless backend actually works that way.

This matters for analytics/history.

---

## 22. Voicemail interaction

Because Visual Voicemail is first-class:

A call may have:

```
Missed call event
    ↓
Voicemail recording
    ↓
Recovery eligibility/message
```

These are related objects/states.

Do not create a rule where choosing Voicemail replaces the missed-call event entirely.

---

## 23. Text-back interaction

This page should show a compact explanatory relationship:

Calls matching these rules enter the MCTB recovery flow. Whether a text is sent is determined by your Consent, Business Hours, Follow-up Rules, sender readiness, and recipient eligibility.

This helps users understand why a "missed" call might not produce a text.

---

## 24. First-time wizard step

The first-time version should fit mostly on one screen.

Example:

```
What should count as a missed call?

☑ No answer
  When your business line rings and isn't answered.

☑ Busy
  When your carrier forwards a busy call.

☑ Unreachable
  When your business line can't be reached.

[Back]                              [Continue]
```

No giant advanced rule builder.

---

## 25. Post-setup editor

Existing customer path:

```
MCTB
    → Setup
    → Missed-call Rules
```

Page includes:

* current selected conditions
* concise descriptions
* any valid advanced settings
* Save changes

No wizard stepper.

---

## 26. Consequential changes

Turning off a trigger changes which future calls are recoverable.

Example:

User disables Busy.

Use appropriate helper:

Busy calls will no longer start MCTB recovery after this change.

A confirmation dialog may not be needed for every checkbox change if explicit Save makes consequence clear.

But disabling all triggers is consequential.

---

## 27. Zero-trigger state

Do not allow the user to unknowingly save an impossible configuration.

If no trigger is enabled:

Validation:

Choose at least one missed-call condition.

Unless product genuinely supports an active MCTB configuration with zero detection rules.

---

## 28. Changing rules does not rewrite history

If user turns off Busy today:

Historical Busy missed calls remain.

Do not retroactively change their classifications.

Rules apply prospectively according to effective configuration.

---

## 29. Configuration version/effective time

If runtime already stores config versions/effective timestamps, preserve them.

At minimum, event classification should be based on the settings active when the call occurred.

Do not re-evaluate old events using current UI rules.

---

## 30. Save behavior

Post-setup:

Save changes

On success:

Missed-call rules updated.

Quiet inline state or standard toast + persistent updated UI.

On failure:

```
Changes couldn't be saved.
Your selections are still here.
[Try again]
```

---

## 31. Wizard save behavior

Continue should persist the selected rules before moving forward.

If save fails:

* stay on step
* preserve choices
* show actionable error
* do not advance pretending success

---

## 32. Loading state

Do not default checkboxes to false while loading.

Use form skeleton or disabled loading state until authoritative config arrives.

Otherwise a slow request could visually imply all triggers are off.

---

## 33. Error state

If configuration cannot load:

```
Missed-call rules couldn't be loaded.
[Retry]
```

Do not let user overwrite unknown server state with defaults.

---

## 34. Partial/degraded state

If core rules load but supporting explanatory capability/guide data fails, preserve editability where safe.

If authoritative config cannot be confirmed, fail closed for saving rather than guessing.

---

## 35. Read-only permission state

A user without config permission can see:

```
No answer
On

Busy
On

Unreachable
On
```

but cannot change.

Do not merely disable without explanation if permission restriction is not otherwise obvious.

Example:

You can view these settings, but you don't have permission to change them.

---

## 36. Accessibility

Requirements:

* H1
* checkbox/radio controls use native semantics
* labels fully clickable
* helper text associated
* grouped under fieldset/legend where appropriate
* errors programmatically associated
* no color-only enabled/disabled meaning
* visible keyboard focus
* one-column mobile form
* 44px targets
* 320px reflow
* 200% zoom

---

## 37. Group semantics

Recommended:

```html
<fieldset>
  <legend>What should count as a missed call?</legend>
  ...
</fieldset>
```

Do not use clickable div cards with hidden checkbox semantics if shared components can use native inputs.

---

## 38. Mobile

This page should remain extremely simple on mobile.

Stack:

```
Missed-call Rules
No answer
[checkbox]
description
Busy
[checkbox]
description
Unreachable
[checkbox]
description
Advanced
Save changes
```

No horizontal tabs.

---

## 39. i18n

* all explanatory strings externalized
* provider/runtime enum remains canonical, not localized internally
* labels can expand 30–50%
* do not hardcode line breaks around English phrase lengths
* RTL-safe checkbox layout

---

## 40. Runtime contract

Cursor should audit/reuse existing configuration fields/services for:

```
missed_call_conditions
trigger_no_answer
trigger_busy
trigger_unreachable
trigger_rejected
trigger_voicemail
```

or their actual equivalents.

Also inspect classification runtime under the existing MCTB agent/event pipeline before changing behavior.

Do not build frontend fields that no runtime reads.

---

## 41. Central classification service

The UI should save into the same configuration consumed by the canonical classifier.

Conceptually:

```
Carrier/voice event
    ↓
MCTB classifier
    ↓
Canonical MissedCallEvent
```

No separate frontend interpretation.

---

## 42. Reason codes

When a call does not qualify because of a disabled rule, if the event is still logged diagnostically, use stable reason code such as actual backend equivalent of:

```
trigger_disabled
unsupported_call_outcome
```

Do not invent user-facing state independently.

---

## 43. Analytics consistency

Changing triggers changes future event volume.

Analytics must use canonical event classifications.

Do not count calls in Analytics as missed if the operational Missed Calls domain does not.

One definition.

---

## 44. Home consistency

Home's Missed calls today must use same canonical classification.

No page-specific counting.

---

## 45. Test & Diagnostics relationship

The live test can report:

```
Call detected
Outcome: No answer
Matched rule: No answer
```

in user-friendly language if useful.

If the call reaches Transovo but matches a disabled trigger:

```
Call detected, but this outcome isn't enabled for recovery.
```

Only if actual test instrumentation supports it.

---

## 46. Phone & Forwarding relationship

Phone & Forwarding determines whether the call reaches Transovo.

Missed-call Rules determines whether the received call outcome qualifies.

Diagnostic chain:

```
Did call reach Transovo?
    ↓
Yes
Did call match an enabled missed-call rule?
    ↓
Yes
Create missed-call event
```

Keep these separate so failures can be diagnosed correctly.

---

## 47. Consent relationship

Consent comes after classification.

Do not put consent controls here.

A call can be:

```
Missed = yes
Consent = not captured
Text = not sent
```

That is a valid lifecycle.

---

## 48. Follow-up Rules relationship

Cooldown/max message limits belong there.

Missed-call Rules determines events.

Follow-up Rules determines how aggressively repeat events can produce additional recovery messages.

Do not duplicate controls.

---

## 49. Prohibited patterns

Cursor must not:

* create a generic visual workflow builder
* expose provider disposition codes
* combine call classification with SMS consent
* combine call classification with sender registration
* put cooldown in multiple sections
* silently discard repeat calls
* rewrite historical event classification after settings change
* show unsupported trigger checkboxes
* fake runtime support for rejected/voicemail triggers
* add unconditional call forwarding controls here
* duplicate Phone & Forwarding instructions
* use server/client defaults before config loads
* create fake "smart AI call detection" controls
* use an ARIA-heavy custom checkbox system when native semantics work

---

## 50. Test scenarios

Cursor must certify:

**A. Default configuration**

* No answer enabled
* Busy enabled
* Unreachable enabled
* saves correctly
* classifier uses values

**B. Disable Busy**

* future busy event behavior changes correctly
* historical busy events unchanged

**C. No triggers selected**

* validation blocks invalid configuration

**D. Repeat caller**

* multiple real calls produce separate events
* SMS cooldown remains separate

**E. Caller ID missing**

* event behavior matches backend policy
* SMS eligibility blocks separately where appropriate

**F. After-hours call**

* classification remains correct
* schedule handling remains separate

**G. MCTB paused**

* event logging/recovery behavior matches runtime truth

**H. Voicemail**

* voicemail relationship matches actual runtime
* no duplicate event model

**I. Config load failure**

* no false unchecked defaults
* cannot overwrite unknown state

**J. Mobile/keyboard**

* all controls usable
* labels/helpers readable
* Save works

---

## 51. Definition of done — Missed-call Rules

Cursor may mark this section complete only when:

* [ ] Page has one narrow job: define qualifying missed-call outcomes
* [ ] Uses canonical Transovo shell/configuration visual language
* [ ] First-time wizard version is simple
* [ ] Existing users can open direct editor
* [ ] Only runtime-supported trigger conditions are exposed
* [ ] Default selections are deliberate and valid
* [ ] No-answer/busy/unreachable use plain user language
* [ ] Provider enums/jargon are hidden
* [ ] Call classification is separate from messaging eligibility
* [ ] Consent controls are not duplicated here
* [ ] Sender/compliance controls are not duplicated here
* [ ] Business Hours remains separate
* [ ] SMS cooldown/message limits remain under Follow-up Rules
* [ ] Repeat calls remain separate canonical events
* [ ] Changing rules applies prospectively
* [ ] Historical events are not rewritten
* [ ] Zero-trigger invalid state handled
* [ ] Save/Continue uses canonical backend config
* [ ] Loading does not show false defaults
* [ ] Error/partial/read-only states complete
* [ ] Phone & Forwarding and diagnostics use same classification truth
* [ ] Home/Missed Calls/Analytics counts agree
* [ ] Mobile/320px/200% zoom pass
* [ ] Keyboard/screen-reader form semantics pass
* [ ] No mock controls
* [ ] No new duplicate call-classification engine is introduced
* [ ] Existing classifier/runtime tests are preserved

---

## Build handoff

Next page-spec: **10 — Text Back** — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-10-TEXT-BACK.md`.

**11 — Consent** — pending build spec.
