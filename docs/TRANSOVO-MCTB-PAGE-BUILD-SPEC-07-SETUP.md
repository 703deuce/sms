# Transovo MCTB Page Build Spec — 07: Setup & Guided Setup

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup`  
**Wizard route:** `/mctb/setup/start` or canonical equivalent  
**Section routes:** `/mctb/setup/...`  
**Product:** Missed Call Text Back  
**Page archetypes:** Configuration overview + ordered setup wizard  
**Canonical navigation:** MCTB → Configure → Setup  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration/setup screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-07-setup.mdc` (`alwaysApply: true`)

**Scope note:** This spec locks the overall Setup architecture and guided wizard. Individual substantial editors (Phone & Forwarding, Consent, Text Back, etc.) receive dedicated page build specs starting with **08 — Phone & Forwarding**. Voicemail greeting configuration details remain in **spec 05** where they overlap.

---

## 1. Master Cursor rule

MCTB Setup has two presentations over one authoritative configuration model. First-time or incomplete customers receive an ordered guided wizard that takes them through the minimum required steps to make MCTB operational. Existing customers receive a configuration overview from which they can directly enter any individual setup area and change it without repeating the wizard. The wizard and standalone configuration pages must read and write the same canonical backend configuration, validation, readiness, consent, schedule, forwarding, messaging, voicemail, and testing state. Cursor must never create a separate onboarding configuration model, duplicate save logic, or a second set of settings that later has to be synchronized.

---

## 2. Core architecture

The model is:

```
                     ┌─────────────────────┐
                     │ Canonical MCTB      │
                     │ Configuration       │
                     └──────────┬──────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
       First-time experience          Existing-user experience
       Guided Setup Wizard             Setup Overview
       Step 1 → Step 2 → ...           ↓
       ↓                               Direct section access
       Test                            ↓
       ↓                               Edit one thing
       Activate                        ↓
                                       Save
```

One configuration. Two ways to work with it.

---

## 3. Primary jobs

**First-time setup**

The question is:

"How do I get Missed Call Text Back working?"

The system guides them through the correct sequence.

**Existing configuration**

The question becomes:

"I already use MCTB. Where do I change this one thing?"

They should not have to click Next six times just to change their consent mode or greeting.

---

## 4. Setup must detect lifecycle state

`/mctb/setup` should respond differently depending on authoritative readiness.

**Never configured / materially incomplete**

Show the Setup Overview with a dominant:

Continue setup

The CTA resumes the wizard at the appropriate incomplete step.

For a completely new setup:

Start setup

**Configured and operational**

Show normal configuration overview.

No giant onboarding checklist.

**Configuration now degraded**

Show the specific problem plus direct fix.

Example:

Forwarding needs attention  
Your business line is no longer passing the verification check.

Fix forwarding

The user should not be forced through the whole wizard again.

---

## 5. Canonical setup areas

Post-setup, users need direct access to these canonical areas:

* Setup
* Phone & Forwarding
* Missed-call Rules
* Text Back
* Consent
* Business Hours
* Follow-up Rules
* Voicemail
* Links & Request Form
* Exclusions
* Test & Diagnostics

Some can eventually be combined if actual runtime complexity is low, but no feature should disappear.

---

## 6. Recommended direct routes

Conceptually:

```
/mctb/setup
/mctb/setup/phone
/mctb/setup/missed-call-rules
/mctb/setup/text-back
/mctb/setup/consent
/mctb/setup/business-hours
/mctb/setup/follow-up
/mctb/setup/voicemail
/mctb/setup/links
/mctb/setup/exclusions
/mctb/setup/test
```

Do not rename stable backend routes merely for aesthetic URL purity if that creates unnecessary risk.

The architectural requirement is the canonical UI structure, not mandatory URL churn.

Legacy routes can resolve or redirect.

---

## 7. Setup Overview page

Once a customer is configured, `/mctb/setup` should behave like a configuration home.

Recommended structure:

```
Setup
Manage how Missed Call Text Back works.

Status / readiness

Phone & Forwarding
Business line • Forwarding verified
[Manage]

Missed-call Rules
No answer, busy and unreachable
[Manage]

Text Back
Business-hours and after-hours messages
[Manage]

Consent
Verified Call Consent
[Manage]

Business Hours
Mon–Fri, 8:00 AM–6:00 PM Eastern
[Manage]

Follow-up Rules
Cooldown 30 min • Max 2 recovery attempts
[Manage]

Voicemail
Custom greeting • Transcription and AI summaries on
[Manage]

Links & Request Form
Request form enabled
[Manage]

Exclusions
7 excluded numbers
[Manage]

Test & Diagnostics
Last live test passed Sep 7
[Test setup]
```

Use the actual Transovo configuration visual language.

Do not necessarily make each of these giant cards. They can be grouped settings rows/sections according to the Appointment design precedent.

---

## 8. Configuration overview hierarchy

Each setup area should show:

1. Name
2. Current meaningful summary
3. Problem, if any
4. Manage action

Example:

```
Consent
Verified Call Consent
Prompt published
Manage
```

Or:

```
Text Back
Sender needs attention
Recovery messages are currently blocked.
Fix
```

This lets the user understand configuration without entering every editor.

---

## 9. Do not expose provider internals on Setup Overview

Bad:

* Telnyx TF DID
* Call Control App
* 10DLC Campaign SID
* TFV UUID

Good:

* Business line
* Forwarding
* Text-back sender
* Business texting

Provider details belong deeper in diagnostics if required.

---

## 10. First-time wizard architecture

The wizard should be shorter conceptually than the current backend's 10-step onboarding implementation.

The user should experience meaningful tasks, not provider workflow internals.

Recommended first-time sequence:

1. Phone
2. Missed Calls
3. Consent
4. Text Back
5. Business Hours
6. Voicemail
7. Test & Activate

This is a recommended conceptual sequence, not an instruction to rebuild working backend onboarding state.

The existing backend steps can map underneath these user-facing steps.

---

## 11. Why these are wizard steps

A wizard is justified because first-time setup has real dependencies.

Conceptually:

```
Phone
    ↓
What calls should count
    ↓
How messaging permission works
    ↓
What customer receives
    ↓
When behavior operates
    ↓
What happens if they leave voicemail
    ↓
Verify the complete real flow
```

That is an ordered process.

The same items are not an ordered process after setup.

That is why post-setup they become direct configuration destinations.

---

## 12. Wizard progress

Always show meaningful progress.

Example:

```
Setup MCTB
1 Phone
2 Missed Calls
3 Consent
4 Text Back
5 Business Hours
6 Voicemail
7 Test
```

On narrow screens, use a compact equivalent.

Do not create seven huge pills across a mobile viewport.

---

## 13. Progress terminology

Use user tasks.

Good:

* Phone
* Missed Calls
* Consent
* Text Back
* Business Hours
* Voicemail
* Test

Bad:

* Trial Number
* TFV
* Pending
* Configure
* Connect
* Runtime
* Finalize

Those describe implementation/provider state, not user intent.

---

## 14. Wizard controls

Every step uses predictable placement.

Bottom action region:

```
[Back]                                  [Continue]
```

Final step:

```
[Back]                         [Activate MCTB]
```

If activation happens automatically after a passing test, use truthful wording instead.

Do not call something Activate if the button merely saves settings.

---

## 15. Save behavior within wizard

The wizard should save incrementally.

When the user selects a valid setting and advances:

* persist it
* preserve it if they leave
* restore it if they return

Do not hold the entire configuration only in browser memory until the final step.

---

## 16. Back behavior

Back must preserve work.

Example:

Phone → Consent → Back

returns to Phone with prior settings intact.

Do not reset dependent values without warning.

---

## 17. Browser Back behavior

Browser history should behave sensibly.

A user should not be trapped in an app-controlled wizard.

If step routes are used:

```
/mctb/setup/start/phone
/mctb/setup/start/missed-calls
...
```

browser Back can naturally return to prior step.

If one route handles steps, history state must still be intentional.

---

## 18. Exit setup

The user should be able to leave and resume later.

Potential action:

Save and exit

or simply reliable autosave plus:

Exit setup

Do not imply all work is lost.

---

## 19. Resume behavior

Returning later should say:

Continue setup  
Next: Consent

or the actual unresolved area.

Do not restart at Step 1.

---

## 20. Wizard completion is readiness-based

The wizard should not consider setup complete merely because the user clicked through every screen.

Completion depends on actual required conditions.

Examples:

* business line selected
* forwarding verified where required
* consent method configured
* necessary prompt published
* messaging sender usable
* required message configured
* schedule valid
* voicemail configuration valid if required/enabled
* real test passes at required checkpoints

---

## 21. Step 1 — Phone

**Primary question**

Which business number should Missed Call Text Back protect?

Show:

**Business line**

This is the customer's existing public number.

Then:

**Forward missed calls to**

the Transovo forwarding destination.

---

## 22. Phone number roles

This step must teach the architecture clearly without making it technical.

Example:

```
Your business line
(571) 555-1234
Customers keep calling this number.

Forward missed calls to
(866) 346-4256
Transovo uses this destination to detect missed calls.
```

If text-back sender is selected later, don't conflate it here.

---

## 23. Carrier forwarding instructions

Once business line/carrier is known, show relevant conditional-forwarding instructions.

Use progressive disclosure.

Do not dump all carrier instructions.

Supported conditions may include:

* No answer
* Busy
* Unreachable

Only expose actual runtime-supported conditions.

---

## 24. Forwarding verification

After user says they configured forwarding, status should become:

Waiting for verification

not:

Verified

Verification must come from actual evidence.

Potential test:

1. User calls their business line
2. Lets it go unanswered
3. Transovo detects forwarded call
4. Validates correct workspace/target
5. Caller ID preservation verified where applicable
6. state becomes Verified

---

## 25. Verification failure

Use the standard diagnostic structure:

```
Forwarding wasn't detected

Impact
Missed calls may not reach Transovo.

What to do
Check the forwarding settings for your carrier and run the test again.

[View instructions]
[Retry test]
```

No raw SIP/provider errors.

---

## 26. Step 2 — Missed Calls

**Primary question**

When should Transovo treat a call as missed?

Expose only actual supported triggers.

Examples:

* ☑ No answer
* ☑ Busy
* ☑ Unreachable
* ☐ Voicemail

If voicemail is handled as an outcome rather than a trigger, model according to actual runtime rather than forcing this exact UI.

---

## 27. Advanced missed-call behavior

If the runtime has:

* ring timeout
* cooldown
* repeat-caller handling
* rejected-call behavior

do not overload the first wizard.

Use sensible defaults and progressive disclosure.

Advanced editing can live later in:

Setup → Missed-call Rules

---

## 28. Step 3 — Consent

**Primary question**

How should Transovo establish permission to text missed callers?

Two choices:

**Ask callers to press 1**

Supporting:

Callers hear a short prompt and press 1 before Transovo sends the recovery texts.

Technical value:

`press_1`

**Use permission my business already has**

Supporting:

Use this only for callers your business already has permission to text for this purpose.

Technical value:

`existing_consent`

---

## 29. Consent terminology

Do not expose:

* Press 1 mode
* Skip consent
* Automatic
* Manual

as primary user-language choices.

Use:

* Ask callers to press 1
* Use permission my business already has

Internal stable enum remains unchanged.

---

## 30. Press-1 wizard configuration

If selected, reveal only required setup:

* consent disclosure
* active voice/audio
* preview/play
* generate/publish if necessary

Do not expose advanced voice asset administration unless needed.

User should be able to understand exactly what caller hears.

---

## 31. Existing-permission attestation

If selected:

Require explicit affirmative attestation.

Never precheck it.

Example concept:

☐ I confirm my business has the applicable permission to text these callers about their inquiry.

Keep provenance separate from platform-captured Press-1 consent.

---

## 32. Step 4 — Text Back

**Primary question**

What should the caller receive after a missed call?

This step must correctly represent the two-message Press-1 flow.

---

## 33. Press-1 text architecture

For `press_1`:

**Message 1 — System confirmation**

Locked/system controlled:

```
Transovo: You're subscribed to texts about your inquiry to [Business]. Reply STOP to opt out. Reply HELP for help. Standard rates apply. Terms: [link] Privacy: [link]
```

The wizard may preview it.

Do not let the customer edit this as their business template.

**Message 2 — Conversation opener**

Editable where runtime supports:

```
Reply here to message [Business]. Reply STOP to opt out.
```

This is the business-facing recovery text.

---

## 34. Existing-permission text architecture

For `existing_consent`:

Show the actual first conversational message configuration used by runtime.

Do not force the Press-1 system confirmation preview when it does not apply.

---

## 35. Message preview

Preview should use realistic substituted values:

```
Business: Joe's Plumbing
Sender: (571) 555-4428
```

Show the actual sequence.

For Press-1:

1. System confirmation
2. Conversation opener

Not a fake single merged bubble.

---

## 36. Message timing

If a configurable delay exists, default it sensibly and keep secondary.

Do not lead first-time users with milliseconds/seconds.

If the two Press-1 messages occur back-to-back seconds apart, represent the actual runtime.

Do not invent a legal waiting period.

---

## 37. Sender readiness

Text Back step can show:

```
Text-back sender
(866) 555-0198
Ready
```

or premium:

```
Dedicated local text-back number
(571) 555-4428
Registration pending
```

Sender registration and recipient consent remain separate.

---

## 38. Sender blocker

If sender isn't ready:

Do not silently allow final activation as if texts can send.

Show:

```
Text-back sender needs attention
Missed calls can be detected, but recovery texts cannot be sent yet.
[Manage business texting]
```

Whether wizard can continue while registration is pending depends on actual product readiness requirements.

---

## 39. Step 5 — Business Hours

**Primary question**

When should MCTB run?

Potential choices if actual runtime supports:

* Always on
* During business hours
* After business hours
* Custom schedule

If MCTB normally should always recover missed calls regardless of hours, don't artificially make schedule mandatory.

Use product default.

---

## 40. Weekly schedule

If needed:

* weekday rows
* start
* end
* workspace timezone

Use canonical shared schedule editor.

Do not create a second MCTB-only timezone picker if shared component exists.

---

## 41. Timezone

Display clearly.

Example:

Eastern Time — America/New_York

Scheduling stores civil time intent + IANA timezone.

No fixed UTC-4 configuration.

---

## 42. Temporary pause is not first-time schedule setup

Controls such as:

* Pause 1 hour
* Pause until tomorrow
* Pause until resumed

are operational overrides.

They belong post-setup under Business Hours/Schedule and possibly Home.

Do not clutter first-time wizard.

---

## 43. Step 6 — Voicemail

Since Voicemail is a real first-class MCTB capability, initial setup should configure its basic caller experience.

**Primary question**

What should callers hear if they leave a voicemail?

Keep first-time flow simple.

---

## 44. Wizard voicemail choices

Potential:

**Use the standard Transovo greeting**

Fastest/default.

**Create a custom greeting**

Then choose:

* Type a greeting
* Record myself
* Upload audio
* Premium AI voice / ElevenLabs where appropriate

If custom voice generation has significant setup time, the user may be allowed to keep the standard greeting and customize later.

---

## 45. Do not block first value unnecessarily

Because Transovo already has a standard voicemail greeting, the wizard can default to it.

That allows the customer to get operational quickly.

Then later:

Setup → Voicemail

supports full:

* recording
* upload
* Transovo TTS
* ElevenLabs
* greeting history
* transcription
* AI summary configuration

This follows the HCD rule: minimize setup before value.

---

## 46. Transcription and AI summary defaults

If these are normal included features and product policy allows:

Present them simply.

Example:

```
Transcribe voicemail
On

AI summaries
On
```

If either has privacy/cost/entitlement consequences, surface them truthfully.

Do not make users configure AI prompts during setup.

---

## 47. Step 7 — Test & Activate

This is not a fake checklist.

It is an actual runtime diagnostic.

**Primary question**

Does the complete MCTB path work?

---

## 48. Live test instructions

Production test should say:

Call your business number from another phone and let it go unanswered.

Do not instruct them to call the hidden forwarding destination for the real end-to-end test.

---

## 49. Live test checkpoints

Potential actual sequence:

```
Waiting for call
    ↓
Missed call detected
    ↓
Forwarding verified
    ↓
Caller ID preserved
    ↓
Consent prompt played
    ↓
Consent captured
    ↓
Compliance message sent
    ↓
Conversation message sent
    ↓
Message delivered
    ↓
Reply received
```

For Existing Consent, remove irrelevant Press-1 checkpoints.

---

## 50. Do not fake progress

No arbitrary:

72% complete

based on elapsed time.

Show checkpoints.

Each one is:

* Waiting
* Passed
* Failed
* Not applicable

---

## 51. Test failure example

```
Call wasn't detected

What happened
Transovo did not receive the missed call from your business line.

Impact
MCTB cannot recover missed calls yet.

What to do
Check conditional forwarding and retry.

[Review forwarding]
[Retry test]
```

---

## 52. Consent test failure

```
Consent wasn't captured
The call reached Transovo, but the Press-1 step wasn't completed.

[Retry test]
[Review consent]
```

Do not falsely say forwarding failed.

---

## 53. SMS test failure

```
Call and consent passed
Recovery text couldn't be sent because your text-back sender is unavailable.

[Fix messaging]
```

Preserve passed checkpoints.

Do not restart user at Phone.

---

## 54. Reply test

If the product can verify inbound reply routing, include it.

This is valuable because the real product loop ends at Conversation.

After receiving test SMS:

Reply to the text to make sure responses appear in Transovo.

Then:

```
Reply received
Passed
```

That verifies:

* sender
* inbound messaging
* workspace routing
* canonical conversation

---

## 55. Activation

Activation is only available when mandatory readiness checks pass.

Example:

```
Everything required is ready.
✓ Forwarding
✓ Consent
✓ Messaging
✓ Voicemail
✓ Live test

[Activate Missed Call Text Back]
```

If activation is automatic when configuration is complete, don't create a fake Activate button.

Use actual runtime behavior.

---

## 56. Wizard completion

After success:

```
Missed Call Text Back is active
Missed calls from (571) 555-1234 can now be recovered through Transovo.

[Go to Home]
```

Keep celebration restrained and professional.

No giant marketing confetti flow unless already part of Transovo system.

---

## 57. After completion, wizard stops being the default

Once active:

`/mctb/setup`

must open the configuration overview, not restart Step 1.

The wizard may remain accessible as:

* re-run setup test
* reconnect a new line
* guided reconfiguration

only where appropriate.

---

## 58. Direct editing after setup

This is the behavior you specifically called out.

Example:

Customer is already active.

They want to change consent.

Path:

```
MCTB
    → Setup
    → Consent
    → Change setting
    → Save
    → Done
```

They should not see:

```
Step 3 of 7
Continue to Text Back
Continue to Schedule
...
```

That would be the wrong interaction model.

---

## 59. Direct section page anatomy

Every post-setup configuration page should use:

```
Page title
Purpose
Current status if consequential
Form/settings
Save changes
```

Potential contextual side information where useful.

No wizard progress.

---

## 60. Post-setup local configuration navigation

Desktop may use:

```
Setup
Phone & Forwarding
Missed-call Rules
Text Back
Consent
Business Hours
Follow-up Rules
Voicemail
Links & Request Form
Exclusions
Test & Diagnostics
```

This can be a local side nav if that matches Transovo configuration architecture.

On mobile, transform to compact section navigation.

---

## 61. Local nav vs tabs

These are not necessarily peer views of one dataset, so avoid blindly using tabs.

If there are many substantial configuration areas, a local configuration navigation list/sidebar is often more appropriate.

Follow the Page Architecture Guide.

Do not put 10 tiny horizontal tabs across the top.

---

## 62. Phone & Forwarding editor

Post-setup user can:

* change/assign business line where supported
* view forwarding destination
* review carrier instructions
* reverify
* run forwarding diagnostic

Changing critical line configuration may require confirmation and retest.

---

## 63. Missed-call Rules editor

Can manage actual runtime conditions.

Potential:

* no answer
* busy
* unreachable
* voicemail
* timeout/rules where supported

Defaults remain clear.

Advanced settings progressively disclosed.

---

## 64. Text Back editor

Manages:

* business/recovery message
* business-hours variant
* after-hours variant
* actual supported delay
* sender context
* preview
* links where appropriate

Press-1 Message 1 remains system controlled.

---

## 65. Consent editor

Manages:

* consent mode
* Press-1 disclosure/audio
* Existing Permission attestation/provenance
* prompt publication
* link to consent history

Switching modes is consequential.

Warn appropriately if active runtime behavior changes.

---

## 66. Business Hours editor

Manages permanent schedule:

* always on
* business hours
* after hours/custom
* weekly schedule
* timezone

And operational pause controls where appropriate.

---

## 67. Follow-up Rules editor

Known/expected MCTB rules may include:

* cooldown
* maximum recovery messages per caller
* reply behavior
* repeat caller behavior

Expose only real runtime features.

Do not create a mini automation builder.

---

## 68. Voicemail editor

This is the full configuration surface from the previous specification:

* standard Transovo TTS
* custom TTS
* ElevenLabs where supported
* Record yourself
* Upload
* Preview
* Activate
* greeting history if supported
* transcription
* AI summaries
* relevant voicemail behavior

Operational voicemail messages remain under Voicemail in main nav.

See also: `TRANSOVO-MCTB-PAGE-BUILD-SPEC-05-VISUAL-VOICEMAIL.md` for greeting editor details.

---

## 69. Links & Request Form editor

Manages:

* recovery link
* tracked links
* request form enabled
* public request form
* contact-upsert behavior where supported
* related configuration

Does not become a generic form builder.

---

## 70. Exclusions editor

Manages business-added do-not-text entries.

Must distinguish:

* Business exclusion
* Customer opt-out
* Provider suppression

A business exclusion may potentially be removable.

Customer opt-out must not casually be overridden.

---

## 71. Test & Diagnostics editor

Available after go-live too.

Purpose:

Verify MCTB still works and diagnose a problem.

Potential:

* Last live test
* Phone path state
* Forwarding state
* Sender state
* Consent configuration
* Start new test
* checkpoint history

This is where future troubleshooting belongs—not random provider errors throughout Setup.

---

## 72. Setup readiness model

Do not use one overloaded `setup_status`.

Use orthogonal authoritative facets:

**Configuration**

* Not started
* Incomplete
* Ready

**Forwarding**

* Unverified
* Verifying
* Verified
* Failing

**Sender**

* Registration required
* Pending
* Ready
* Blocked

**Consent**

* Incomplete
* Ready
* Mode

**Operational mode**

* Active
* Paused

**Health**

* Healthy
* Degraded
* Blocked

**Live test**

* Never run
* Running
* Passed
* Failed

---

## 73. Setup Overview derives state

Example:

```
Phone & Forwarding
Verified

Consent
Ready · Verified Call Consent

Text Back
Ready

Business Hours
Always on

Voicemail
Ready · Custom greeting

Test
Passed Sep 7
```

These are composed from canonical subsystem state.

Do not save a second frontend-only setup status.

---

## 74. "Needs attention" is derived

If sender becomes blocked after setup:

Setup Overview can show:

```
Text Back
Needs attention
Your sender cannot currently send recovery texts.
[Fix]
```

Needs attention is not a separate canonical lifecycle object.

It is derived from authoritative condition(s).

---

## 75. Save patterns

Configuration pages should use the established Transovo save model.

Potential:

* explicit Save changes
* autosave only if system already uses it reliably

Do not mix autosave and explicit Save unpredictably between sections.

---

## 76. Dirty state

If explicit Save:

* recognize unsaved changes
* warn on navigation when meaningful
* preserve form where possible
* no false saved state

If switching sections with unsaved changes:

Follow canonical Transovo forms behavior.

---

## 77. Network failure

Example:

```
Changes couldn't be saved.
Your edits are still here.
[Try again]
```

Do not wipe form.

---

## 78. Consequential configuration changes

Some settings have real customer-facing impact.

Examples:

* changing consent mode
* changing business line
* disabling voicemail
* changing active greeting
* pausing recovery
* disabling a trigger

Use proportionate confirmation where consequences are serious.

Do not confirmation-dialog every minor text edit.

---

## 79. Runtime synchronization

After save:

* backend becomes authoritative
* UI refreshes from returned canonical state
* no optimistic success if server rejected update
* active status shown only when actual runtime updated

---

## 80. One canonical setup API/domain

Existing code historically includes multiple setup pathways, including legacy SolutionSetup and newer MCTB setup APIs.

Cursor must audit before frontend work.

Do not wire the wizard to one setup engine and standalone editors to another.

Target:

```
Wizard
        ↘
          Canonical MCTB Configuration
        ↗
Editors
```

Legacy pathways should be consolidated or adapted safely.

---

## 81. Existing onboarding mapping

Current backend has known conceptual steps such as:

```
business
consent
demo
trial_number
configure
tfv
pending
connect
live_test
complete
```

Do not necessarily delete those backend states.

Map them to user-facing wizard concepts.

Example:

| Backend | User-facing |
|---------|-------------|
| Business / trial infrastructure | Phone |
| Consent | Consent |
| Configure | Text Back / Rules |
| TFV / pending | Messaging readiness state |
| Connect | Phone & Forwarding |
| Live test | Test & Activate |

Provider/review states can exist underneath without becoming wizard pages.

---

## 82. Wizard should not wait on external review as a fake page

If sender registration can take hours/days:

Do not trap customer on:

Step 5: Pending

instead:

```
Business texting
Under review
You can leave setup. We'll show you when this is ready.
```

Let them complete all other configuration.

Home/Setup shows readiness later.

---

## 83. Long-running external states

Examples:

* Toll-free verification
* 10DLC review

Need:

* current status
* what it affects
* what customer can do meanwhile
* notification/update path if supported

No fake spinner.

---

## 84. Setup permissions

A staff user without configuration permission can:

* view setup status if authorized

but cannot:

* change consent
* change forwarding
* change sender
* change greeting

Use read-only state rather than inaccessible broken controls.

Server authorization remains authoritative.

---

## 85. Mobile wizard

Wizard becomes one full-width step at a time.

Order:

```
Step label / progress
Title
Explanation
Form
Back / Continue
```

Keep primary action reachable but ensure sticky footer does not cover content/focus/keyboard.

---

## 86. Mobile configuration overview

Use structured rows:

```
Consent
Verified Call Consent
Ready
[Manage]
```

Do not show ten giant cards.

---

## 87. Mobile direct editor

One column.

No desktop local-sidebar squeeze.

Use:

Back to Setup

and a compact section switcher where useful.

---

## 88. Responsive state preservation

If user starts editing Consent desktop, narrows viewport:

* field values remain
* dirty state remains
* current section remains

No remount that loses configuration.

---

## 89. Accessibility — wizard

Must provide:

* H1 per step
* progress conveyed programmatically
* current step identified
* Back/Continue real buttons
* errors associated with fields
* error summary for complex steps
* focus to step heading when moving steps
* validation does not erase fields
* no color-only progress
* full keyboard operation

---

## 90. Accessibility — direct configuration

* local navigation keyboard operable
* active section exposed
* labels visible
* correct fieldset/legend for grouped choices
* radio vs switch semantics correct
* save status announced
* warning states understandable
* 200% zoom
* 320px reflow

---

## 91. Wizard validation

Validation should occur at useful layers.

Do not prevent Step 1 completion because Step 6 isn't configured.

Examples:

| Step | Validate |
|------|----------|
| Phone | number/carrier fields |
| Consent | actual choice/attestation |
| Text Back | message variables/limits |
| Schedule | time ranges |
| Test | runtime readiness checks |

Eligibility/compliance blockers are not ordinary form validation and should be labeled accordingly.

---

## 92. Validation vs readiness

Example:

A valid local sender phone number field can be saved while its registration is:

Pending

That is not a validation error.

Likewise:

Forwarding not yet verified

is readiness state, not a malformed phone number.

Keep these concepts separate.

---

## 93. Wizard skip behavior

Only optional steps can be skipped.

Example:

Custom voicemail greeting may permit:

Use standard greeting for now

That is not the same as leaving voicemail broken.

Do not allow skipping required consent setup.

---

## 94. Advanced configuration after setup

The wizard intentionally shows minimum required setup.

Post-setup editors can expose advanced settings.

This avoids intimidating first-time customers while retaining power.

---

## 95. No hidden configuration

Anything configured through wizard must be discoverable later in the corresponding standalone section.

Example:

Wizard selects:

Ask callers to press 1

Later:

Setup → Consent

shows exactly that active setting.

No wizard-only settings.

---

## 96. No editor-only hidden critical configuration

Conversely, a setting required for correct initial runtime should not be absent from the wizard simply because its advanced editor exists.

Wizard covers minimum operational readiness.

---

## 97. Setup screenshots from Appointments

Cursor must specifically capture existing Appointment pages that demonstrate:

* first-time wizard/stepper if available
* configuration overview
* settings section navigation
* forms
* radio/choice patterns
* schedule editor
* Save state
* error state
* test/verification state

If Appointments does not have a matching pattern, use the global standards rather than inventing a flashy new component.

---

## 98. Visual rule

The Setup area must look like the same team built Appointments.

Reuse actual components/tokens for:

* page header
* form layout
* helper text
* radio groups
* switches
* alerts
* status rows
* section navigation
* footer actions
* progress
* audio controls
* schedule editor
* save confirmation

Do not create "special MCTB setup cards" with a new aesthetic.

---

## 99. Prohibited patterns

Cursor must not:

* keep the old giant 12-section page as the primary configuration experience
* create 10 permanent sidebar items from setup sections
* force configured customers through the wizard to make one change
* maintain separate wizard settings and real settings
* use provider review states as wizard steps
* mark forwarding verified because user clicked a button
* conflate sender registration with consent
* make Press-1 system confirmation editable
* expose provider/SIP jargon
* make standard voicemail customization mandatory before activation if a valid default exists
* fake test progression
* restart the entire wizard after one failure
* erase already-passed checkpoints
* use a giant Save button for the entire product after setup
* create page-specific shell/header
* invent new color/spacing/component language

---

## 100. First-time certification journey

Cursor must certify:

```
New customer
    ↓
Start setup
    ↓
Choose business line
    ↓
Configure forwarding
    ↓
Verify forwarding
    ↓
Choose missed-call rules
    ↓
Choose consent mode
    ↓
Configure text-back
    ↓
Set schedule
    ↓
Accept/use voicemail default or customize
    ↓
Run end-to-end test
    ↓
Pass
    ↓
Activate
    ↓
Home
```

All settings persist.

---

## 101. Returning-user certification journey

```
Existing active customer
    ↓
Setup
    ↓
Consent
    ↓
Change setting
    ↓
Save
    ↓
Return to Setup
```

No wizard.

---

## 102. Resume-incomplete journey

```
Customer completes Phone and Consent
    ↓
Leaves
    ↓
Returns tomorrow
    ↓
Setup says Continue setup
    ↓
Resumes at next meaningful incomplete step
```

Prior work intact.

---

## 103. Failure recovery journey

```
Phone verified
Consent configured
Text Back configured
    ↓
Live test
    ↓
SMS fails
    ↓
Phone + Consent remain passed
    ↓
User fixes sender
    ↓
Retry affected checkpoint/path
    ↓
Pass
```

Do not restart from zero.

---

## 104. Existing Consent journey

Wizard adapts:

```
Consent
    → Use permission my business already has
    → explicit attestation
    → no Press-1 voice configuration
    → correct Text Back preview
    → live test without Press-1 checkpoint
```

No irrelevant controls.

---

## 105. Press-1 journey

Wizard adapts:

```
Consent
    → Ask callers to press 1
    → configure/preview prompt
    → Text Back shows locked system confirmation
    → editable conversation opener
    → test verifies Press-1
```

---

## 106. Voicemail customization journey

Post-setup:

```
Setup
    → Voicemail
    → Record myself
    → Record
    → Preview
    → Activate
```

Old greeting stays active until new one succeeds.

No need to rerun entire setup wizard unless actual runtime requires a specific test.

---

## 107. Definition of done — Setup architecture

Cursor may mark Setup architecture complete only when:

* [ ] `/mctb/setup` exists as canonical configuration home
* [ ] First-time customers receive guided setup
* [ ] Configured customers receive direct configuration overview
* [ ] Wizard and direct editors share one backend configuration
* [ ] No duplicate onboarding/config state exists
* [ ] Wizard progress uses user-language tasks
* [ ] Wizard saves incrementally
* [ ] Back preserves fields
* [ ] Exit/resume preserves progress
* [ ] Browser history works
* [ ] Configured customer can jump directly to any setup section
* [ ] Direct editor does not force wizard navigation
* [ ] Setup Overview summarizes authoritative current state
* [ ] Problems link to exact remediation section
* [ ] Phone & Forwarding clearly distinguishes number roles
* [ ] Forwarding verification uses real evidence
* [ ] Missed-call Rules expose actual supported triggers
* [ ] Consent supports both `press_1` and `existing_consent`
* [ ] Existing-permission attestation is explicit/not preselected
* [ ] Press-1 system confirmation is locked
* [ ] Conversation opener is separately represented
* [ ] Sender readiness separate from recipient consent
* [ ] Schedule uses IANA timezone
* [ ] Voicemail uses valid standard default for fast setup
* [ ] Full voicemail customization remains directly accessible later
* [ ] Test uses real runtime checkpoints
* [ ] Production test calls business line
* [ ] Press-1/Existing Consent tests differ correctly
* [ ] Passed checkpoints survive unrelated failure
* [ ] Activation reflects real readiness
* [ ] External pending provider review does not trap wizard
* [ ] Setup state remains truthful after activation
* [ ] Advanced config remains available after setup
* [ ] Permissions enforced
* [ ] Desktop/tablet/mobile complete
* [ ] 320px reflow passes
* [ ] 200%/relevant 400% zoom passes
* [ ] Keyboard wizard passes
* [ ] Keyboard direct-editor workflow passes
* [ ] Screen-reader progress/forms pass
* [ ] No mock controls
* [ ] Existing MCTB runtime preserved
* [ ] Legacy setup pathways audited/consolidated
* [ ] Visual implementation matches finished Transovo Appointment system

---

## Build handoff

This spec locks Setup architecture and the guided wizard. **Do not duplicate** every editor here.

Next page-specs define individual substantial editors where details matter:

**08 — Phone & Forwarding** — first dedicated editor spec.
