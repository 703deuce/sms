# Transovo Forms, Input & Validation Standards Guide

**Series:** Implementation standards · **Guide #5 of 12**  
**Status:** Active — mandatory hard standard for every form, field, validation rule, and data-entry interaction  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Authorities:** WCAG 2.2 (Input Assistance) · W3C WAI Forms Tutorial · WHATWG HTML Living Standard · WAI-ARIA Authoring Practices Guide (APG)

---

## Master Cursor rule

> **Transovo forms must follow WCAG 2.2 Input Assistance requirements, W3C WAI Forms guidance, the HTML form-control standard, and WAI-ARIA Authoring Practices where native controls are insufficient.** Every input must have a persistent, understandable, programmatically associated label; constraints and instructions must be available before they are needed; redundant entry must be avoided; user work must survive validation and system errors; detected errors must be identified in text and associated with the affected control; known corrections should be suggested where safe; and serious legal, financial, or data-changing submissions must provide appropriate review, confirmation, correction, or reversibility. Use native controls and proper input types first, preserve existing values and context, keep client/server validation synchronized, make inheritance and save scope explicit, and **never expose a setting that does not affect actual runtime behavior**.

**This guide controls how every form, field, validation rule, required input, date/time selector, dropdown, contact picker, setup flow, and data-entry interaction in Transovo must behave.**

---

## Primary authorities

| Authority | Focus |
|-----------|--------|
| **W3C WCAG 2.2** | Input Assistance — error identification, labels/instructions, error suggestions, error prevention, redundant entry, accessible authentication, programmatic input purpose |
| **W3C WAI Forms Tutorial** | Labeling, grouping, instructions, validation, notifications, form structure |
| **WHATWG HTML Living Standard** | Form controls, input types, labels, constraint validation, autocomplete, disabled/readonly behavior, submission |
| **WAI-ARIA Authoring Practices Guide** | Custom input widgets (comboboxes, autocomplete) where native HTML is insufficient |

**Governing rule:** Forms must make the required input understandable before entry, preserve the user’s work, identify errors precisely, suggest corrections when possible, and prevent serious mistakes before they become consequential.

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`
- Guide #4: `docs/TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md`
- Guide #2: `docs/TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md`
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- IA principles: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`
- Guide #6: `docs/TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md`
- Guide #7: `docs/TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md`
- Guide #8: `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md`
- Guide #9: `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`
- Guide #10: `docs/TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md`
- Guide #11: `docs/TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md`

---

## A. Every form control needs a persistent label

Do not use placeholder text as the only label.

**Correct:**

```
Email address
[ name@example.com ]
```

**Incorrect:**

```
[ Enter your email ]
```

because the user’s understanding of the field cannot disappear when they type.

WCAG 3.3.2 requires labels or instructions when content requires user input.

**Cursor rule:** Every user-editable field must have a visible, persistent, programmatically associated label unless the purpose is unambiguously established by an accessible equivalent pattern.

---

## B. Use real `<label>` relationships

For native controls, prefer:

```html
<label for="email">Email address</label>
<input id="email" type="email">
```

or a valid implicit label relationship.

Do not visually place text near a field and assume that creates a programmatic relationship.

The HTML standard defines the label/control association; WAI recommends explicit labels for form controls.

---

## C. Labels must describe purpose, not implementation

| Good | Bad |
|------|-----|
| Mobile number | String value |
| Appointment duration | Duration integer |
| Calendar that receives new appointments | Write-calendar ID |

User language wins.

---

## D. Required vs optional treatment must be consistent

Choose one system.

**Example:**

```
Email address
Phone number — Optional
```

or:

```
Email address *
```

with a visible explanation: `* Required`

Do not sometimes use asterisk, sometimes bold, sometimes red, sometimes nothing.

**Cursor rule:** Required/optional state must be programmatically conveyed and visually consistent across the entire application.

---

## E. Don’t mark every field “required” if almost all are required

For a short form where nearly everything is required, it can be clearer to mark the exceptions:

```
Notes — Optional
```

rather than covering the page in asterisks.

The design must still programmatically convey required fields correctly.

---

## F. Instructions must appear before the user needs them

WCAG 3.3.2 requires labels or instructions where input is required.

If a field has constraints:

```
Password must contain at least 12 characters.
```

tell the user **before or while** they enter it.

Don’t wait until submit to reveal: `Password needs 12 characters.`

Likewise:

- EIN must contain 9 digits.
- Booking can be scheduled up to 90 days ahead.
- Reply-to email must be verified before use.

---

## G. Don’t put essential instructions only in a tooltip

If success depends on understanding it, show it in the form. Tooltip is supplementary.

**Bad:** Campaign type `(?)` — where the only explanation of a legally meaningful choice lives behind hover.

**Better:**

```
Messaging use case
Choose the option that best describes the appointment messages you will send.
```

---

## H. Helper text should explain constraints or consequences

**Useful helper text:** This calendar receives appointments created in Transovo.

**Not useful:** Select a calendar. — The label already says Calendar.

Helper text should add information, not repeat it.

---

## I. Use the correct native input type

The HTML standard defines specialized input types for different data.

Use appropriate inputs where supported: `email`, `tel`, `number`, `date`, `time`, `url`, `password`, `search`

This improves validation, mobile keyboards, assistive technology, and browser functionality.

Do not use `<input type="text">` for every possible value.

---

## J. Native input type does not eliminate server validation

Browser validation improves UX. It is not security/business validation.

**Cursor must validate authoritative rules on the server as well.**

**Example:** Browser can recognize email-shaped string. Server still decides: email allowed? duplicate? verified? belongs to correct tenant?

UI validation and business validation are separate.

---

## K. Input purpose should be programmatically identifiable

WCAG 1.3.5 requires the purpose of certain user-information inputs to be programmatically determinable where applicable.

Use appropriate autocomplete tokens for user data such as name, email, phone, organization, address where applicable.

**Examples:** `autocomplete="name"` · `autocomplete="email"` · `autocomplete="tel"` · `autocomplete="organization"`

Do not disable browser autofill without a legitimate reason.

---

## L. Avoid asking the user to enter information the system already knows

WCAG 2.2 added **3.3.7 Redundant Entry**, requiring previously entered information in the same process to be auto-populated or selectable, with limited exceptions.

For Transovo: If Contact already contains name, phone, and email, and staff starts **Book appointment**, do not make them enter the same fields again. Carry them forward.

---

## M. Preserve values when moving through a multi-step process

**Wizard:** Business information → Messaging use → Consent → Review

Going Step 3 → Back → Step 2 must preserve entered information.

Do not reset the flow simply because navigation occurred.

---

## N. Preserve entered values after validation errors

WAI specifically recommends accessible error handling rather than forcing users to reconstruct the form.

If submission fails because EIN is invalid, do not erase legal business name, address, website, contact name, or phone.

**Cursor rule:** Validation failure must never wipe unrelated valid user input.

---

## O. Choose field width according to expected data

Form fields do not have to occupy the entire container.

| Field | Width |
|-------|-------|
| ZIP code | small |
| Phone | moderate |
| Email | moderate/large |
| Long description | wide |

This helps users visually infer expected input and improves scanability.

But never truncate input merely because the visual field is narrower.

---

## P. Use one-column form flow by default

For complex professional applications, the safe default is a strong top-to-bottom reading order.

**Good:**

```
Name
[________________]
Duration
[________]
Location
[________________]
```

Two-column layouts should be reserved for closely related short fields such as **Start date | Start time** or **First name | Last name**.

Don’t make a six-column form simply to save vertical space.

---

## Q. Field order must follow the user’s task, not the database schema

**Example Booking Type:**

1. Name
2. Duration
3. Location
4. Hosts
5. Availability
6. Booking rules
7. Customer questions
8. Reminders
9. Payment
10. Confirmation

**Not:** ID, foreign key, enum, serialized config

Form order communicates workflow.

---

## R. Group related fields semantically

WAI recommends grouping related controls where that relationship matters.

**Examples:**

**Customer information** — Name, Email, Mobile number

**Availability** — Days, Start time, End time

**Reminder timing** — Channel, Offset, Send time

Use semantic grouping such as `fieldset`/`legend` when appropriate.

---

## S. Use fieldset and legend for meaningful grouped choices

Especially radio groups and multiple related checkboxes.

**Example:**

```
Reminder channels
☑ SMS
☑ Email
☐ Voice
```

Programmatically, **Reminder channels** should be the group label, not merely a nearby heading.

WAI Forms guidance explicitly covers grouping controls.

---

## T. Radio buttons are for one choice from a known small set

**Example:**

```
Scheduling method
○ One host
○ Round robin
○ Collective
```

Use radio when options are mutually exclusive, options should be visible simultaneously, and set is relatively small.

Do not replace this with a dropdown merely to save a few pixels if seeing the choices helps understanding.

---

## U. Checkboxes represent independent selections

**Example:**

```
Send reminders using:
☑ SMS
☑ Email
☐ Voice
```

Each can be selected independently. Don’t use radio semantics for multi-selection.

---

## V. Switches represent immediate binary state

Use switch for things like **Auto-join meetings: On/Off** or **Allow customer cancellation: On/Off**.

But not when the user’s intent is include this item as part of a form selection — where checkbox may be semantically clearer.

---

## W. Select/dropdown is appropriate for moderate known option sets

Examples: timezone, calendar, reminder sequence, booking type

For very small sets, radio buttons may be easier. For huge searchable sets, combobox/autocomplete is better. Choose based on interaction need.

---

## X. Large option sets should use search/combobox behavior

Examples: choose contact from thousands, choose timezone, select staff from large organization

WAI APG defines the expected combobox interaction pattern.

Do not produce a 2,000-item native-looking dropdown unless it is genuinely usable.

---

## Y. Comboboxes require correct state and keyboard behavior

A custom autocomplete must support:

- expanded/collapsed state
- accessible popup relationship
- arrow navigation where applicable
- Enter to select
- Escape to dismiss
- appropriate active-option semantics
- normal text editing

W3C provides detailed requirements through APG.

---

## Z. Search results must not silently become the selected value

Typing **Ant** and displaying **Anthony Johnson** must not choose Anthony until the user actually selects/confirms the option.

**Suggestion ≠ committed value.**

---

## AA. Multi-select controls need clear selected state

If a booking type can have multiple hosts, user must be able to determine: available hosts, selected hosts, how to remove selection, maximum/constraints if any.

Do not rely solely on subtle background color.

---

## AB. Date fields must distinguish date from date-time

A date such as **Sep 9** is not the same conceptual input as **Sep 9 at 2:00 PM**.

Don’t force every scheduling field through one overly generic date-time widget. Use the simplest field appropriate to the task.

---

## AC. Date pickers need direct text alternatives where practical

A user should not necessarily have to click next month → next month → next month → day for distant dates.

Where reasonable, allow direct date entry or efficient month/year navigation.

---

## AD. Time input must respect locale/user convention

If user works in 12-hour time: **2:00 PM**

Don’t force **14:00** unless locale/settings call for it.

Formatting standards belong in our separate date/time guide, but form controls must preserve that convention consistently.

---

## AE. Timezone must not be silently ambiguous

When entering a date/time whose timezone materially matters, expose the timezone.

**Example:** `2:00 PM Eastern Time` — where ambiguity could affect bookings.

Do not leave users guessing whether customer timezone, workspace timezone, or calendar timezone is being used.

---

## AF. Duration inputs should use domain-appropriate controls

For appointment duration, prefer **15 minutes · 30 minutes · 45 minutes · 1 hour · Custom** if these are common.

Don’t require users to enter `0.5` into a numeric field representing hours. Match the real-world concept.

---

## AG. Numbers must define units explicitly

**Bad:** `Buffer: 30`

**Better:**

```
Buffer before appointment
30 minutes
```

A number without a unit is ambiguous. Applies to minutes, days, seats, dollars, percentages, booking limits.

---

## AH. Avoid free-text when structured input improves correctness

If the system needs **State** and supported choices are known, use appropriate structured control.

If it needs appointment status, don’t use arbitrary text.

Structured controls reduce invalid values. But don’t over-structure genuinely free-form information such as notes.

---

## AI. Input masks must not fight the user

Phone/card/date formatting may improve readability. But input masks must:

- preserve editing
- allow paste
- not jump cursor unexpectedly
- not reject valid international formats unnecessarily
- not make screen-reader interaction confusing

Normalize canonical value separately.

---

## AJ. Store normalized values separately from presentation

**Example phone:**

- User sees: `(571) 407-3615`
- Backend may store: `+15714073615`

Do not force backend representation into the UI. Same principle applies to dates, currency, percentages.

---

## AK. Validation has three different layers

Cursor should distinguish:

| Layer | Example |
|-------|---------|
| **1. Format validation** | Invalid email structure |
| **2. Business-rule validation** | This time is no longer available |
| **3. System/provider validation** | Microsoft rejected this calendar update |

Do not collapse everything into **Invalid input.**

---

## AL. Validate at an appropriate time

Avoid aggressive validation while the user is still entering incomplete data.

**Example:** User starts typing `a` — don’t immediately show **Invalid email.**

Prefer validation after blur, after meaningful completion, on submit, or contextually after enough input.

The goal is assistance, not punishment.

---

## AM. Client-side validation should be immediate where safe

Examples: required field missing, invalid email format, impossible negative seat capacity — can often be detected locally.

Do not make the user wait for a server round-trip for trivial format problems.

---

## AN. Server errors must be mapped back to the relevant field where possible

If API returns `calendarId invalid`, translate it to **This calendar is no longer available. Choose another calendar.** and associate it with the calendar field.

Don’t display raw backend messages.

---

## AO. Every validation error must identify the error in text

WCAG 3.3.1 requires detected input errors to be identified and described to the user in text.

**Bad:** Red border only.

**Good:** Enter a valid mobile number.

Color and icon may reinforce it. **Text is required.**

---

## AP. Error messages should explain what needs correction

| Bad | Good |
|-----|------|
| Invalid value. | Enter a number between 1 and 50. |
| Date error. | End time must be later than start time. |

W3C’s error-identification guidance emphasizes describing the error so the user can locate and understand it.

---

## AQ. If a correction is known, suggest it

WCAG 3.3.3 requires correction suggestions when they are known and can be provided without jeopardizing security or purpose.

**Examples:**

- This date is unavailable. Next available time: 3:00 PM.
- Enter the phone number including area code, for example (571) 555-1234.

**Cursor rule:** Don’t stop at telling the user they’re wrong when the system knows how to help them fix it.

---

## AR. Error messages must remain close to the affected control

Use proximity.

**Example:**

```
Email address
[anthony@                    ]
⚠ Enter a complete email address.
```

Do not make the user scan a toast at top of screen to determine which field failed.

---

## AS. Complex forms should also provide an error summary

For long/wizard forms with multiple errors, a summary is useful:

```
3 items need attention
• Legal business name
• Website
• SMS consent description
```

Each error should link/focus the related field where practical. But field-level errors still remain. Summary does not replace them.

---

## AT. Move focus carefully after failed submission

For a large form, reasonable behavior may be focus error summary or first invalid field depending on design — but do not arbitrarily move focus while the user is typing.

The goal is efficient recovery.

---

## AU. Do not erase valid fields because one field failed

**Hard rule.**

If website URL is invalid, keep everything else.

This applies equally to client validation, server validation, and provider errors.

---

## AV. Required-field errors should be specific

| Bad | Better |
|-----|--------|
| Required. | Enter a business name. |
| Required. | Select a calendar. |

The message should name what needs to happen.

---

## AW. Cross-field errors must explain the relationship

**Example:** End time must be later than start time. — Not: Invalid start time.

If minimum notice exceeds booking window, say that relationship explicitly.

---

## AX. Errors caused by another field should point to the actual cause

If SMS toggle becomes invalid because sender registration is missing, don’t blame **SMS field invalid.**

Explain: **Business texting registration is required before SMS can be enabled for imported appointments.** And link to setup if appropriate.

---

## AY. Field validation and business eligibility are not the same thing

An input can be syntactically valid but not eligible.

**Example:** Phone number is valid. But contact opted out.

That’s not a form validation error. That is an eligibility/business state. Present it differently.

---

## AZ. Prevent serious errors before submission

WCAG 3.3.4 requires protections for legal, financial, or data-changing submissions: submissions must be reversible, checked, or confirmed under its defined scope.

For Transovo, apply strong safeguards to: refunds, appointment cancellation where consequential, deleting records, publishing communication workflows, changing sensitive consent settings, payment actions.

Use at least one of: review, confirmation, correction opportunity, reversibility — where applicable.

---

## BA. Financial submissions require review/correction opportunity

**Example — Booking payment:** Before final consequential submission, user should understand amount, customer, appointment, payment method/context.

If staff issues refund, show **Refund $150.00 to Anthony Johnson?** — not **Confirm action?**

Specificity prevents costly mistakes.

---

## BB. Destructive changes should state impact

**Example — Delete booking type**

Explain: Existing appointments will remain. The public booking page for this type will stop accepting new appointments. — Or whatever actual behavior is true.

The user needs scope before committing.

---

## BC. Don’t require confirmation for every harmless save

Error prevention must be proportional.

Do not add **Are you sure?** to changing display name, setting filter, or toggling a harmless preference.

Too many confirmations reduce effectiveness because users stop reading them.

---

## BD. Review screens are appropriate for complex submissions

Good candidates: A2P registration, organization security setup, large import, payment/refund, workflow publication with broad impact.

Review shows what will actually happen before commitment.

---

## BE. Reversible actions can often use Undo instead

For low-risk reversible data changes: **Removed from waitlist. Undo** may be more efficient than a blocking confirmation dialog.

Choose the least disruptive safe mechanism.

---

## BF. Never require re-entry merely to verify a value unless necessary

Don’t ask for Email address + Confirm email address if the purpose can be achieved more effectively another way.

Repeated entry creates errors and violates the spirit of redundant-entry reduction.

Exceptions may exist for genuinely high-risk values, but they should be justified.

---

## BG. Password paste must not be blocked

For authentication fields: Allow password managers and paste.

WCAG 2.2’s accessible-authentication requirements are specifically designed to avoid unnecessary cognitive-function tests and barriers.

Do not force users to manually type long credentials if password managers can supply them.

---

## BH. CAPTCHA/cognitive puzzles must not become authentication barriers

WCAG 3.3.8 Accessible Authentication places restrictions on requiring cognitive function tests in authentication unless alternatives/mechanisms satisfy the criterion.

For Transovo authentication, favor password managers, passkeys/WebAuthn later where appropriate, email links, standard OTP — rather than puzzles.

Security UX gets its own guide later.

---

## BI. Placeholders are examples, not labels

**Appropriate:**

```
Label: Mobile number
Placeholder: (571) 555-1234
```

Do not encode essential formatting rules only in placeholder because it disappears while typing.

---

## BJ. Defaults must be safe and meaningful

Good defaults reduce effort: workspace timezone, primary calendar, standard reminder sequence, 30-minute duration where appropriate.

But defaults that produce consequential behavior must be obvious.

For example: **Send SMS automatically** should not be silently enabled in a context where consent eligibility is unresolved.

---

## BK. Never pre-check consent boxes for the customer

For explicit SMS-consent capture, the customer must make the affirmative selection themselves.

Do not render **☑ I agree to receive appointment texts** preselected.

The compliance guide will carry the legal/carrier specifics; the forms guide carries the UX rule: **Affirmative consent controls must not be preselected when affirmative action is required.**

---

## BL. Consent language must be adjacent to the consent control

Do not put the meaningful consent terms in footer, hidden behind modal, or three screens earlier — and then show **☑ Agree**.

The user must understand what the checkbox means at the point of action.

---

## BM. Different consent purposes need distinguishable controls

Do not collapse appointment reminders and promotional/marketing messages into one vague **I agree to messages** if they represent materially different purposes.

The compliance guide will govern the exact legal model. The form must make choices comprehensible.

---

## BN. Conditional fields appear only when relevant

**Example:** If scheduling method is **One host**, don’t show round-robin distribution, all-host requirement, or group capacity.

If user chooses **Round robin**, then show relevant controls.

This reduces cognitive load and error.

---

## BO. Hiding a conditional field must define what happens to its value

If user selects **Enable payment**, enters $50, then disables payment — Cursor must define whether stored $50 persists invisibly for later re-enable or value resets.

Do not leave stale hidden values producing unintended behavior.

---

## BP. Hidden invalid fields must not block form submission

If a conditional field is no longer applicable and hidden, it should not produce **Please fix field you cannot see.**

Deactivate/remove its validation when out of scope.

---

## BQ. Dependent controls must clearly indicate dependency

**Example:** Reply destination is only relevant if SMS replies enabled.

If disabled, explain or hide it according to task. Avoid presenting settings that appear broken.

---

## BR. Read-only and disabled are different

| State | Meaning |
|-------|---------|
| **Read-only** | User can focus/select/copy value but cannot edit |
| **Disabled** | Control is unavailable for interaction/submission according to HTML behavior |

Choose intentionally. Don’t style a normal field gray and assume its semantics changed.

The HTML standard distinguishes control states such as disabled and readonly.

---

## BS. Disabled fields should not hide important data unnecessarily

If user needs to know **Assigned calendar: Microsoft Work** but can’t change it due to permissions, show it read-only.

Don’t simply disable a select so aggressively that the value becomes hard to perceive.

---

## BT. Form actions must have clear hierarchy

Typical:

```
Cancel                         Save changes
```

Primary action visually strongest. Dangerous action not neighboring Save as an equivalent button.

For long forms, use sticky save area when necessary.

---

## BU. Save button label should describe the action when context benefits

Generic **Save changes** is often fine.

For consequential process: **Submit registration · Create appointment · Issue refund · Publish workflow** is clearer than generic **Submit.**

---

## BV. Avoid “Submit” when a more specific verb exists

Specific labels improve predictability.

Use **Create appointment · Save booking type · Connect Microsoft · Send message · Publish workflow** instead of **Submit · Continue** when the action can be named precisely.

**Continue** remains appropriate for a genuine multi-step flow.

---

## BW. Buttons must not change meaning while the user is reading the form

Avoid forms where primary action unexpectedly switches from **Next** to **Save** to **Publish** without the step/state being obvious.

Users should understand when they are committing something.

---

## BX. Auto-save forms need explicit state

If a setting auto-saves, display **Saving…** then **Saved** and **Couldn’t save** when failure occurs.

Do not mix silent auto-save with explicit-save fields on the same screen without obvious boundaries.

---

## BY. Unsaved-change handling must be consistent

If page uses explicit save and user navigates away with changes, warn.

Options: **Discard changes · Keep editing**

Do not leave some editors protected and others destructive.

---

## BZ. Multi-step forms must reveal progress

For a true wizard: `1 Business · 2 Messaging · 3 Consent · 4 Review`

User should know: current step, remaining progression, how to go back, which step commits.

Do not create fake steps for a simple form.

---

## CA. Do not use a wizard when order doesn’t matter

If settings can be edited independently at any time, a standard configuration page may be better.

Wizard is for setup, registration, ordered dependencies, guided completion — not aesthetic organization.

---

## CB. Long forms should be divided into meaningful sections

**Example Booking Type:** Basics · Hosts and capacity · Availability · Customer questions · Reminders · Payment · Confirmation · Permissions

But don’t split every three fields into a separate card/page. Grouping should reflect decisions.

---

## CC. Section headings must describe the decision being made

**Better:** Hosts and capacity — than Configuration 2

**Better:** When customers can book — than Time settings — where plain language improves comprehension.

---

## CD. Form sections should not duplicate the global navigation

A Booking Type editor can have sections: Availability, Reminders, Payment.

That does not mean these become new global domains. Object-level form structure is contextual.

---

## CE. Inline edit vs full edit must be intentional

**Good inline edit:** appointment status, short note, simple field

**Poor inline edit:** entire Booking Type ruleset, workflow, A2P registration

Complex tasks need dedicated editor context.

---

## CF. Inline editing needs clear save/cancel behavior

If clicking field makes it editable, user must know: how to commit, how to cancel, whether blur saves.

Do not make each field behave differently.

---

## CG. Bulk forms/actions need selection summary

If editing 20 booking types, show **20 booking types selected.** And clearly identify what fields/actions will apply to all.

Never let a single-field edit accidentally become bulk without obvious context.

---

## CH. Bulk changes should communicate destructive scope

**Example:** Disable reminders for 42 appointments? — Not: Save changes?

Scope matters.

---

## CI. Import flows require mapping and validation before commitment

For CSV/calendar-like imports where applicable: show source, show mapping, detect invalid fields, show duplicate behavior, preview counts, review consequences.

Don’t blindly import and report chaos afterward.

---

## CJ. Authentication/API errors must not masquerade as input validation

**Example:** Microsoft Graph returns 401.

Do not show calendar field: **Invalid calendar.**

**Correct:** Microsoft needs to be reconnected. — That’s system state, not user input.

---

## CK. Network failure must preserve form work

If save fails because connection dropped: **Couldn’t save. Try again.** Keep fields. No blank form.

---

## CL. Partial save must be explicit

If a complex process saves some parts but not others, tell the user exactly what happened.

**Example:** Appointment created, but Microsoft calendar sync failed.

Do not show **Success** or **Failed** when reality is partial.

---

## CM. Form submission must prevent duplicate effects

Users may double click, press Enter repeatedly, or retry after latency.

Create/payment/send operations must be idempotent where appropriate.

The UI should move to **Creating…** and suppress repeated execution while request is active.

---

## CN. Input debounce belongs mainly to search/typeahead

Use debounce for remote contact lookup, search, availability preview where appropriate.

Do not delay direct save actions unpredictably.

---

## CO. Dynamic validation/status must be announced accessibly

**Example:** This email is available. or This booking link is already in use.

If updated asynchronously, status should be exposed appropriately to assistive technology under WCAG’s status-message requirements.

---

## CP. Success messages should be specific

| Bad | Better |
|-----|--------|
| Success! | Appointment created. |
| Success! | Appointment created. Microsoft calendar event and two reminders were scheduled. |

Do not overdo verbosity for minor saves.

---

## CQ. Errors should be written in user language

Never expose SQL, HTTP status, provider exception, enum name, or stack trace to regular users.

| Bad | Good |
|-----|------|
| invalid_grant | Microsoft authorization is no longer valid. Reconnect Microsoft to resume sync. |

---

## CR. User should not be blamed

Avoid: **You entered an invalid value.**

Prefer: **Enter a number between 1 and 50.**

Focus on correction.

---

## CS. International phone entry must not assume U.S.-only formatting if international support is enabled

If International SMS exists: country selector/prefix, locale-aware formatting, E.164 normalization backend.

Do not validate every number against a U.S. 10-digit pattern.

---

## CT. Currency fields must identify currency

If workspace is USD: **$50.00** or **Amount (USD)**

Don’t store/display **50** without unit.

If future multi-currency is supported, currency becomes explicit.

---

## CU. Percentage fields must prevent ambiguous input

If UI says **15%**, don’t make user guess whether backend expects **15** or **0.15**.

UI accepts real-world representation and transforms internally.

---

## CV. URL fields should accept normal user input where feasible

If someone enters `example.com`, system may reasonably normalize `https://example.com` rather than forcing protocol where safe/appropriate.

But show canonical value and validate securely.

---

## CW. Confirmation dialogs should repeat the critical value

**Example:** Refund $250.00 to Anthony Johnson? — not Are you sure?

The user should verify the actual consequence.

---

## CX. Dangerous text confirmation should be rare

Requiring **type DELETE** may be appropriate for catastrophic irreversible actions.

It is not appropriate for deleting one harmless draft or canceling a normal modal.

Do not turn friction into a design personality.

---

## CY. Data-changing forms should offer a correction opportunity

WCAG 3.3.4 explicitly allows compliance through reversibility, checking, or confirmation for applicable submissions.

For critical Transovo changes, choose appropriate safeguards.

---

## CZ. Forms must survive zoom/reflow

At high zoom/mobile widths: labels remain associated, controls don’t overlap, helper/error text remains visible, action buttons reachable, two-column layouts stack, no critical horizontal clipping.

This is part of WCAG 2.2 conformance overall.

---

## DA. Error text must satisfy contrast rules too

Do not use pale red on white that fails contrast. Error text is still text. Accessible color rules apply.

---

## DB. Error meaning cannot rely only on red

Use text, perhaps icon, semantic association. Red reinforces. It does not carry meaning alone.

---

## DC. Focus indicators around inputs must remain visible even with error styling

If invalid field has red border and focus also uses border, make both states distinguishable.

Focus cannot disappear just because an error is active.

---

## DD. Autocomplete must not interfere with password managers/browser autofill

Do not use fake autocomplete fields that break user agents unless unavoidable. Use standardized native attributes.

The HTML standard provides the autocomplete model.

---

## DE. Browser validation messages should not be the only error system for complex business rules

Native constraint validation is useful. But for Transovo — scheduling conflicts, A2P eligibility, calendar permissions, payment rules — need application-level explanation.

Use native behavior where it helps, then add domain-specific validation.

---

## DF. Do not prevent copy/paste into ordinary fields

Allow email copy/paste, phone paste, IDs where appropriate, password managers.

Blocking paste often hurts usability and accessibility more than it helps.

---

## DG. Maintain undo/correction for destructive form changes where practical

If a configuration field clears significant dependent data, warn or allow recovery.

**Example:** Changing scheduling method from **Collective** to **One host** might remove multiple required hosts. The UI should explain that before destructive conversion.

---

## DH. Changing a parent field must not silently invalidate child fields

**Example:** Change timezone — if appointment times will shift, explain.

Change payment provider — if active booking types depend on it, warn.

Dependencies need visible handling.

---

## DI. Imported-data eligibility controls must explain why they are unavailable

**Example — Imported appointment:**

```
SMS reminders
Unavailable
Business texting registration required.
[Set up texting]
```

Not merely disabled checkbox.

---

## DJ. Form controls must reflect actual runtime capability

**Hard rule for Cursor:** Never ship a visible toggle, select, or input that does not affect runtime.

If **Stop sequence after reply** exists in UI, the reminder engine must actually honor it.

If backend does not support it: do not expose it, or mark it intentionally unavailable.

**No decorative/fake settings.**

---

## DK. Persisted values and displayed values must remain synchronized

After Save/reload, the UI must reflect the stored state.

If toggle shows **On** while backend value is Off, the form is broken even if both independently “work.”

---

## DL. Inherited/default values must be visually distinct from explicit overrides

**Example:**

```
Reminder sequence
Standard reminders
Using calendar default
```

versus:

```
Reminder sequence
Custom sequence
Overridden for this appointment
```

The user must understand whether they are editing default, inherited value, or explicit override.

---

## DM. “Reset to default” must explain what happens

**Reset to calendar default** is much clearer than **Reset.**

After reset, inherited value should be shown.

---

## DN. Form defaults must not create hidden side effects

**Example:** Default **Notify customer by SMS** should not silently apply when customer lacks eligibility.

Business/default rules still need runtime eligibility checks.

---

## DO. Save scope must be explicit on nested settings

If user edits **Calendar reminder defaults**, button should not imply it modifies all existing appointments unless it actually does.

If behavior affects only future appointments, say so where relevant.

---

## DP. Existing-object changes need migration-impact clarity

**Example:** Change booking duration from 30 → 60.

Does it change future existing appointments? only new bookings? affect public availability immediately?

The form should communicate scope before save where impact matters.

---

## DQ. Forms should show current state before asking for change

Don’t make a user infer current settings from blank controls.

Editing screen must load stored value, inherited default, actual provider state if relevant.

**Editing starts from reality.**

---

## DR. Forms should not silently replace unknown current values with defaults

If backend data fails to load, don’t render **SMS reminders: Off** because Off is the default.

Show: **Unable to load current setting.**

Otherwise saving may accidentally overwrite actual state.

---

## DS. Loading state must be distinguishable from empty/default state

Especially for settings. **Loading ≠ No value.**

Use skeleton/disabled placeholder until authoritative state is known.

---

## DT. Form serialization must not submit stale hidden state accidentally

When conditional fields disappear, ensure backend payload reflects intended state.

Don’t submit old values merely because component state retained them.

---

## DU. Server remains authoritative

After save, use authoritative server response to reconcile UI where relevant.

Do not assume the local value is accepted if backend normalized/rejected/changed it.

---

## DV. Validation rules must be shared or synchronized across client/server

Avoid: Frontend says max 50 seats. Backend says max 25.

One canonical constraint source or synchronized definition should exist.

User should not pass client validation then fail mysteriously server-side.

---

## DW. Validation should distinguish warning from blocking error

| Type | Example |
|------|---------|
| **Warning** | You’re scheduling outside normal business hours. |
| **Blocking error** | End time is before start time. |

Do not make everything red/blocking.

---

## DX. Warnings must state whether user can proceed

**Example:** This time is outside your usual business hours. You can still create the appointment. — Clear.

**Not:** Warning: unusual time.

---

## DY. Confirmation/review page must reflect exact final submission data

No stale summaries. If user changes Step 2 and goes to Review, Review must show updated Step 2 values.

Review is only useful if authoritative.

---

## DZ. Forms must be testable without mouse

Every form flow must pass keyboard QA:

- reach every field
- operate all choices
- open date/select/combobox controls
- see errors
- correct errors
- submit
- recover

This overlaps with Guide #4 and remains mandatory.

---

## EA. Screen-reader field names and descriptions must be QA’d for critical forms

Especially: onboarding, booking, appointment creation, A2P registration, payment, security, team permissions.

Label text alone is not enough if helper/error relationships are broken.

---

## EB. Public booking forms must be especially low-friction

Customer-facing booking forms should not expose admin complexity.

Only ask for data required to schedule, contact, comply, complete payment if applicable.

Do not force customers to understand calendar source, workflow, integration, or host configuration.

---

## EC. Staff forms may be more efficient than customer forms

Manual appointment creation is used repeatedly. Optimize for speed: contact autocomplete, prefilled booking type defaults, keyboard efficiency, direct date/time selection, fewer explanatory paragraphs.

Same data domain, different context.

---

## ED. Forms must use actual validation rules, not placeholder assumptions

Cursor must inspect backend/database/provider constraints before changing form behavior.

Do not invent min/max, required state, or enum choices because they “seem right.”

**UI rules must correspond to real product rules.**

---

## Transovo Forms / Input / Validation Acceptance Checklist

Every applicable form should pass:

- [ ] Every editable control has a persistent visible label
- [ ] Labels are programmatically associated
- [ ] Required/optional treatment is consistent
- [ ] Instructions appear before they are needed
- [ ] Essential instructions are not hidden only in tooltips
- [ ] Correct native input types are used
- [ ] Appropriate autocomplete tokens are used
- [ ] Previously entered data is reused rather than redundantly requested
- [ ] Values survive Back/Next navigation
- [ ] Validation failures preserve valid input
- [ ] Fields are ordered according to user task
- [ ] Related fields are grouped semantically
- [ ] Fieldset/legend used where appropriate
- [ ] Radio/checkbox/switch/select semantics match the choice
- [ ] Large option sets use accessible search/combobox behavior
- [ ] Date/time/timezone inputs are unambiguous
- [ ] Units are visible for numeric values
- [ ] Structured input is used where it prevents invalid values
- [ ] Client validation handles obvious local errors
- [ ] Server validation remains authoritative
- [ ] Client/server validation rules do not conflict
- [ ] Every detected error is described in text
- [ ] Field-level error appears near affected control
- [ ] Known correction suggestions are supplied where appropriate
- [ ] Complex forms provide an error summary where useful
- [ ] Error correction does not erase unrelated values
- [ ] Cross-field errors explain the relationship
- [ ] System/provider failures are not misrepresented as field errors
- [ ] Serious legal/financial/data changes are reversible, checked, or confirmed as appropriate
- [ ] Destructive action explains its scope
- [ ] Consent controls are not preselected when affirmative action is required
- [ ] Consent language is adjacent to the control
- [ ] Distinct consent purposes are not conflated
- [ ] Conditional fields only appear when relevant
- [ ] Hidden fields do not block validation
- [ ] Hidden stale values do not create unintended runtime behavior
- [ ] Read-only and disabled controls are used intentionally
- [ ] Primary action label describes the result
- [ ] Save/autosave behavior is consistent and visible
- [ ] Unsaved changes are protected
- [ ] Wizards show progress and preserve state
- [ ] Network failure preserves form work
- [ ] Duplicate submission is prevented
- [ ] Loading/default/empty states are distinguishable
- [ ] Inherited/default values are visibly distinguishable from overrides
- [ ] Reset-to-default behavior is explicit
- [ ] Save scope is clear
- [ ] Visible controls correspond to actual runtime behavior
- [ ] Stored/server state and displayed state remain synchronized
- [ ] Form works at zoom/reflow/mobile widths
- [ ] Form can be completed using keyboard only
- [ ] Critical forms receive assistive-technology QA

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md              → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md     → ISO 9241 HCD
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md             → IA & navigation
Guide #4  TRANSOVO-INTERACTION-KEYBOARD-FOCUS-STANDARDS.md → Interaction, keyboard & focus
Guide #5  TRANSOVO-FORMS-INPUT-VALIDATION-STANDARDS.md    → Forms & validation (this file)
Guide #6  TRANSOVO-RESPONSIVE-REFLOW-ZOOM-STANDARDS.md    → Responsive/reflow/zoom
Guide #7  TRANSOVO-TABLE-GRID-SEMANTICS-STANDARDS.md     → Tables & grids
Guide #8  TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md → Privacy/consent/compliance
Guide #9  TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md   → Security & authentication
Guide #10 TRANSOVO-DATE-TIME-TIMEZONE-LOCALE-STANDARDS.md → Date/time/timezone/locale
Guide #11 TRANSOVO-INTERNATIONALIZATION-LOCALIZATION-STANDARDS.md → Internationalization & localization
TRANSOVO-UI-DESIGN-GUIDE.md                               → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                       → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                           → Visual tokens
```

---

*Guide #5: Forms, Input & Validation Standards. Next: Guide #8 — `docs/TRANSOVO-PRIVACY-CONSENT-COMPLIANCE-STANDARDS.md` · Guide #9 — `docs/TRANSOVO-SECURITY-AUTHENTICATION-STANDARDS.md`.*
