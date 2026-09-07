# Transovo MCTB Page Build Spec — 10: Text Back

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup/text-back`  
**Wizard role:** First-time setup Step 4  
**Product:** Missed Call Text Back  
**Page archetype:** Customer-facing message configuration  
**Canonical navigation:** MCTB → Setup → Text Back  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs (including **spec 07 — Setup architecture**)

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-10-text-back.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

Text Back controls the customer-facing recovery message sequence after a missed call. It must represent the actual runtime and compliance flow exactly. In Verified Call Consent / Press-1 mode, the first outbound SMS is a system-controlled Transovo compliance confirmation and must not be editable as the business's custom text. The second outbound SMS is the conversational recovery opener and may be editable where runtime supports it. In Existing Consent mode, only the applicable existing-permission message flow should be shown. Message preview, sender identity, schedule variants, links, encoding/segment information, and validation must use authoritative runtime behavior. Cursor must not merge compliance confirmation and conversational messaging into one generic editable "First Text."

---

## 2. Primary user question

**First-time setup:**

"What will missed callers receive by text?"

**Existing customer:**

"What message do callers receive, and how do I change it?"

---

## 3. Exact responsibility of this page

This page owns:

* the customer-facing recovery-message configuration
* the actual message sequence preview
* business-hours / after-hours message variants where supported
* sender context/readiness display
* supported message variables
* timing/delay configuration where runtime genuinely supports it
* link/request-form insertion where appropriate
* SMS encoding/segment awareness where useful
* validation of actual message content

It does not own:

* consent mode selection
* Press-1 disclosure/audio
* sender registration lifecycle
* carrier forwarding
* generic SMS campaigns
* bulk marketing
* conversation inbox replies
* opt-out override
* generic automation workflows

---

## 4. Core architecture

The message flow depends on consent mode.

**Verified Call Consent / Press-1**

```
Missed call
    ↓
Caller hears consent prompt
    ↓
Caller presses 1
    ↓
Consent event recorded
    ↓
Message 1 — System compliance confirmation
    ↓
Message 2 — Conversational recovery opener
    ↓
Customer reply
    ↓
Conversation
```

**Existing Consent**

```
Missed call
    ↓
Canonical eligibility check
    ↓
Existing permission accepted/provenance available
    ↓
Recovery message
    ↓
Customer reply
    ↓
Conversation
```

The UI must adapt to the active mode.

---

## 5. Press-1 system confirmation

This message is system controlled.

Canonical concept:

```
Transovo: You're subscribed to texts about your inquiry to [Business]. Reply STOP to opt out. Reply HELP for help. Standard rates apply. Terms: [link] Privacy: [link]
```

The actual production copy may use canonical centralized compliance text/versioning.

**Hard rules**

* show it in preview
* do not let business edit it as a normal template
* do not allow deletion
* do not let business remove STOP/HELP/Terms/Privacy content
* do not allow per-page divergence from centralized compliance copy
* preserve message version/history if compliance policy changes

---

## 6. Conversational opener

This is the message the business can customize where supported.

Canonical default concept:

```
Reply here to message [Business]. Reply STOP to opt out.
```

This is the actual conversational handoff.

It should be clearly labeled:

**Conversation opener**

not:

* First text
* Welcome message
* Compliance message
* Auto SMS

---

## 7. Message sequence preview

For Press-1, preview must show two distinct messages.

Example:

```
What callers will receive

1. System confirmation
Transovo: You're subscribed to texts about your inquiry to Joe's Plumbing...

2. Conversation opener
Reply here to message Joe's Plumbing. Reply STOP to opt out.
```

Do not visually merge them into one bubble.

---

## 8. System-message labeling

Use a quiet but clear label such as:

Sent automatically by Transovo

or:

System confirmation

Supporting text:

This message confirms the caller's SMS subscription after they press 1.

Do not imply the business wrote it.

---

## 9. Existing Consent mode

If the workspace uses Existing Consent:

Hide Press-1-only system confirmation from the active sequence.

Show only the actual recovery message behavior relevant to this mode.

Potential UI:

```
Existing permission mode
Callers receive:
[editable recovery message]
```

Do not show irrelevant locked Press-1 content.

---

## 10. Consent mode context

At top of Text Back page, show compact context:

```
Consent method
Ask callers to press 1
[Change]
```

or:

```
Consent method
Use permission my business already has
[Change]
```

Change links to Setup → Consent.

Do not duplicate the full consent editor here.

---

## 11. Sender context

Show actual sender used for the preview.

Example:

```
Text-back sender
(866) 555-0198
Verified toll-free
Ready
```

or:

```
Text-back sender
(571) 555-4428
Dedicated local text-back number
Registration pending
```

The sender is context, not configured here if sender management has its own canonical home.

---

## 12. Sender-state impact

If sender is not ready:

Show:

```
Text-back sender needs attention
You can edit your message, but recovery texts cannot be sent until the sender is ready.
[Manage business texting]
```

Do not block harmless editing unless runtime requires it.

But do not show the page as fully operational.

---

## 13. Business identity

Message variables may depend on business identity.

Example:

```
Business name
Joe's Plumbing
```

If business name comes from canonical organization settings:

link to that setting if necessary.

Do not create an MCTB-specific duplicate business-name field unless product requires an override.

---

## 14. Primary editable field

**Label:**

Conversation opener

Use visible label.

**Helper:**

This message is sent after the caller's consent/eligibility check and opens the text conversation with your business.

Example default:

```
Reply here to message {{business_name}}. Reply STOP to opt out.
```

If template syntax is not intended for ordinary users, use a structured variable picker rather than exposing raw braces.

---

## 15. Template variables

Expose only actual supported variables.

Potential examples:

* Business name
* Caller first name, if reliably known
* Request form link
* Booking link
* Business phone

Do not invent unsupported variables.

Preferred UI:

Insert variable

rather than requiring users to memorize syntax.

---

## 16. Variable preview

Preview must resolve sample or real configuration values.

Example:

Template:

```
Reply here to message {{business_name}}.
```

Preview:

```
Reply here to message Joe's Plumbing.
```

Do not show unresolved template tokens in the customer preview unless there is an actual error.

---

## 17. Missing variable behavior

If a required variable cannot resolve:

Block save/send as appropriate.

Example:

```
Business name is missing.
Add a business name before using this message.
[Open Business settings]
```

Do not silently send `{{business_name}}`.

---

## 18. Business-hours and after-hours variants

If runtime supports variants, this page should expose them clearly.

Recommended structure:

```
Conversation opener
○ Use one message all the time
○ Use different messages by schedule
```

If separate messages selected:

* Business-hours message
* After-hours message

Reuse the canonical Business Hours schedule.

Do not create another schedule editor here.

---

## 19. Schedule reference

Example:

```
Business hours
Mon–Fri · 8:00 AM–6:00 PM Eastern
[Manage business hours]
```

This page uses the schedule.

Setup → Business Hours owns the schedule itself.

---

## 20. Business-hours message

Example:

```
Thanks for calling Joe's Plumbing. Reply here and our team will help you shortly.
```

Only actual supported content.

Do not imply immediate human availability unless business has configured that expectation.

---

## 21. After-hours message

Example:

```
Thanks for calling Joe's Plumbing. We're currently closed, but reply here and we'll follow up when we reopen.
```

Keep it factual.

Do not make scheduling promises that runtime/business cannot guarantee.

---

## 22. Default-message strategy

First-time setup should have a sensible working default.

The user should be able to get value without writing copy from scratch.

Provide a good default that uses canonical variables.

Do not auto-fill claims like:

We'll call you back in 5 minutes

unless guaranteed.

---

## 23. Message timing/delay

If actual runtime supports a configurable delay:

Expose it as a secondary setting.

Example:

```
Send recovery opener

* Immediately
* After 15 seconds
* After 30 seconds
* Custom, only if supported
```

But:

* do not invent a compliance minimum delay
* do not imply the second Press-1 message legally must wait
* system confirmation and conversation opener can occur back-to-back seconds apart if runtime/policy allows

---

## 24. Delay ownership

There should be one canonical delay control.

Do not duplicate delay in:

* Text Back
* Follow-up Rules
* Schedule
* Automation

The initial recovery-message delay belongs here.

Repeat-message cadence/cooldown belongs under Follow-up Rules.

---

## 25. Message preview anatomy

Preview should show:

* sender number
* sender role
* message sequence
* business name substitution
* schedule variant if applicable
* link rendering if included
* segment count if shown
* applicable system/compliance message

Use a restrained phone/message preview pattern if consistent with Transovo design.

Do not build a flashy phone mockup if Appointment visual language is more utilitarian.

---

## 26. Preview mode selector

If business-hours variants exist:

```
Preview
[Business hours] [After hours]
```

This changes preview only.

Do not alter actual schedule.

---

## 27. Test preview vs live send

A preview is not a live SMS test.

Label actions precisely.

* Preview = render content
* Send test = real SMS if supported
* Run MCTB test = full end-to-end Test & Diagnostics

Do not conflate them.

---

## 28. Send test

If supported:

Send a test text

Requirements:

* real authorized target
* clearly identify it as a test
* respect sender/test-mode rules
* do not accidentally trigger regulated production behavior
* no hidden live customer send

If test sending is not already implemented, omit the button.

---

## 29. Test recipient

If a user can send a test to themselves:

Require explicit test number selection/entry.

Do not default to a random contact.

Test mode must be clearly separate from production recovery.

---

## 30. Links

If MCTB supports tracked links:

Allow insertion of approved links.

Potential:

* booking link
* request form
* custom approved URL if supported

Do not expose arbitrary tracking configuration if runtime does not support it.

---

## 31. Request-form link

If public request form is enabled:

Offer:

Insert request form link

Preview actual shortened/tracked rendering only if authoritative.

Do not generate fake example URLs that might be sent.

---

## 32. Link variables

If links are tokenized/tracked dynamically:

The editor should not require users to manually paste unstable signed URLs.

Use canonical link object/variable.

---

## 33. Link tracking disclosure

If the product tracks link clicks and policy requires disclosure/appropriate handling, ensure the broader privacy/compliance architecture covers it.

Do not invent legal copy on this page.

---

## 34. Character and segment counting

If the UI shows message length:

Use actual SMS encoding rules.

Examples:

```
1 SMS segment
```

or:

```
2 SMS segments
```

Do not use naive character count as a proxy.

---

## 35. GSM-7 vs Unicode

If a message contains Unicode/emoji and segment count changes:

The UI should calculate correctly.

Potential helper:

```
This message uses Unicode and will send as 2 SMS segments.
```

Only if segment/cost information matters to the user.

Do not expose telecom jargon unnecessarily if they don't need it.

---

## 36. Grapheme safety

Editing/truncation/counters must not split emoji or combined Unicode characters.

Use Unicode-safe/grapheme-aware logic.

---

## 37. Maximum length

Only enforce actual backend/provider/product constraints.

Do not invent a 160-character maximum if concatenated SMS is supported.

If product enforces a practical maximum, explain it.

---

## 38. Required STOP text

Where the conversational opener is required by canonical policy to contain STOP language, enforce that through centralized template policy.

Do not trust each user to remember it.

If system automatically appends required text, preview must show that actual final output.

---

## 39. Do not duplicate system policy text

If runtime appends:

```
Reply STOP to opt out.
```

do not also make user type it and accidentally send it twice.

There must be one authoritative content-generation layer.

---

## 40. HELP behavior

If HELP language is only required in the system confirmation, do not force it into every business message unless policy/runtime requires it.

UI should reflect the actual canonical messaging policy.

---

## 41. Compliance-copy versioning

The locked Press-1 system message should come from the centralized compliance copy/version service.

Conceptually:

```
message_type: press1_confirmation
version: current
```

Historical sends preserve the version/content actually sent.

Do not hardcode a duplicate static copy in multiple frontend files.

---

## 42. Save behavior

Post-setup:

Save changes

On success:

Text-back message updated.

On network failure:

```
Changes couldn't be saved.
Your message is still here.
[Try again]
```

Do not wipe copy.

---

## 43. Wizard behavior

First-time setup:

* default opener prefilled
* user can accept it
* preview actual sequence
* Continue saves canonical configuration
* no need to configure advanced variants unless required

The wizard should prioritize speed to operational readiness.

---

## 44. Advanced options

Post-setup can expose more:

* business-hours variant
* after-hours variant
* initial delay
* tracked links
* request-form insertion
* any approved variables

Use progressive disclosure.

Do not show every advanced capability during first-time setup.

---

## 45. Message validation

Validate:

* unresolved required variables
* actual backend length limits
* unsupported characters only if provider/product truly restricts them
* missing business identity where needed
* malformed approved link variable/config
* required policy text if not system-appended

Do not use vague "Invalid message."

---

## 46. Validation vs sender readiness

A valid message can exist while sender status is Pending.

That is not a form validation error.

Show:

Message ready

and separately:

Sender registration pending

Keep concepts distinct.

---

## 47. Validation vs consent

A valid recovery opener does not imply recipient consent.

Do not show:

Ready to send to all callers

because the template is valid.

Eligibility is per recipient/event.

---

## 48. Historical messages

Changing this configuration affects future sends only.

Do not rewrite old conversations.

Historical messages must display actual original content.

---

## 49. Preview historical distinction

Preview is current configuration.

Conversation history is historical actual content.

Do not use the same component/state in a way that makes old conversations render from current template.

---

## 50. AI-assisted copy

If Transovo offers AI rewrite/suggestions later:

AI may help draft the conversational opener.

Rules:

* user approves
* AI cannot remove mandatory compliance language
* AI cannot alter system confirmation
* AI cannot invent claims/promises
* original user input preserved where appropriate
* AI suggestions are not auto-published

If not currently implemented, do not add fake AI button.

---

## 51. Tone presets

Do not add:

* Friendly
* Professional
* Urgent
* Salesy

unless actual product supports meaningful presets and they are needed.

Avoid feature creep.

---

## 52. Conversation opener purpose

The opener should make it easy for caller to reply.

Avoid turning it into a long marketing message.

The primary job is:

Open a useful conversation after the missed call.

---

## 53. Business identity clarity

The caller should know which business they are texting.

Use canonical business name.

Do not rely only on sender number.

---

## 54. Base toll-free sender

If base MCTB uses platform toll-free messaging:

Preview should represent actual sender role truthfully.

Do not imply the public business line sends the SMS.

---

## 55. Dedicated local sender

Premium:

```
Dedicated local text-back number
(571) 555-4428
```

Do not label:

Your existing business number

unless technically true.

---

## 56. Sender switching

If sender changes after registration/upgrade:

Future messages use new canonical sender according to runtime.

Existing conversation continuity must be handled by canonical messaging engine.

Do not let the Text Back page arbitrarily select a sender per message unless product supports it.

---

## 57. Conversation continuity

This editor configures the initial automated recovery message.

Manual replies afterward belong to Conversations.

Do not put full reply composer here.

---

## 58. Follow-up Rules relationship

This page owns initial recovery opener.

Follow-up Rules owns:

* repeat-caller cooldown
* max automated recovery attempts/messages
* later follow-up automation if supported

Do not duplicate those controls.

---

## 59. Business Hours relationship

This page can define message variants.

Business Hours owns when each variant applies.

No duplicate weekly schedule editor here.

---

## 60. Consent relationship

Consent owns mode/disclosure.

Text Back reflects the current mode and corresponding message sequence.

No full consent editor here.

---

## 61. Links & Request Form relationship

If Links & Request Form has its own substantial editor, this page should only insert/select links.

Do not duplicate public-form configuration here.

Example:

```
Request form
Enabled
[Insert link]
[Manage request form]
```

---

## 62. Test & Diagnostics relationship

End-to-end test must use the actual saved Text Back configuration.

Do not maintain separate test-only message content.

A live test should verify the same message pipeline production uses.

---

## 63. Runtime contract

Cursor should audit/reuse existing config/runtime fields/services for concepts like:

```
consent_mode
system_confirmation_template/version
recovery_message_template
business_hours_template
after_hours_template
initial_delay
message_variables
default_link
request_form_enabled
sender_id
```

Exact names depend on existing backend.

Do not create a parallel frontend template engine.

---

## 64. Canonical renderer

There should be one message-rendering path used by:

* preview
* test send
* production send
* perhaps admin diagnostics

Conceptually:

```
Template + canonical variables + compliance policy
    ↓
Final outbound message
```

Preview should mirror production rendering as closely as possible.

---

## 65. Preview must not lie

If production automatically appends content, preview shows it.

If production shortens a link, preview should use actual logic or clearly label a representative preview.

Do not show a prettier message than runtime actually sends.

---

## 66. Loading state

When config loads:

* do not briefly show default message over existing saved message
* use form skeleton/disabled fields until authoritative state arrives

Avoid accidental overwrite.

---

## 67. Error state

If config cannot load:

```
Text-back settings couldn't be loaded.
[Retry]
```

Do not allow editing unknown state.

---

## 68. Partial/degraded state

Examples:

Message config loaded, sender status unavailable

Allow editing; show sender status unavailable.

Link service unavailable

Core message editor remains usable; link insertion disabled with explanation.

Preview renderer unavailable

Do not allow blind activation if preview is required by product workflow; otherwise show local failure.

---

## 69. Read-only permission

A user without configuration permission can see:

* current message
* preview
* sender context

but cannot edit/save.

Explain:

You can view this message, but you don't have permission to change it.

---

## 70. Mobile

One-column layout:

```
Text Back
Consent method
Sender
Conversation opener
[textarea]
Preview
Advanced
Save
```

Press-1 system confirmation can appear as a locked preview block above the editable opener.

No side-by-side phone preview at 320px if it causes cramped layout.

---

## 71. Mobile textarea

* minimum 16px font
* grows with content
* no fixed tiny height
* keyboard doesn't hide Save
* long text wraps
* variables usable by touch

---

## 72. Accessibility

At minimum:

* one H1
* visible labels
* locked system message distinguishable programmatically from editable field
* textarea properly described
* variable insertion controls keyboard accessible
* preview semantic
* segment-count updates announced only when useful, not excessively
* validation linked to field
* sender blocker text not color-only
* 320px reflow
* 200% zoom
* focus visible

---

## 73. Locked-message accessibility

Do not render system confirmation as a disabled textarea.

That can imply editability.

Prefer read-only content panel with:

System confirmation — managed by Transovo

This is semantically clearer.

---

## 74. Localization

* admin UI labels localized
* customer-facing message templates may have separate communication locale
* do not assume workspace UI language equals SMS language
* Unicode-safe rendering
* SMS segment logic uses localized final content
* high-risk system compliance copy must use reviewed/versioned localization

---

## 75. Communication locale

If MCTB supports different customer-facing languages, the message configuration may need an explicit communication-language strategy.

Do not infer from admin browser locale.

If unsupported today, do not create fake multilingual template management.

Architect so future i18n does not require rewriting domain logic.

---

## 76. Message ordering

For Press-1, runtime must guarantee:

```
System confirmation
before
Conversation opener
```

Even if only seconds apart.

Do not let asynchronous send race invert the sequence.

This is a backend/runtime requirement Cursor must verify while wiring UI.

---

## 77. Failure between Message 1 and Message 2

If system confirmation sends but conversation opener fails:

Missed Call Detail/Conversation must reflect:

* Message 1 sent/delivered
* Message 2 failed

Do not falsely show the whole recovery sequence failed or succeeded as one boolean.

---

## 78. Duplicate-send protection

The initial recovery sequence must be idempotent against repeated webhook/event processing.

The frontend editor must not introduce new send paths.

This page only configures the runtime.

---

## 79. Opt-out before delayed opener

If customer somehow opts out between system confirmation and a delayed conversational opener:

Canonical send-time eligibility recheck should suppress Message 2 where applicable.

Do not assume eligibility captured earlier remains permanently valid.

---

## 80. Schedule transition

If a message is scheduled near business-hours boundary:

The runtime must use defined canonical behavior for which template/version applies.

Do not decide in frontend.

Potential rules could be based on event time or send time; one must be authoritative.

---

## 81. Template versioning

For audit/history, consider canonical version/effective timestamps if runtime already supports or needs them.

Future events use current active template.

Historical events keep the actual sent content.

---

## 82. Prohibited patterns

Cursor must not:

* create one editable "First Text" that combines both Press-1 messages
* let customer edit/remove the system compliance confirmation
* make system message look business-authored when it is Transovo-authored
* show Press-1 message flow in Existing Consent mode
* duplicate consent controls
* duplicate sender registration controls
* duplicate Business Hours editor
* duplicate Links/Request Form configuration
* use naive character count as SMS segmentation
* invent a 160-character hard maximum
* fabricate sender readiness
* claim same-number texting when sender differs
* create generic SMS campaign functionality
* add bulk send controls
* use current template to render historical messages
* fabricate test sends
* allow preview to differ materially from production rendering
* let AI rewrite compliance policy text

---

## 83. Test scenarios

Cursor must certify:

**A. Press-1 default**

* system confirmation locked
* opener editable
* preview shows two messages
* correct order

**B. Press-1 custom opener**

* save
* preview substituted business name
* live test uses saved opener

**C. Existing Consent**

* system confirmation hidden/not applicable
* correct recovery message shown

**D. Sender pending**

* editing works
* sender blocker shown
* no false ready state

**E. Business-hours variants**

* each message saves separately
* preview toggles correctly
* runtime uses canonical schedule

**F. Unicode**

* emoji/non-Latin input
* segment count correct if displayed
* send path preserves content

**G. Missing variable**

* validation prevents broken final message
* remediation path clear

**H. Link insertion**

* actual supported variable/link inserted
* preview correct

**I. Save failure**

* content preserved
* no false success

**J. System confirmation sent / opener failed**

* downstream operational pages reflect separate states

**K. Historical template change**

* old conversation unchanged
* future message uses new template

**L. Mobile/keyboard**

* full editing/preview workflow accessible

---

## 84. Definition of done — Text Back

Cursor may mark this section complete only when:

* [ ] Uses canonical Transovo configuration visual language
* [ ] First-time wizard and direct editor share same configuration
* [ ] Consent mode context is shown but not duplicated
* [ ] Press-1 system confirmation is locked/system controlled
* [ ] Conversational opener is separately editable where supported
* [ ] Existing Consent mode hides irrelevant Press-1 flow
* [ ] System confirmation and opener display as two actual messages
* [ ] Message order matches production runtime
* [ ] Sender context uses correct number-role terminology
* [ ] Sender readiness remains separate from consent
* [ ] Base toll-free vs dedicated local sender represented truthfully
* [ ] Same-number texting is not falsely claimed
* [ ] Default opener works without customer writing from scratch
* [ ] Business-hours/after-hours variants use canonical schedule
* [ ] Initial delay is exposed only if runtime supports it
* [ ] No fabricated compliance delay requirement
* [ ] Template variables come from real supported set
* [ ] Missing variables cannot leak raw tokens into production
* [ ] Preview uses the canonical renderer
* [ ] Production and preview content agree
* [ ] Links/request-form insertion reuses canonical systems
* [ ] SMS segment logic is encoding-aware if shown
* [ ] Unicode/grapheme handling is correct
* [ ] Historical messages remain unchanged after template edits
* [ ] AI cannot alter locked compliance copy
* [ ] Loading/error/partial/read-only states complete
* [ ] Save failure preserves content
* [ ] Mobile/320px/200% zoom pass
* [ ] Keyboard/screen-reader editing workflow passes
* [ ] No generic campaign/bulk marketing functionality introduced
* [ ] Existing MCTB SMS runtime/template logic preserved
* [ ] No duplicate message-rendering engine introduced

---

## Build handoff

Next page-spec: **11 — Consent** — materially different configuration for Press-1 vs Existing Consent, prompt/audio publishing, and evidence/provenance rules.
