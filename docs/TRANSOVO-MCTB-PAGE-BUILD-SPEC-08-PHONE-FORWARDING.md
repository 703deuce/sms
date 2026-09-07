# Transovo MCTB Page Build Spec — 08: Phone & Forwarding

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup/phone`  
**Wizard role:** First-time setup Step 1  
**Product:** Missed Call Text Back  
**Page archetype:** Guided configuration + verification  
**Canonical navigation:** MCTB → Setup → Phone & Forwarding  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs (including **spec 07 — Setup architecture**)

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-08-phone-forwarding.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

Phone & Forwarding exists to connect the customer's existing public business number to Transovo MCTB without replacing that number. The customer continues advertising and receiving calls on their normal business line. Conditional call forwarding routes only the applicable missed-call conditions—such as no answer, busy, or unreachable—to the hidden Transovo toll-free voice ingress. The page must guide users through carrier-specific forwarding setup, allow experienced users to view direct instructions, and then independently verify that the forwarding path actually works. A user stating that forwarding was enabled is not proof of verification. The UI must distinguish the public business line, the hidden forwarding destination, and the SMS text-back sender at all times.

---

## 2. Primary user question

**For first-time setup:**

"How do I connect the phone number my customers already call?"

**For an existing customer:**

"Is my call forwarding working, and how do I change or repair it?"

---

## 3. Exact purpose of this page

This page does only this:

```
Existing business number
        ↓
Customer calls
        ↓
Business does not answer under configured condition
        ↓
Carrier conditionally forwards call
        ↓
Hidden Transovo toll-free ingress
        ↓
MCTB recovery flow
```

This page is **not** for:

* buying a public replacement business number
* configuring the SMS sender
* changing 10DLC registration
* building a full IVR
* creating Smart Routing flows
* configuring AI receptionist
* configuring every telephony feature in the repository

---

## 4. Core number-role model

Cursor must preserve these three separate identities.

**Business line**

The customer's existing public phone number.

Example:

```
Business line
(571) 407-3615
This is the number your customers already call.
```

**Forwarding destination**

The hidden Transovo toll-free voice ingress.

Example:

```
Forward missed calls to
(866) 346-4256
Transovo uses this number to receive missed calls from your business line.
```

This is infrastructure.

It is not normally advertised to the customer's callers.

**Text-back sender**

The SMS number used later in the recovery flow.

Example:

```
Text-back sender
(571) 555-4428
```

or a verified toll-free sender.

The text-back sender does not belong to the core forwarding configuration except perhaps as a read-only contextual link.

**Hard rule:** Never imply all three numbers are the same number.

---

## 5. First-time wizard experience

Within the first-time Setup wizard, this should be one guided step.

Recommended high-level flow:

```
Your business number
    ↓
Choose carrier/provider
    ↓
Choose setup method
    ↓
Follow carrier instructions
    ↓
Tell Transovo you're ready
    ↓
Run verification call
    ↓
Verified
    ↓
Continue
```

---

## 6. Post-setup direct editor

After activation:

```
MCTB
    → Setup
    → Phone & Forwarding
```

should open this page directly.

No wizard progress.

The existing customer should be able to:

* see current business line
* see forwarding status
* see forwarding destination
* view carrier instructions again
* change carrier metadata if needed
* re-run verification
* troubleshoot
* reconnect a changed business line where supported

---

## 7. Screenshot calibration requirement

Before styling this page, Cursor should inspect/screenshoot completed Appointment screens demonstrating:

* configuration page header
* status/readiness panel
* radio/choice controls
* step-by-step instructions
* verification/test state
* inline warning/error pattern
* local setup navigation
* mobile form/reflow behavior

Do not create a new telecom-themed visual system.

Use the same Transovo shell, spacing, typography, controls, status treatment, panels, and buttons.

---

## 8. Page header — post-setup

**H1**

Phone & Forwarding

Supporting line:

Connect the business number your customers already call to Missed Call Text Back.

Do not use:

* Voice Ingress
* SIP Setup
* Telephony Routing
* Call Control Connection

---

## 9. Current-state summary

Existing customers should immediately see something like:

```
Business line
(571) 407-3615

Carrier
AT&T

Forwarding
Verified

Forwarding destination
(866) 346-4256

Last verified
Sep 7 at 9:42 AM
```

Only show timestamps if actually tracked.

---

## 10. Healthy state

A compact status is enough:

```
Forwarding verified
```

Supporting:

Missed calls from (571) 407-3615 are reaching Transovo.

Do not use a giant green success card.

---

## 11. Degraded state

Example:

```
Forwarding needs attention
Transovo has not received a forwarded missed call from this business line during the latest verification.
[Run verification]
```

Do not say forwarding is definitely disabled unless runtime proves that.

---

## 12. First-time Step A — Business line

**Question:**

What business number do your customers call?

**Field:**

Business line

Use canonical phone input.

Requirements:

* visible label
* proper normalization
* preserve user's formatted display
* support the actual regions/product scope
* no US-only internal assumptions if global phone architecture is intended
* validation separate from verification

---

## 13. Business line helper text

Good:

This is your existing public business number. Customers will continue calling this number.

This communicates one of the main product benefits.

Avoid:

Enter your MCTB number.

That would be ambiguous/wrong.

---

## 14. Existing number ownership/relationship

If business lines already exist in canonical Transovo Numbers inventory, select from them.

Example:

```
Business line
○ (571) 407-3615 — Main office
○ (703) 555-1298 — After-hours line
○ Add another business line
```

Reuse canonical number records.

Do not create a separate duplicate string-only phone database inside MCTB if the product already owns these numbers as objects.

---

## 15. Step B — Carrier/provider

**Question:**

Who provides service for this business number?

Examples might include:

* AT&T
* Verizon
* T-Mobile
* Comcast/Xfinity
* Spectrum
* Google Voice
* RingCentral
* Vonage
* Other

The actual list must come from Transovo's maintained forwarding-guide dataset.

Do not invent carrier instructions on the fly.

---

## 16. Provider vs device

The carrier/provider is not always the same thing as the phone.

Potential second question only when necessary:

What kind of phone setup do you use?

Examples:

* iPhone
* Android
* Office/desk phone
* VoIP phone system
* Landline

Only ask this when it changes the instructions.

Do not add extra setup questions just because the data can be collected.

---

## 17. Forwarding guide authority

The carrier walkthrough should be powered by a canonical maintained guide set.

Conceptually:

```
carrier
device/system type
forwarding condition
activation instructions
deactivation instructions
verification notes
known limitations
last reviewed
source/provenance
```

Cursor should not scatter carrier codes inside React components.

---

## 18. Carrier guide centralization

Use one centralized configuration/data source such as:

```
forwarding-guides/
  att.json
  verizon.json
  tmobile.json
  ...
```

or a canonical service/database structure.

Exact implementation depends on repository.

Requirements:

* one source of truth
* reusable during onboarding and later troubleshooting
* versionable
* easy to update
* no duplicate hardcoded instructions on separate pages

---

## 19. Instructions source

The user already has a carrier instruction collection based largely on Smith.ai documentation.

Cursor should preserve/import the approved guide content provided to it.

**Hard rule:** Do not use AI memory to manufacture missing carrier codes.

If Transovo does not have instructions for a carrier:

```
We don't have a verified forwarding guide for this carrier yet.
Contact your carrier and ask how to enable conditional call forwarding for:
• No answer
• Busy
• Unreachable
```

plus Transovo forwarding destination.

Truth is better than guessing.

---

## 20. Setup-method choice

After identifying the carrier, offer two clear paths:

**Walk me through it**

Follow the setup one step at a time.

**Show me the instructions**

See the complete forwarding instructions at once.

Both use the same canonical guide.

This is presentation difference only.

---

## 21. "Walk me through it" mode

A guided sequence can look like:

```
Step 1
Open the Phone app on your iPhone.
[Continue]

Step 2
Open the keypad.
[Continue]

Step 3
Enter:
[carrier-specific code]
[Continue]

Step 4
Tap Call.
[Continue]

Step 5
Wait for the confirmation from your carrier.
[I've finished]
```

Only show actual verified instructions.

---

## 22. Guided walkthrough behavior

Requirements:

* one instruction at a time
* clear progress
* Back and Continue
* no automatic advancement based on fake timer
* preserve current position if user temporarily leaves the browser
* allow switch to full instructions
* user can return later

---

## 23. Instruction mode

Experienced user can choose:

Show me the instructions

Then display the full relevant guide.

Example structure:

```
AT&T — Conditional call forwarding

Forward when busy
[code/instruction]

Forward when unanswered
[code/instruction]

Forward when unreachable
[code/instruction]

Forward all conditional calls
[code/instruction, if appropriate]

Turn conditional forwarding off
[code/instruction]
```

Exact codes come from the approved guide dataset.

---

## 24. Copy action

If code/instruction is text-copyable, provide a real:

Copy code

action where helpful.

If the environment does not safely support copying, users must still be able to select/copy the text manually.

Never make the code available only in an image.

---

## 25. Tap-to-dial/call-code behavior

On mobile, certain carrier service codes may potentially be invoked through a telephone link.

Only implement this if:

* the OS/carrier supports the format reliably
* the actual approved guide permits it
* resulting behavior is safe/predictable

Otherwise show instructions and let the user enter them.

Do not assume every carrier supports `tel:` execution for every star/hash code.

---

## 26. Forwarding conditions

MCTB should use conditional forwarding corresponding to actual recovery behavior.

Potential conditions:

* No answer
* Busy
* Unreachable

Potential combined carrier operation:

* All conditional conditions

Do not recommend unconditional forward all calls unless the product intentionally requires that specific mode.

MCTB is intended to recover calls the business did not answer, not intercept every call.

---

## 27. Voicemail relationship

This must be handled carefully.

The MCTB forwarding path and voicemail behavior interact.

If no-answer forwarding redirects the call before the carrier voicemail answers, the caller may reach Transovo's voicemail path instead.

The UI should explain the actual behavior based on product/runtime.

Example:

When a call isn't answered, it will be forwarded to Transovo. If the caller leaves a voicemail, it will appear in Visual Voicemail.

Do not claim the carrier's original voicemail remains responsible if forwarding architecture replaces it.

---

## 28. Ring-time relationship

Some carriers allow a no-answer delay/ring duration.

If Transovo has carrier-specific supported instructions for ring time:

Expose it only where necessary.

Do not create a universal Ring for 10 seconds field if some carriers do not support that control.

Carrier-specific capability governs.

---

## 29. Forwarding destination presentation

Show prominently during setup:

```
Forward missed calls to
(866) 346-4256
```

Supporting:

This is your Transovo forwarding destination. Customers do not need to call this number directly.

This prevents user confusion.

---

## 30. Customer-specific ingress

If each workspace/customer receives a particular hidden toll-free ingress, the displayed forwarding destination must come from authoritative backend assignment.

Do not hardcode one test number into the frontend.

---

## 31. Number readiness

If forwarding destination has not been provisioned yet:

```
We're preparing your forwarding destination.
```

Do not provide carrier instructions that contain a nonexistent number.

Allow retry/status refresh based on real backend state.

---

## 32. "I've turned it on" behavior

After completing instructions, user can click:

I've turned on forwarding

This means only:

User reports that they completed the carrier steps.

It may advance the UI to Verification.

It must **not** set:

`forwarding_verified = true`

---

## 33. Verification screen

Show:

```
Verify your forwarding

1. Use another phone.
2. Call your business line:
   (571) 407-3615
3. Let it ring without answering.
4. Wait for Transovo to detect the forwarded call.

[Start verification]
```

If verification auto-listens once they arrive at this state, word accordingly.

---

## 34. Why another phone

The test should ideally originate from a number different from the business line/device to represent a real caller and avoid carrier/self-call anomalies.

Instruction can say:

Call your business number from another phone.

Do not ask them to dial the hidden forwarding destination for the production test.

---

## 35. Verification state machine

Canonical conceptual states:

```
Not started
Waiting for test call
Call detected
Validating
Verified
Failed / timed out
```

Keep evidence-based transitions.

---

## 36. Verification checkpoints

If runtime supports them:

```
Call reached Transovo
Workspace matched
Business line matched
Caller ID preserved
Forwarding path recognized
```

Do not expose these as technical provider jargon.

Example display:

```
✓ Call reached Transovo
✓ Correct business line detected
✓ Caller number received
```

---

## 37. Verification success

Example:

```
Forwarding verified
A missed call to (571) 407-3615 successfully reached Transovo.
[Continue]
```

For a post-setup re-test:

Verified just now.

Only if authoritative.

---

## 38. Verification timeout

Example:

```
We didn't receive the test call
Transovo did not detect a forwarded call from your business line.
Check the forwarding instructions and try again.
[Review instructions]
[Try again]
```

Do not immediately conclude carrier forwarding is broken.

Potential causes can exist, but UI should report observed truth.

---

## 39. Verification diagnostics

Use:

```
Problem
Impact
What to do
```

Example:

```
Call reached Transovo, but the caller number was missing

Impact:
MCTB needs the caller's number to start the recovery flow.

What to do:
Review your carrier forwarding setup or contact Transovo support.
```

Only show this state if runtime actually detects it.

---

## 40. Partial verification

Do not flatten every imperfect test into:

Failed

Example:

```
Call reached Transovo
Caller ID was not preserved
```

This is a specific checkpoint failure.

Passed parts stay passed/visible.

---

## 41. Retry

Retry should reset only the test session/checkpoint state required for a new test.

Do not wipe:

* business line
* carrier
* forwarding instructions progress
* previously saved configuration

---

## 42. Verification history

Post-setup may show:

```
Last verified
Sep 7 at 9:42 AM
```

Potential recent test history:

```
Sep 7 · Passed
Aug 29 · Passed
Aug 21 · Failed — caller number unavailable
```

Only if runtime stores this meaningfully.

Do not build decorative history if it does not exist.

---

## 43. Changing business line

This is consequential.

If active user selects a different business line:

Explain:

Changing your business line requires forwarding to be configured and verified again.

Potential confirmation before applying.

Do not silently mark the old verification valid for the new line.

---

## 44. Changing carrier

Changing carrier metadata may invalidate instructions and verification assumptions.

Potential behavior:

* retain business line
* change carrier
* mark forwarding verification as requiring recheck where necessary
* offer new instructions

Do not leave stale AT&T instructions attached to a Verizon line.

---

## 45. Deactivating forwarding

Users need to know how to undo the setup.

Carrier guides should include:

Turn off forwarding

where verified instructions exist.

This is especially important for:

* cancellation
* troubleshooting
* switching providers
* disabling MCTB

---

## 46. Disabling MCTB vs disabling carrier forwarding

These are separate.

**Pause MCTB**

May stop recovery behavior while forwarding still routes calls.

**Disable forwarding at carrier**

Stops calls from reaching Transovo.

UI must not treat these as identical.

If user wants to fully disconnect phone forwarding, show carrier removal instructions.

---

## 47. Setup Overview summary

After success:

```
Phone & Forwarding
(571) 407-3615
AT&T · Verified
```

If degraded:

```
Phone & Forwarding
Needs attention
Forwarding has not been verified.
Fix
```

---

## 48. Home health relationship

Home may show a forwarding issue.

CTA:

Fix forwarding

lands directly on this page/verification state.

Do not make user search through Setup.

---

## 49. Numbers relationship

If MCTB has canonical Numbers page, Phone & Forwarding can link:

Manage numbers

But do not duplicate the entire numbers inventory here.

This page owns MCTB assignment/forwarding configuration.

Numbers owns canonical phone-number inventory.

---

## 50. SMS sender relationship

This page should not configure the text-back sender.

At most:

```
Text-back messaging is configured separately.
[Manage Text Back]
```

Keep architecture clean.

---

## 51. Consent relationship

Do not place Press-1 consent editor here.

Forwarding's job ends once call reaches the appropriate MCTB recovery path.

Consent belongs:

Setup → Consent

---

## 52. Smart Routing relationship

Do not expose Smart Routing builder.

MCTB may internally route voice through whatever verified runtime it uses.

The user should not need to understand a flow builder for basic MCTB.

---

## 53. Toll-free ingress architecture rule

The currently proven forwarding architecture uses hidden toll-free ingress.

Cursor must not redesign this setup around local voice ingress.

Do not reopen previously exhausted implementation experiments simply because the UI is being rebuilt.

---

## 54. No exposed SIP troubleshooting

Normal user should never be instructed to configure:

* SIP Connection
* PRACK
* 183 SDP
* 3PCC
* call-control app
* LiveKit
* provider trunk
* webhook IDs

Those are internal/engineering concerns.

---

## 55. Carrier limitations

If Transovo knows a carrier/device configuration is unsupported or unreliable:

Say so before the user spends time trying.

Example:

```
This carrier doesn't currently support the forwarding method MCTB requires.
Contact support for another option.
```

Only if verified.

Do not manufacture compatibility claims.

---

## 56. "Other carrier" path

If carrier isn't in the maintained guide set:

Provide:

```
Your forwarding destination
(866) 346-4256

Ask your phone provider to enable conditional call forwarding for missed calls to this number.
```

Potential conditions listed according to MCTB requirements.

Then allow verification.

Even without a step-by-step guide, runtime verification can determine whether the resulting setup works.

---

## 57. Support escalation

If repeated verification fails:

Provide real support route if one exists.

Example:

Get help with forwarding

Include useful diagnostic context automatically where safe:

* business line
* selected carrier
* current verification state
* failed checkpoint

Do not require user to copy provider IDs.

---

## 58. Never claim carrier change was made by Transovo

Unless Transovo truly has a carrier integration that changes forwarding automatically for some carriers, wording should be:

Set up forwarding with your carrier

not:

Transovo enabled forwarding

The user/carrier performed the action.

---

## 59. Automatic carrier setup future-proofing

If Transovo later gains APIs to configure forwarding automatically for some carriers, this page may offer:

Connect carrier

But automatic and manual setup must have distinct truthful states.

Do not prebuild fake automatic setup controls.

---

## 60. Guided walkthrough data model

Conceptually, each carrier guide should support steps such as:

```
id
carrier
device_type
condition
title
instructions[]
code
warnings[]
verification_notes
deactivation_instructions[]
source_reference
last_reviewed
```

Exact implementation can vary.

The important part: content is structured data, not hand-written independently on multiple pages.

---

## 61. Guide versioning

Carrier instructions can change.

The guide data should be updateable/versioned.

If the platform stores which guide version a customer used, that can help diagnostics, but do not expose version numbers unless useful.

---

## 62. Guide freshness

If a guide has not been verified recently and Transovo wants to expose that honestly:

These instructions may vary by plan or device.

But avoid generic disclaimers that make every guide feel untrustworthy.

Use factual limitations.

---

## 63. Carrier instructions accessibility

* text, not screenshot-only
* headings and ordered lists
* service codes readable by screen reader
* Copy button accessible
* do not split code into visually styled fragments that become confusing aloud

Example accessible label:

Copy no-answer forwarding code

---

## 64. Codes with * and #

Carrier service codes must preserve exact characters.

Do not normalize/sanitize away:

* `*`
* `#`

If code dynamically includes forwarding number, construct it from the exact guide template + authoritative ingress number.

Test thoroughly.

---

## 65. Never localize carrier service codes

The surrounding labels/instructions can be translated.

The actual carrier code is protocol/data and must remain exact.

---

## 66. Phone formatting inside codes

Do not automatically insert visual formatting into a dial string if carrier syntax requires digits-only/E.164-like content.

Example:

Displayed destination:

(866) 346-4256

Dial code may require:

18663464256

Use the carrier guide's actual rule.

Do not derive blindly by stripping punctuation unless that rule is verified.

---

## 67. Verification event security

A forwarded test call must be associated server-side with:

* correct workspace
* expected business line/setup session
* expected ingress
* test window where applicable

Do not allow one customer's call to verify another customer's workspace.

---

## 68. Verification spoofing

Do not mark verification passed solely from a client-side request claiming:

`testPassed=true`

The server/runtime must provide evidence.

---

## 69. Concurrent setup

If two admins are editing the same phone setup:

Use canonical configuration concurrency behavior.

Do not allow one browser's stale verification state to overwrite newer configuration silently.

---

## 70. First-use states

| State | Treatment |
|-------|-----------|
| No business line | Prompt selection/entry |
| Business line, no carrier | Prompt carrier |
| Instructions not completed | Resume guide |
| User completed instructions, not verified | Show verification |
| Verified | Continue |

Each state should resume properly.

---

## 71. Loading state

Use geometry-matched loading for:

* business line
* assigned ingress
* carrier guide
* verification state

Do not show fake placeholder forwarding numbers.

---

## 72. Error — forwarding destination unavailable

Example:

```
Your forwarding destination couldn't be loaded.
Don't change your carrier settings yet.
[Retry]
```

This is important because the user must not forward to an unknown number.

---

## 73. Error — guide unavailable

Example:

```
We couldn't load the AT&T forwarding guide.
Your phone settings have not been changed.
[Retry]
```

Could still display the authoritative forwarding destination if available.

---

## 74. Partial/degraded state

Example:

* current forwarding verified
* guide service temporarily unavailable

Existing verified configuration remains shown as healthy.

Do not imply MCTB stopped working because help documentation failed to load.

---

## 75. Success state

After verification:

```
Forwarding verified
Missed calls from your business line can now reach Transovo.
```

Wizard:

Continue

Post-setup:

Done is generally unnecessary; the page can remain showing current state.

---

## 76. Mobile guided setup

This is especially important because many users may be configuring forwarding on the same phone they need to operate.

Mobile walkthrough should:

* show one step at a time
* keep code easy to read/copy
* preserve progress when app/browser is backgrounded
* resume where user left off
* avoid timeout just because user switches to Phone/Settings app

---

## 77. Mobile background/resume

The user may:

1. read instruction
2. switch to Phone app
3. enter code
4. return to browser

The setup page must preserve:

* carrier
* business line
* current guide step
* entered settings
* verification mode

Do not reset.

---

## 78. Verification waiting timeout and mobile

If verification has a finite window:

State exact duration if needed.

Better architecture:

* server-side verification session continues while user leaves browser
* returning page restores current state

Do not require browser to remain foregrounded to detect the call.

---

## 79. Verification live updates

Can update using actual polling/event mechanism already supported.

States:

```
Waiting for test call…
```

then:

```
Call detected.
Checking forwarding…
```

then final.

No fake animated progress percentages.

---

## 80. Accessibility

At minimum:

* one H1
* visible form labels
* carrier choice correctly grouped
* walkthrough progress programmatic
* ordered instructions semantic
* carrier codes accessible text
* Copy actions keyboard accessible
* verification status announced
* errors linked to relevant step
* focus moves intentionally when wizard step changes
* no color-only verified/failure state
* 44px touch targets
* 320px reflow
* 200% zoom
* no hover-only instruction
* screen orientation unrestricted

---

## 81. Focus behavior

**Wizard:**

After Continue, focus new step H1/H2.

**Verification:**

When verification finishes, announce status but do not unexpectedly steal focus from a currently active control.

**Error:**

Focus to error summary/heading where appropriate.

---

## 82. Forms validation

Validate:

* business line syntax/normalization
* required carrier choice

Do not call:

Forwarding not verified

a form-validation error.

That is runtime readiness.

---

## 83. Read-only role

A staff user without setup-edit permission may see:

```
Business line
(571) 407-3615
Forwarding
Verified
```

and potentially guide/help content.

They cannot change assignment/configuration.

Server enforces.

---

## 84. Date/time

Verification timestamps use canonical workspace/audit formatter.

Example:

```
Last verified
Sep 7, 2026 · 9:42 AM EDT
```

No ad hoc browser formatting.

---

## 85. Internationalization

* guide UI text externalized
* carrier names remain provider names
* carrier service codes remain exact
* phone inputs architecture not artificially US-only
* long translated instructions reflow
* numbered steps semantic
* RTL layout supported
* destination dial strings isolated for bidi safety

---

## 86. Analytics relationship

Forwarding verification itself is infrastructure/setup, not a business analytics KPI.

Do not add:

Forwarding success rate

to normal customer Analytics unless later justified.

Operational call detection data remains under Missed Calls.

---

## 87. Diagnostics relationship

Test & Diagnostics may reference this subsystem:

```
Phone path
Verified
Last test
Passed
```

and link:

View Phone & Forwarding

The canonical configuration remains here.

---

## 88. Legacy forwarding setup audit

Cursor must inspect and preserve useful existing assets including:

* carrier forwarding guides
* forwarding verification APIs
* MCTB onboarding forwarding steps
* `/voice/setup` forwarding section
* live test infrastructure
* carrier code logic/templates
* workspace-specific ingress assignment

Do not recreate working carrier guides from scratch if they already exist.

---

## 89. No duplicate guide implementations

These should all reuse the same carrier guide source:

* First-time wizard
* Phone & Forwarding editor
* Troubleshooting
* Help link
* Support diagnostics

One source.

---

## 90. Test scenario — AT&T guided setup

Example certification:

```
New user
    ↓
Business line selected
    ↓
AT&T
    ↓
Walk me through it
    ↓
Correct approved AT&T guide appears
    ↓
Customer configures conditional forwarding
    ↓
I've turned on forwarding
    ↓
Verification begins
    ↓
Customer calls public business line
    ↓
Does not answer
    ↓
Call reaches assigned Transovo toll-free ingress
    ↓
Caller identity preserved
    ↓
Verified
```

---

## 91. Test scenario — direct instructions

```
Existing user
    ↓
Phone & Forwarding
    ↓
View instructions
    ↓
Full carrier guide
    ↓
Reconfigure
    ↓
Run verification
    ↓
Pass
```

No wizard required.

---

## 92. Test scenario — wrong setup

Call public line.

Transovo receives nothing.

Result:

Test call not detected

Not:

Carrier error 480

unless detailed internal diagnostics are explicitly opened.

---

## 93. Test scenario — partial path

Transovo receives call but caller ID missing.

Show exact observed failure.

Do not claim no call was received.

---

## 94. Test scenario — unsupported carrier

* no fake instructions
* forwarding destination shown
* customer given generic conditional-forwarding request language
* verification still available
* support path available

---

## 95. Test scenario — carrier changed

* old carrier AT&T
* change to Verizon
* old instructions removed
* new guide shown
* verification marked requiring recheck where appropriate

---

## 96. Test scenario — business line changed

* new line assigned
* previous forwarding verification does not carry over
* new verification required

---

## 97. Test scenario — hidden ingress changed

If backend legitimately rotates/changes ingress:

* UI surfaces the new forwarding destination prominently
* old setup cannot remain falsely Verified
* clear remediation required

This should be rare and runtime-driven.

---

## 98. Test scenario — mobile backgrounding

* open walkthrough
* switch to Phone app
* return
* same step remains
* no configuration loss
* verification session works server-side

---

## 99. Test scenario — read-only user

* status view works
* edit actions unavailable
* no authorization bypass by direct API call

---

## 100. Prohibited patterns

Cursor must not:

* treat Phone & Forwarding as a generic forwarding SaaS product
* create a PBX setup interface
* ask customers to replace their public business number
* call the hidden toll-free ingress their "business number"
* call the SMS sender the forwarding number
* hardcode carrier instructions in multiple components
* fabricate carrier codes
* automatically mark verification successful after user clicks "I've turned it on"
* make users call the hidden forwarding destination for the end-to-end production test
* use local Telnyx voice DID assumptions contrary to the working toll-free architecture
* reopen SIP/PRACK/183/3PCC experimentation during this UI work
* expose raw telephony jargon in normal UI
* treat pause as forwarding disabled
* wipe configuration after a failed test
* block the browser while the user switches to the Phone app
* create fake progress percentages
* show mock phone numbers or verification state

---

## 101. Definition of done — Phone & Forwarding

Cursor may mark this section complete only when:

* [ ] Business line is explicitly the customer's existing public number
* [ ] Forwarding destination is explicitly the hidden Transovo ingress
* [ ] Text-back sender remains a separate concept
* [ ] First-time setup provides carrier selection
* [ ] Guided Walk me through it mode exists
* [ ] Full-instructions mode exists
* [ ] Both modes use one canonical carrier-guide source
* [ ] Existing approved carrier-guide content is preserved/imported
* [ ] Missing carrier guides are not fabricated
* [ ] Conditional forwarding conditions match actual MCTB behavior
* [ ] Unconditional forwarding is not incorrectly recommended
* [ ] Carrier/device questions only appear when they change instructions
* [ ] User can return to instructions post-setup
* [ ] Carrier deactivation instructions available where maintained
* [ ] Forwarding destination comes from authoritative workspace assignment
* [ ] UI never hardcodes a test forwarding number
* [ ] I've turned it on does not equal Verified
* [ ] Verification uses a real forwarded call
* [ ] Production test originates through the public business line
* [ ] Verification is server/runtime authoritative
* [ ] Correct workspace association is checked
* [ ] Caller ID preservation is checked where runtime supports it
* [ ] Partial verification failures are specific
* [ ] Retry does not erase configuration
* [ ] Changing business line invalidates/rechecks applicable verification
* [ ] Changing carrier updates guide and recheck state appropriately
* [ ] Home/Setup blockers deep-link here
* [ ] Test & Diagnostics reuses this subsystem state
* [ ] No duplicate forwarding configuration engine introduced
* [ ] Existing forwarding APIs/tests preserved
* [ ] Toll-free ingress architecture preserved
* [ ] No exhausted SIP implementation paths are reopened
* [ ] Mobile walkthrough survives leaving/returning to browser
* [ ] Server-side verification does not require foreground browser
* [ ] 320px reflow passes
* [ ] 200%/relevant zoom passes
* [ ] Keyboard-only setup passes
* [ ] Screen-reader instructions/status pass
* [ ] Carrier service codes retain exact characters
* [ ] Tenant/workspace verification isolation enforced
* [ ] Visual implementation matches completed Transovo Appointment language

---

## Build handoff

Next page-spec: **09 — Missed-call Rules** — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-09-MISSED-CALL-RULES.md`.

**10 — Text Back** — pending build spec.
