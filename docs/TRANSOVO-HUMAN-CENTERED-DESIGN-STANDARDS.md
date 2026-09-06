# Transovo Human-Centered Design & Usability Standards Guide

**Series:** Implementation standards · **Guide #2 of 12**  
**Status:** Active — mandatory standard for feature conception, organization, simplification, evaluation, and refinement  
**Audience:** Engineers, designers, product owners, and Cursor agents building Transovo  
**Not:** A visual-style guide (see `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`)

---

## Master Cursor rule

> **Transovo follows ISO 9241 human-centered design and usability principles.** Every significant feature must be designed from an **explicit understanding of the user, goal, task, and context of use**. Usability is judged by **effectiveness, efficiency, and satisfaction**—not by visual appearance or technical reachability alone. Follow an iterative process of **understanding context → defining user requirements → producing design solutions → evaluating those solutions**. Interfaces must be suitable for the task, self-descriptive, conform to user expectations, learnable, controllable, error-tolerant, and appropriately adaptable. Minimize unnecessary steps and cognitive load, preserve user context and work, use strong defaults, progressively disclose complexity, and **evaluate complete realistic workflows** rather than isolated screens.

**A feature that is technically reachable but hard to complete correctly is not usable.**

---

## Primary authorities

| Standard | Focus |
|----------|--------|
| **ISO 9241-210:2019** | Human-centred design for interactive systems (confirmed 2025) |
| **ISO 9241-11:2018** | Usability: definitions and concepts (effectiveness, efficiency, satisfaction) |
| **ISO 9241-110** | Interaction principles (suitability for task, self-descriptiveness, etc.) |
| **NIST Human-Centered Design guidance** | Summarizes ISO HCD principles and activities |

**Governing definition:** A system is usable when **specified users** achieve **specified goals** **effectively, efficiently, and satisfactorily** in the **actual context of use**—not because it looks clean.

**Related Transovo guides**

- Guide #1: `docs/TRANSOVO-ACCESSIBILITY-STANDARDS.md`  
- IA: `docs/TRANSOVO-UI-DESIGN-GUIDE.md`  
- Page structure: `docs/TRANSOVO-PAGE-ARCHITECTURE-RULES.md`  
- Visual design: `docs/TRANSOVO-VISUAL-DESIGN-GUIDE.md`  
- Guide #3: `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md`
- **Next:** Guide #4 — Interaction, Keyboard & Focus Standards (coming)

---

## A. Usability has three mandatory dimensions (ISO 9241-11)

| Dimension | Question |
|-----------|----------|
| **Effectiveness** | Can users complete the intended task accurately and completely? |
| **Efficiency** | How much effort, time, and resources does it take? |
| **Satisfaction** | Does interaction meet physical, cognitive, and emotional needs? |

**Cursor rule:** Never evaluate UI solely by whether a feature is technically reachable.

For Transovo, ask on every flow:

- Did they find it?  
- Did they understand it?  
- Did they configure it correctly?  
- How many steps?  
- Did they know whether it worked?  
- Could they recover if something went wrong?

“A user eventually figured out reminders” is **not** enough.

---

## B. Design from explicit understanding of users

Do not design for “the average user.” Identify actual user types.

**Transovo examples:**

- Solo business owner  
- Receptionist / front-desk staff  
- Scheduler  
- Office manager  
- Provider / staff member  
- Team administrator  
- Owner reviewing analytics  

Each differs in: permissions, frequency, expertise, goals, urgency, device, environment.

**Cursor rule:** Before designing or restructuring a feature, state **primary user**, **primary task**, and **context of use**.

---

## C. Design around user goals, not software capabilities

| Bad (capability) | Better (goal) |
|------------------|---------------|
| Expose calendar-import rules | Let the office control which imported appointments receive reminders |
| Surface workflow nodes | Let the business automatically follow up when a customer no-shows |

User goal is primary; implementation is secondary.

---

## D. Context of use is part of usability

Context includes: desktop at office, phone away from desk, busy receptionist on a call, owner at night, weak network, high appointment volume, multiple calendars.

**Cursor rule:** Optimize for **realistic conditions**, not ideal mockup conditions.

---

## E. Users involved throughout design and development

User evaluation is not a final QA step. Understand behavior → validate terminology → test hierarchy → test prototypes → observe tasks → refine → retest.

**Cursor rule:** Code/design assumptions are **hypotheses** until validated against realistic user tasks.

---

## F. Evaluation drives design

```
Understand → Design → Evaluate → Fix → Evaluate again
```

Not: build everything → launch → hope.

Especially for: navigation, booking, calendar config, reminders, A2P onboarding, AI booking, workflow builder.

---

## G. Human-centered design is iterative

Do not treat the first implementation as final. Preserve architecture so experience can refine **without rebuilding business logic**. Avoid coupling logic to one temporary UI layout.

---

## H. Consider the whole user experience

Evaluate **complete journeys**, not isolated screens.

**Microsoft connection** includes: why connect, choose calendars, success, sync status, token refresh, degraded state, recovery, disconnect, availability effects.

**SMS registration** includes: learn why → submit → status → wait → approval/failure → send SMS.

---

## I. Multidisciplinary perspectives

Check features against: product logic, UX, accessibility, engineering, compliance, security, content, data integrity.

A2P can “work” technically and still fail on language, consent framing, accessibility, status, recovery, eligibility behavior.

---

## J. Four core HCD activities (ISO / NIST)

1. **Understand and specify context of use** — Who? What goal? Under what conditions?  
2. **Specify user requirements** — What must the user achieve? (not technical reqs yet)  
3. **Produce design solutions** — Interaction, page, flow  
4. **Evaluate the design** — Does it satisfy user requirements?

Follow this sequence before substantial redesign.

---

## K. Every feature needs an explicit user requirement

**Not enough:** Feature: appointment waitlist.

**Better:** A scheduler must see customers waiting for an opening, offer a newly available slot, and know whether it was accepted without cross-referencing multiple screens.

**Better:** A business must determine why an appointment did not receive an SMS reminder without contacting support.

Requirements must be **testable**.

---

## L. Suitability for the task (ISO 9241-110)

Support the task without unnecessary operations or irrelevant information.

Manual appointment creation should not require: Booking → configure type → Contacts → Calendar Settings → return—if the user only needs customer + type + date/time + save.

**Cursor rule:** Remove steps, fields, navigation, and information that do not materially contribute to the **current task**.

---

## M. Self-descriptiveness

At any point, the interface should make apparent: what is happening, what can be done, what controls mean, what the result will be.

| Bad | Better |
|-----|--------|
| Advanced | Advanced reminder timing |
| Status: Pending | Registration submitted — carrier review pending |

**Cursor rule:** Normal state and actions should not require documentation.

---

## N. Conformity with user expectations

Behave according to known conventions:

- Row click opens object  
- Save persists; Cancel doesn’t save  
- Trash = delete; Search searches  
- Tabs = peer views; Back = previous context  
- Checkbox = independent boolean  

Do not invent novel interactions without strong reason.

---

## O. Preserve terminology users understand

Use: appointment, customer/contact, calendar, reminder, booking page, confirmation, payment.

Do not expose: orchestration, trigger processor, provider event, campaign binding, delta sync token—except in developer/diagnostic contexts.

---

## P. Suitability for learning

Help users learn naturally: predictable structure, repeated patterns, defaults, empty states, contextual explanation, progressive disclosure, consistent terminology.

Users should get **faster** with experience. Relearning every visit violates this principle.

---

## Q. Do not require unnecessary memorization

If users must remember “imported-event SMS is under Settings → Messaging → Calendar Sources…”, the system failed.

Show state directly: `SMS unavailable for this imported appointment` + `Set up business texting`.

---

## R. Controllability

Users initiate and control interactions: cancel, undo when feasible, stop AI/recording, disable workflow, reschedule vs delete/recreate, choose calendars, change reminders, exit wizards.

**Cursor rule:** Do not trap users in irreversible or system-driven flows.

---

## S. Consequential actions require appropriate control

Cancel appointment, refund, delete workflow, revoke recording, disconnect calendar, publish automation—consequences understandable **before** completion.

Proportional safeguards; not every harmless action needs a modal.

---

## T. Error tolerance

Allow intended results with minimal corrective effort: normalize phones, prevent double submit, preserve form data, undo moves, detect conflicts before save, validate reminder timing, block invalid workflow publish.

**Cursor rule:** Prevent, absorb, or cheaply correct errors—don’t punish users.

---

## U. Distinguish user error from system failure

ISO use error: mismatch among user, interface, task, environment.

**Bad:** “The user entered it wrong.”  
**Better:** “Why did the interface make this mistake easy?”

Repeated wrong calendars, SMS confusion, accidental reminder disable, incomplete workflows → likely **design issue**.

---

## V. Suitability for individualization

Support meaningful adaptation: timezone, calendar prefs, saved filters, reminder defaults, roles, staff schedules, booking-type defaults, notifications.

Not every pixel customizable—only adaptation that improves tasks.

---

## W. Defaults should work for most users

Strong defaults first; adjustment second.

Default reminder sequence works immediately; advanced users customize time, channels, stop-on-reply, weekends, per-calendar behavior.

---

## X. Minimize unnecessary cognitive load

Reduce: unnecessary choices, duplicate concepts, hidden dependencies, unexplained technical states, giant forms, long instructions, inconsistent labels.

Powerful feature ≠ complex screen by default.

---

## Y. Progressive disclosure for complexity

Booking type initially: name, duration, host, availability.

**Round robin** selected → eligible hosts, distribution.  
**Group** selected → capacity, attendee behavior.

Do not show every scheduling model at once.

---

## Z. Preserve context across related tasks

| From | Carry forward |
|------|----------------|
| Contact → Book | Contact selected |
| Appointment → Message | Recipient + appointment |
| Appointment → Payment | Customer, amount |
| Meeting recap → Follow up | Meeting, contact |

**Cursor rule:** Carry forward what the system already knows.

---

## AA. Minimize mode errors

Make modes obvious: draft vs published, read-only vs editable, test vs live, staff vs admin, platform-SMS vs business-A2P, selected calendar vs all.

User should never wonder: “Am I changing the real thing?”

---

## AB. Avoid unnecessary interruptions

No excessive modals, trivial confirmations, random banners, repeated onboarding, success dialogs for every save.

Interrupt only when attention is genuinely required.

---

## AC. Frequency should influence prominence

High-frequency (easy access): create appointment, reschedule, search contact, reply, view calendar.

Lower-frequency: SAML, org permissions, A2P, retention policy.

**Cursor rule:** Optimize prominence and interaction cost around **real task frequency**.

---

## AD. Criticality should also influence prominence

Rare but dangerous: calendar disconnected, reminders failing, payment broken—need **high visibility** despite low frequency.

Prioritize by: **frequency + importance + risk**.

---

## AE. Design for novice and experienced users

| Novice | Expert |
|--------|--------|
| Clear labels, defaults, guidance, templates | Shortcuts, bulk, clone, saved filters, keyboard, advanced config |

Don’t force power features on beginners; don’t cripple experts permanently.

---

## AF. Optimize primary workflows before edge workflows

**Create appointment → sync calendar → schedule reminder → confirmation** must be extremely strong before polishing rare enterprise settings.

---

## AG. Use measurable usability requirements

| Dimension | Examples |
|-----------|----------|
| **Effectiveness** | Completion rate, error rate, successful outcome |
| **Efficiency** | Time on task, steps, backtracking, support tickets |
| **Satisfaction** | Ease, confidence, frustration, perceived complexity |

Design should make these **measurable** (even if metrics are collected later).

---

## AH. Define success criteria before redesigning

**Task:** Create manual appointment.

**User requirement:** Staff with normal permissions creates appointment for existing/new contact, chooses type/date/time, enables reminders, saves without leaving workflow.

**Success:** Completes correctly; no unnecessary navigation; conflict before save; calendar sync visible; reminders visible after.

Better than: “Make New Appointment cleaner.”

---

## AI. Evaluate realistic complete tasks

Test scenarios, not isolated buttons:

- “Customer called—move Tuesday to Thursday; reminders update.”  
- “Why doesn’t booking offer 2 PM when Microsoft shows busy?”  
- “Imported appointment didn’t get SMS—find out why.”  
- “Create workflow to follow up after no-show.”

---

## AJ. Test navigation without finished UI

Card sort / tree test: categories, labels, expected paths—**before** polishing pages. Early evaluation is cheaper (NIST / ISO).

---

## AK. Evaluate prototypes before expensive implementation

High-value early evaluation: onboarding, appointment detail, Booking Type editor, Availability, Reminder Sequence, A2P, AI Booking, Workflow builder.

Establish flow/structure before visual polish or heavy implementation.

---

## AL. Users should always know current system state

`Microsoft — Synced 3 minutes ago`  
`SMS reminder — Scheduled for tomorrow, 9 AM`  
`Notetaker — Waiting for admission`  
`Payment — Processing`

Do not force inference.

---

## AM. Expose cause when it affects user action

| Weak | Strong |
|------|--------|
| Unavailable | Unavailable — blocked by Microsoft Work Calendar, 1:30–2:30 PM |
| SMS disabled | SMS unavailable for imported appointments until business texting registration is completed |

---

## AN. Don’t expose irrelevant implementation details

**Good:** Microsoft needs to be reconnected.  
**Bad:** `refresh_token returned AADSTS700082 from v2 token endpoint`.

Engineering details → diagnostics/logging.

---

## AO. Keep conceptual models stable

Once users learn Appointment, Booking Type, Reminder Sequence, Workflow, Meeting—do not rename across pages.

---

## AP. One object, one authoritative representation

Do not create separate user-facing entities for “booking appointment,” “calendar appointment,” “AI appointment,” “imported appointment.”

They are all **Appointments** with different **origins**.

---

## AQ. Multiple paths good; duplicate objects bad

Same appointment from Home, Calendar, Contact, Search, Meeting, Message—all paths → **same state and behavior**.

---

## AR. Do not require unnecessary setup before value

Booking-page-only user should not be forced through A2P if platform-consent SMS covers their case. Non-notetaker user should not configure notetaker in onboarding.

Respect actual goals over product completeness.

---

## AS. Reveal advanced capability at point of need

Imported appointment: `SMS unavailable` + `Register business texting…` at that moment—not lengthy A2P dump on every signup.

---

## AT. Preserve user work through system interruptions

Microsoft fail, network drop, AI timeout, payment error, validation reject—**preserve entered data** when feasible.

---

## AU. Support recovery without rework

Invalid workflow step → highlight problem, preserve rest.  
Calendar auth expired → reconnect, keep mappings.  
Payment failed → retry, don’t recreate appointment.

---

## AV. Don’t force irrelevant information

Reschedule: show current time, available slots, reminder/calendar impact—not every appointment field again.

---

## AW. Meaningful grouping around tasks

Booking Type sections: Basics, Hosts & capacity, Availability, Customer information, Reminders, Payment, Confirmation, Permissions—not database tables.

---

## AX. User-facing complexity grows with task complexity

Change time = simple. Build conditional automation = complex workspace OK.

System complexity must not leak into simple tasks.

---

## AY. Avoid redundant data entry

Prefill contact fields, booking-type duration/location. Override only when needed.

---

## AZ. Least destructive recovery path

Calendar auth lost → reconnect, don’t delete mappings.  
Workflow publish fails → keep draft, explain problem.

---

## BA. Design around interruptions and resumability

Receptionist interrupted mid-appointment; manager returns to A2P later—preserve progress or clearly state what’s saved.

---

## BB. Support verification after consequential actions

Create appointment → visible in calendar/list.  
Schedule reminder → exact time visible.  
Connect Microsoft → calendars + last sync visible.  
Payment → status on appointment.

Not toast alone.

---

## BC. Keep feedback proportional

Small: `Saved.`  
Large: `Appointment canceled. Future reminders stopped and Microsoft event updated.`

---

## BD. User choices must have predictable scope

“Default reminder sequence” must clarify: new only? existing future? all booking types? one calendar?

Scope ambiguity = usability failure.

---

## BE. Expose inheritance/override relationships clearly

Organization → calendar → booking type → appointment override.

```
Reminder sequence
Workspace default: Standard reminders
Use default / Override for this appointment
```

No silent overrides.

---

## BF. Make automation consequences understandable

Before publish: triggers, recipients, timing, scope. Preview/simulation preferred over blind publish.

---

## BG. AI must not obscure deterministic outcomes

AI Booking: user needs confidence appointment was created, time available, identity correct, calendar updated. **System state is authoritative**; AI phrasing is secondary.

---

## BH. Human fallback preserves conversation context

Don’t only say “Contact support.” Hand off with: customer, requested time, conversation, fields gathered, failure reason.

---

## BI. Evaluate satisfaction as well as completion

Registration completed but user says “I had no idea why”—effectiveness passes, satisfaction fails.

---

## BJ. Don’t optimize one user at expense of another without intent

Dense calendar helps receptionist, hurts mobile—decide priorities and provide alternatives.

---

## BK. Every major feature needs context-of-use statement

```markdown
Feature: Appointment calendar
Primary users: receptionist, owner/operator, scheduler
Primary goals: see schedule, find/create/reschedule/cancel, identify exceptions
Context: frequent daily desktop, occasional mobile, moderate/high volume
```

---

## BL. Every major feature needs usability requirements

```markdown
Feature: Reminder diagnostics
User requirements:
- determine whether reminder is scheduled
- see exact send time and delivery state
- see why suppressed/failed
- understand corrective action
```

---

## BM. Evaluate against realistic data volume

Test: 2 vs 200 appointments, long names, multiple recipients, many calendars/workflows, large transcripts.

---

## BN. Evaluate novice and repeat use separately

First-time: can they understand? Repeat: can they do it quickly? Onboarding vs shortcuts.

---

## BO. Qualitative and quantitative evaluation

Observe confusion and terminology; measure completion, time, errors, abandonment, backtracking.

---

## BP. Preference alone is not usability evidence

“I like this screen” ≠ usable. Observe findability, completion, errors, time, outcome understanding.

---

## BQ. Design changes trace to user need

Every move/hide/modal needs reason tied to: user goal, context, frequency, errors, efficiency, learnability, clarity—not merely “looks cleaner.”

---

## BR. Document the design process for major redesigns

1. User/task/context  
2. User requirements  
3. Proposed structure  
4. Design solution  
5. Evaluation  
6. Findings  
7. Changes  

---

## BS. HCD applies throughout the lifecycle

New features, redesigns, integrations, bug fixes affecting workflows, mobile, enterprise—all subject to these rules (ISO 9241-210).

---

## BT. Implementation success ≠ UX success

**Hard Cursor rule:**

| Can be true | And still fail |
|-------------|----------------|
| API works | Unusable |
| Database writes | Confusing |
| UI renders | Inefficient |

Feature certification and usability certification are **different layers**.

---

## Transovo Human-Centered Design acceptance checklist

For each significant page/flow:

- [ ] Primary user(s) identified  
- [ ] Primary user goal identified  
- [ ] Context of use documented  
- [ ] User requirement stated in outcome terms  
- [ ] Primary task can be completed correctly  
- [ ] Unnecessary steps removed  
- [ ] Unnecessary information removed  
- [ ] Terminology matches user expectations  
- [ ] Current state is understandable  
- [ ] Controls are self-descriptive  
- [ ] Common behavior follows familiar conventions  
- [ ] First-time use is learnable  
- [ ] Repeat use is efficient  
- [ ] User retains appropriate control  
- [ ] Consequential actions are understandable  
- [ ] Errors prevented where possible  
- [ ] Errors recoverable with low effort  
- [ ] User work preserved after failure where feasible  
- [ ] Defaults support common use  
- [ ] Advanced complexity progressively disclosed  
- [ ] Related context carried forward automatically  
- [ ] Settings clearly communicate scope  
- [ ] Default/inheritance/override behavior clear  
- [ ] Important asynchronous state visible  
- [ ] Critical causes explained at user level  
- [ ] Primary workflow tested with realistic scenarios  
- [ ] Realistic data volumes considered  
- [ ] Novice and repeat use considered  
- [ ] Whole journey evaluated, not isolated screen  
- [ ] Design iterable without rebuilding business logic  

---

## Feature worksheet (use before major UX work)

```markdown
### Feature: [Name]

**Context of use**
- Primary users:
- Primary goals:
- Context (device, frequency, volume, interruptions):

**User requirements** (outcome terms, testable)
1.
2.

**Success criteria** (effectiveness / efficiency / satisfaction)
-

**Primary workflow steps** (minimum necessary)
-

**Whole journey** (including setup, failure, recovery)
-

**Defaults**
-

**Progressive disclosure** (what’s hidden until needed)
-

**Inheritance / override** (org → type → appointment)
-

**Evaluation scenarios** (realistic tasks to test)
1.
```

---

## Implementation standards stack

```
Guide #1  TRANSOVO-ACCESSIBILITY-STANDARDS.md        → WCAG 2.2 AA
Guide #2  TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS.md → ISO 9241 HCD (this file)
Guide #3  TRANSOVO-IA-NAVIGATION-STANDARDS.md         → IA & navigation
Guide #4+ (coming)                                    → Interaction, keyboard & focus
TRANSOVO-UI-DESIGN-GUIDE.md                           → IA principles
TRANSOVO-PAGE-ARCHITECTURE-RULES.md                   → Page structure
TRANSOVO-VISUAL-DESIGN-GUIDE.md                       → Visual tokens
```

---

*Guide #2: Human-Centered Design & Usability Standards. Next: Guide #3 — `docs/TRANSOVO-IA-NAVIGATION-STANDARDS.md` · Guide #4 — Interaction, Keyboard & Focus Standards.*
