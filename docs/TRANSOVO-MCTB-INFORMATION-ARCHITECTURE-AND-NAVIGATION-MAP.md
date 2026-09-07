# Transovo MCTB Information Architecture & Navigation Map

**Status:** Active — mandatory architectural reference for all MCTB navigation, routing, page placement, and feature discoverability  
**Audience:** Engineers, product owners, designers, and Cursor agents working on MCTB  
**Product:** Transovo Missed Call Text Back  
**Role:** Defines the canonical MCTB navigation structure, page hierarchy, object relationships, route ownership, and placement of operational vs setup/configuration features

**Cursor rule:** `.cursor/rules/transovo-mctb-ia-navigation.mdc` (`alwaysApply: true`)

---

## Master Cursor rule

Missed Call Text Back must use one coherent, task-based information architecture centered on the recurring workflow **Missed Call → Conversation → Follow-up → Recovery**. Operational work must be more prominent than setup/configuration. Every feature has one canonical home and one canonical user-facing name. Multiple contextual entry points may reach the same underlying object, but no page may create a duplicate management surface or duplicate business object. Existing legacy routes, voice pages, setup pages, and screenshots are inventory only; they do not define the final architecture. The final MCTB IA must inherit the global Transovo shell, navigation behavior, terminology rules, accessibility requirements, responsive behavior, and shared component system while using MCTB-specific destinations appropriate to the missed-call recovery job.

---

## 1. MCTB mental model

The user should be able to understand the product in this order:

- Overview
- Missed Calls
- Conversations
- Analytics
- Setup

Conceptually:

```
Something happened
    ↓
Who called?
    ↓
Did we text them?
    ↓
Did they reply?
    ↓
Do I need to follow up?
    ↓
Is the system configured correctly?
```

That is the core architecture.

---

## 2. Primary navigation structure

The default MCTB product navigation should be:

- Overview
- Missed Calls
- Conversations
- Analytics
- **SETUP** — Phone setup, Messaging, Schedule
- **SUPPORTING / ADMIN** — Compliance, Settings

However, not every item above must necessarily appear as an equal top-level sidebar item.

The final UI should favor a small operational navigation, with lower-frequency setup grouped beneath it.

**Recommended structure:**

- Overview
- Missed Calls
- Conversations
- Analytics
- **SETUP** → Setup

Then Setup contains local sections/pages for:

- Phone & forwarding
- Messaging sender
- Consent
- Schedule
- Voicemail where applicable
- Exclusions
- Test & readiness
- Compliance

This is likely cleaner than putting nine setup destinations directly into the main sidebar.

---

## 3. Canonical global placement inside Transovo

MCTB should appear as its own product workspace inside the overall Transovo product system.

- Do not force MCTB under Appointments.
- Do not bury it under Messages.
- Do not make it a subsection of generic Voice.

The exact product-switching mechanism may depend on the existing Transovo shell, but the user should understand they are in **Missed Call Text Back** and then see the MCTB local destinations.

---

## 4. MCTB operational vs configuration hierarchy

### Operational destinations

These are recurring daily-work surfaces:

- Overview
- Missed Calls
- Conversations
- Analytics

### Configuration/setup destinations

These are lower-frequency:

- Phone & forwarding
- Consent
- Messaging sender
- Schedule
- Voicemail
- Exclusions
- Test
- Compliance
- MCTB settings

**Hard rule:** Configuration must not visually dominate daily operational work.

---

## 5. Overview

### Canonical purpose

Overview answers:

- What happened today?
- Is anything waiting for me?
- Is MCTB healthy?
- What should I do next?

### Allowed content

- Missed calls today
- Text-backs sent
- Replies today
- Unread/unanswered conversations
- Needs-attention items
- Simple recovery KPI
- System blocker if one exists
- Recent activity
- Links to Missed Calls / Conversations / Setup

### Not allowed

- Full missed-call table duplicating Missed Calls
- Full conversation inbox duplicating Conversations
- Full analytics report duplicating Analytics
- Full setup editor duplicating Setup

Overview summarizes and routes.

---

## 6. Missed Calls

### Canonical route/domain

Missed Calls is the authoritative list of missed-call events.

This page should answer:

- Who called?
- Which business line did they call?
- When?
- Was text-back sent?
- Did they consent?
- Did they reply?
- Is follow-up needed?
- What is the current state?

### Canonical substructure

```
Missed Calls → Missed Call Detail
```

**Potential URL structure:**

- `/mctb/missed-calls`
- `/mctb/missed-calls/:id`

If legacy `/voice/missed-calls` remains for compatibility, it should redirect or render the canonical surface.

---

## 7. Missed Call Detail

This is the authoritative view for one missed-call event.

It should include:

- Caller identity
- Caller number
- Public business number called
- Time
- Trigger/disposition
- Consent mode/result
- Text-back state
- Conversation relationship
- Callback/follow-up state
- Timeline/history
- Relevant voicemail
- Relevant links/forms
- Eligibility/suppression reason where needed

**Contextual actions may include:**

- Open conversation
- Call customer
- Create/open contact
- Mark follow-up state
- View consent evidence
- View voicemail

Do not duplicate the full Conversations thread editor here unless shown as a compact preview.

---

## 8. Conversations

### Canonical purpose

Conversations is the authoritative management surface for the SMS threads created through MCTB.

It should answer:

- Who replied?
- What did they say?
- Which conversations need a response?
- Which conversation belongs to which missed call?
- Has someone followed up?

**Potential URL:**

- `/mctb/conversations`
- `/mctb/conversations/:id`

If Transovo already has a canonical cross-product Conversations engine, MCTB should use it with MCTB filters/context rather than create a second SMS engine.

---

## 9. Conversation Detail / Thread

A conversation detail should contain:

- Caller/contact identity
- Linked missed call
- Message history
- Compliance/system messages
- Customer messages
- Business replies
- Delivery/suppression state
- Opt-out state
- Assignment/follow-up if supported
- Callback action

Conversation detail is about **communication**.

Missed-call detail is about the **event that triggered recovery**.

These should cross-link, not become duplicate pages.

---

## 10. Analytics

### Canonical purpose

Analytics measures MCTB outcomes.

**Recommended route:** `/mctb/analytics`

**Core categories:**

- Missed calls
- Text-backs sent
- Send rate
- Replies
- Reply rate
- Conversations
- Delivery rate
- Suppressed
- Delivery failures
- Opt-outs
- Voicemails
- Link clicks
- Recovery metric if formally defined

The analytics page should use one canonical definition for each metric. No mock analytics.

---

## 11. Setup

The current MCTB setup area is the largest configuration surface.

Instead of scattering everything across many main-nav destinations, treat **Setup** as the canonical configuration workspace.

**Potential route:** `/mctb/setup`

**Local navigation inside Setup can include:**

- Phone
- Messaging
- Consent
- Schedule
- Voicemail
- Exclusions
- Test

This can be tabs, section navigation, or appropriately structured page navigation depending on complexity.

---

## 12. Phone & Forwarding

**Canonical purpose:**

- identify business line
- show Transovo forwarding destination
- configure carrier forwarding
- verify forwarding
- manage MCTB phone-number role distinctions

**Possible route:**

- `/mctb/setup/phone`
- or as a section within `/mctb/setup#phone`

Do not make Numbers a major daily MCTB destination unless the user actually manages multiple meaningful numbers frequently.

---

## 13. Number-role architecture

The UI must distinguish:

| Role | Description |
|------|-------------|
| **Business line** | The public number customers call |
| **Forwarding ingress** | The hidden Transovo toll-free number receiving conditional-forwarded voice |
| **Messaging sender** | The number used for SMS |

These must not be collapsed into one page label called **Your number**.

**Recommended labels:**

- Business line
- Forwarding destination
- Text-back sender

---

## 14. Messaging setup

**Canonical purpose:**

- choose/see sender
- configure first conversational message
- show sender readiness
- configure public request link/form if applicable
- show business identity used in messages

**Potential route:** `/mctb/setup/messaging`

This page is not a generic SMS campaign builder.

---

## 15. Consent setup

**Canonical purpose:**

- select consent mode
- configure Press-1 prompt
- show existing-consent attestation state
- explain what each mode does
- link to evidence/compliance where useful

**Potential route:** `/mctb/setup/consent`

Consent modes are configuration choices. Do not create separate permanent nav items: **Press 1**, **Existing Consent**.

---

## 16. Press-1 configuration

Within Consent:

- spoken script
- voice/audio configuration
- preview
- generation
- publish
- selected number
- status
- test

The Press-1 editor should not look like a generic AI voice-agent builder. It is a narrowly scoped MCTB consent prompt.

---

## 17. Existing-consent configuration

Within Consent:

- explanation
- business attestation
- current state
- implications
- compliance link

Do not show Press-1-specific controls when this mode is active. Conditional UI should remain conditional.

---

## 18. Schedule

**Canonical purpose:** Control when MCTB behavior is active and/or which message variant applies.

**Potential route:** `/mctb/setup/schedule` or local setup page.

**Relevant settings may include:**

- Always on
- Business hours
- After hours
- Custom weekly schedule
- Temporary pause
- Resume

Do not duplicate the Appointment scheduling engine unnecessarily.

---

## 19. Pause state

Pause is a **state** of the MCTB product, not a top-level page.

It should be visible in Overview, Setup, and Schedule when relevant.

It should not become a permanent navigation destination.

---

## 20. Voicemail

Voicemail should only have its own primary local page if it is a meaningful recurring workspace.

- If voicemail is mostly configuration: **Setup → Voicemail**
- If customers actively review voicemail messages/transcripts daily: **Voicemail** can be a peer operational destination

The architecture decision depends on actual V1 feature behavior.

Do not automatically preserve a legacy top-level Voicemail nav item merely because it exists today.

---

## 21. Visual voicemail placement

If visual voicemail is a recurring inbox:

```
Missed Calls | Conversations | Voicemail
```

may be appropriate.

If it is rare/optional:

- surface voicemail in Missed Call Detail
- allow a filtered Voicemail view
- avoid permanent navigation clutter

---

## 22. Compliance

Compliance is important but lower-frequency.

**Recommended placement:**

- Setup → Compliance
- or Settings → Business texting

depending on whether it becomes shared across products.

MCTB should not create a completely separate compliance universe if Transovo already has canonical business-texting compliance.

---

## 23. Business texting architecture

If business texting registration affects multiple Transovo products, its canonical home should be product-wide:

**Settings → Messaging / Business texting**

MCTB can link there contextually.

If it is MCTB-only today, Setup may expose it directly.

But avoid two independent registration systems.

---

## 24. Consent Log

The current Consent Log is useful, but it should be evaluated as an audit/support view, not automatically a main navigation item.

**Possible placements:**

- Setup → Compliance → Consent history
- Missed Call Detail → View consent evidence
- plus a searchable audit page if operations genuinely require it

**Default recommendation:** Do not put Consent Log in the primary daily navigation unless user research shows frequent need.

---

## 25. Consent evidence route

**Possible route:**

- `/mctb/compliance/consent`
- or shared `/compliance/consent`

The page can still exist and be searchable even if not prominently in the sidebar.

**Presence of a route does not require a top-level nav link.**

---

## 26. Try It / Demo

Try It is a setup/testing tool. It is not an operational destination.

**Recommended placement:**

- Setup → Test
- or a prominent setup action: **Test MCTB**

Do not keep a permanent top-level Try It nav after the product is live unless it remains genuinely useful.

---

## 27. Test setup

Test should support:

- choose consent mode
- know which number to call
- start test
- see live step progress
- verify call
- verify Press-1 where applicable
- verify SMS
- verify conversation/reply
- move to production setup

**Potential route:** `/mctb/setup/test`

---

## 28. Onboarding

Onboarding is temporary process navigation. It should not mirror the permanent product architecture.

**Potential route:**

- `/onboarding/mctb`
- or `/mctb/onboarding`

Onboarding can have steps such as: Business, Consent, Demo, Number, Message, Verification, Connect line, Live test, Complete.

These steps disappear after onboarding. They are not sidebar destinations.

---

## 29. Onboarding must land in canonical product pages

After completion, **Go to MCTB** should land on Overview or the most meaningful daily workspace.

Onboarding must not create special duplicate setup objects separate from real MCTB configuration.

---

## 30. Needs Attention

Needs Attention should normally be a **queue/state**, not a permanent top-level domain.

**Best placements:**

- Overview panel
- Missed Calls filter
- Conversations filter

**Potential filtered URL:**

- `/mctb/missed-calls?filter=needs-attention`
- `/mctb/conversations?filter=needs-attention`

Do not create a separate duplicate inbox if the underlying objects already live elsewhere.

---

## 31. Filters are not navigation domains

Examples: Today, Replied, Not replied, Suppressed, Needs attention, After hours.

These are filters/views inside Missed Calls or Conversations.

Do not turn them into persistent sidebar items.

---

## 32. Numbers page

If users need a numbers management page, determine whether it belongs to:

- **Settings → Phone numbers**
- or **MCTB Setup → Phone**

Do not create both unless they serve genuinely different scopes.

**Example:**

- Product-wide Numbers = all owned/sender numbers
- MCTB Phone Setup = assigns/uses those numbers for MCTB

That distinction is acceptable.

---

## 33. Buy number

Purchasing a number is an action/process, not a permanent product destination.

**Potential flow:**

- Setup → Messaging sender → Add number
- or Settings → Numbers → Add number

Do not promote `/numbers/buy` into the main nav.

---

## 34. Public request form

The public MCTB request form is a customer-facing surface.

**Potential route:** `/f/mctb/:token`

It must not inherit admin navigation. It should have a simple public/customer IA.

Its canonical admin configuration belongs under **Setup → Messaging / Links**.

---

## 35. Public form is subordinate to MCTB

The request form is not its own product. It exists to support recovery after a missed call.

Do not create a Forms product architecture around it.

---

## 36. Reports

If MCTB-specific reporting is already fully covered by Analytics, do not create a redundant MCTB Reports page.

A cross-product Transovo Reports area may include MCTB metrics.

**Recommended relationship:**

- MCTB Analytics → detailed product analytics
- Transovo Reports → cross-product summary

No duplicated report builder.

---

## 37. Admin/customer support pages

Routes such as `/admin/customers/:id` may show MCTB operational/support state.

These are admin/support surfaces, not product navigation.

Do not let admin architecture influence customer-facing MCTB IA.

---

## 38. Legacy Voice route cleanup

Legacy routes may include:

- `/voice/missed-calls`
- `/voice/setup`
- `/voice/schedule`
- `/voice/try-it`
- `/voice/voicemail`
- `/voice/consent-log`
- `/voice/analytics`

These can remain as redirects during migration.

Final canonical URLs should ideally stop exposing the obsolete broad Voice architecture if MCTB is now its own product.

**Recommended canonical prefix:** `/mctb`

**Example:**

- `/mctb`
- `/mctb/missed-calls`
- `/mctb/missed-calls/:id`
- `/mctb/conversations`
- `/mctb/analytics`
- `/mctb/setup`

---

## 39. Legacy agent routes

Routes such as `/agents/john`, `/voice/receptionist` must not remain conceptual MCTB destinations.

Redirect if needed. Do not preserve old agent terminology in MCTB navigation.

---

## 40. Canonical recommended MCTB route map

**Recommended target map:**

```
/mctb                          Overview
/mctb/missed-calls
/mctb/missed-calls/:id
/mctb/conversations
/mctb/conversations/:id
/mctb/analytics
/mctb/setup
/mctb/setup/phone
/mctb/setup/messaging
/mctb/setup/consent
/mctb/setup/schedule
/mctb/setup/voicemail
/mctb/setup/exclusions
/mctb/setup/test
/mctb/compliance
/mctb/compliance/consent
```

The exact choice between separate setup routes and one anchored setup page should be decided during page-architecture mapping based on complexity.

---

## 41. Minimal sidebar recommendation

**Default recommendation:**

```
OVERVIEW
  Overview
WORK
  Missed Calls
  Conversations
INSIGHTS
  Analytics
CONFIGURE
  Setup
```

**Optional:** Voicemail — only if voicemail proves to be a recurring inbox.

This is deliberately smaller than the current legacy Voice navigation.

---

## 42. Do not overbuild sidebar sections

Avoid:

```
Dashboard | Missed Calls | Voicemail | Consent Log | Text Back Setup |
Schedule | Try It | Numbers | Compliance | Reports | Analytics | Needs Attention
```

That is too implementation-driven and mixes workspaces, setup, audit, process, state, and tools into one hierarchy.

---

## 43. Setup local navigation recommendation

**Inside Setup:**

- Phone
- Messaging
- Consent
- Schedule
- Voicemail
- Exclusions
- Test

Compliance may appear as **Business texting** or a clear contextual link if managed globally.

---

## 44. Page title and navigation alignment

| Sidebar active | Page title |
|----------------|------------|
| Missed Calls | Missed Calls |
| Conversations | Conversations |
| Setup (local tab: Consent) | Consent |

Do not use unrelated titles such as Recovery Center, Communication Console, Voice Agent, or Agent John for the same canonical destinations.

---

## 45. Cross-linking matrix

**From Missed Call** → Conversation, Contact, Consent evidence, Voicemail, Callback

**From Conversation** → Missed Call, Contact, Callback, Appointment (later if integrated)

**From Contact** → MCTB conversations, Missed-call history

**From Analytics** → deep-link to filtered Missed Calls / Conversations

**From Setup** → Compliance, Test, Numbers where necessary

---

## 46. Cross-links do not create duplicate editors

A Contact page can show **Recent MCTB conversations** but should open the canonical Conversation.

Do not build another conversation editor in Contact.

---

## 47. Returning from detail should preserve context

Example:

1. Missed Calls
2. Filter = Needs attention
3. Open caller
4. Return

The filter/search/sort/page should remain. Likewise Conversation inbox state should be retained.

---

## 48. Deep links must work

Routes such as `/mctb/missed-calls/:id` and `/mctb/conversations/:id` must load independently.

Do not require the user to first visit the list for hidden state.

---

## 49. Missing/deleted objects need recovery

Examples:

- *This missed call is no longer available. Return to Missed Calls.*
- *You don't have access to this conversation. Return to Conversations.*

No blank page.

---

## 50. Mobile navigation preserves the same IA

Desktop and mobile use the same destinations (Overview, Missed Calls, Conversations, Analytics, Setup) in menu/drawer.

Do not replace the conceptual architecture with a totally different mobile nav.

---

## 51. Mobile shortcuts may supplement navigation

A bottom action area could expose high-frequency actions if useful.

But these are shortcuts, not a second architecture.

---

## 52. Setup mobile transformation

If Setup uses left local navigation on desktop, mobile can use segmented nav, select/menu, stacked section index, or full-screen section transitions.

But the same configuration structure remains.

---

## 53. Breadcrumb rules

Likely no breadcrumb needed for Missed Calls, Conversations, Analytics.

Possible breadcrumb useful for:

- Missed Calls / (571) 555-1234
- Setup / Consent

But local nav + page title may already be sufficient. Do not add breadcrumbs mechanically.

---

## 54. Route names should follow user terms

**Recommended:**

- `/mctb/missed-calls`
- `/mctb/conversations`
- `/mctb/analytics`
- `/mctb/setup`

**Avoid exposing** (unless internal API routes only):

- `/mctb/call-events`
- `/mctb/sms-runtime`
- `/mctb/consent-engine`
- `/mctb/voice-ingress`

---

## 55. Settings ownership

**MCTB Setup:**

- MCTB message
- consent mode
- forwarding
- MCTB schedule

**Global Settings:**

- organization name
- team/security
- shared business texting registration if reused across products
- billing
- organization-wide phone-number inventory if applicable

Do not duplicate them.

---

## 56. Contextual readiness banner

If MCTB is not ready, Overview can show:

*Setup incomplete — forwarding has not been verified.* → CTA: **Continue setup**

That links to the exact setup section. Do not create a separate readiness destination.

---

## 57. Setup completion should not permanently dominate navigation

After the product is active, Setup should become quiet.

The user should mostly live in Missed Calls and Conversations.

This is the desired mature-product behavior.

---

## 58. Attention states belong near work

Examples: *3 conversations need a reply* should appear on Overview and Conversations nav count/indicator if useful.

Do not create a separate "Attention Center" unless the product later has enough cross-object operational complexity to justify it.

---

## 59. Counts in navigation

Possible: **Conversations 3** if 3 unread/requiring response.

Avoid excessive counts on every item.

Do not display Setup 2, Analytics 4, Compliance 1, Phone 1 unless those counts represent a very clear actionable state.

---

## 60. Active state must be programmatic and visual

Navigation selected state must use canonical active styling, expose `aria-current` where appropriate, and not rely on color alone.

Global Transovo navigation standards apply.

---

## 61. MCTB local IA must be documented centrally

Cursor should maintain a single MCTB navigation configuration.

Do not manually hard-code sidebar items in missed-calls page, conversations page, setup page, analytics page.

**One source of truth.**

---

## 62. Page ownership map

| Feature | Canonical home |
|---------|----------------|
| Daily summary | Overview |
| Missed-call history | Missed Calls |
| One missed event | Missed Call Detail |
| SMS threads | Conversations |
| MCTB performance | Analytics |
| Forwarding | Setup → Phone |
| SMS sender | Setup → Messaging |
| First text | Setup → Messaging |
| Consent mode | Setup → Consent |
| Press-1 prompt | Setup → Consent |
| Business hours | Setup → Schedule |
| Pause | Setup → Schedule + Overview status |
| Exclusion list | Setup → Exclusions |
| Test flow | Setup → Test |
| Consent evidence | Compliance / contextual detail |
| A2P/TF verification | Shared Business Texting or Setup → Compliance |
| Number purchase | Numbers/Add-number action |
| Public request form | Setup → Messaging |
| Cross-product reports | Global Reports |
| Admin diagnostics | Admin/support only |

---

## 63. Existing page inventory mapping

| Existing | Target |
|----------|--------|
| `/voice/missed-calls` | `/mctb/missed-calls` |
| `/voice/missed-calls/[id]` | `/mctb/missed-calls/[id]` |
| `/conversations` | MCTB filtered/canonical Conversations |
| `/voice/setup` | `/mctb/setup` |
| `/voice/schedule` | `/mctb/setup/schedule` |
| `/voice/try-it` | `/mctb/setup/test` |
| `/voice/voicemail` | `/mctb/voicemail` or Setup → Voicemail |
| `/voice/consent-log` | `/mctb/compliance/consent` |
| `/voice/analytics` | `/mctb/analytics` |
| `/voice/numbers` | Setup → Phone or global Numbers |
| `/voice/numbers/buy` | Add-number action |
| `/voice/needs-attention` | filtered operational view |
| `/compliance` | shared compliance or MCTB contextual compliance |
| `/compliance/campaign` | shared Business Texting |
| `/voice/reports` | global reports |
| `/onboarding/mctb` | onboarding process |
| `/f/mctb/[token]` | public customer form |

---

## 64. Preserve legacy URLs during migration

Use redirects where appropriate.

Do not break bookmarks or internal links unnecessarily.

But old route availability does not mean old information architecture remains visible.

---

## 65. Final IA decision rule

Before adding any MCTB page, Cursor must classify it as one of:

- Operational workspace
- Object detail
- Configuration
- Audit/compliance
- Temporary process
- Public/customer surface
- Admin/support surface

Then place it appropriately.

If the page does not fit one of these clearly, its product purpose likely needs refinement.

---

## 66. Final canonical MCTB architecture

**Recommended target:**

```
MISSED CALL TEXT BACK
Overview
WORK
  Missed Calls
  Conversations
  [Voicemail — only if recurring operational inbox]
INSIGHTS
  Analytics
CONFIGURE
  Setup

Inside Setup:
  Phone | Messaging | Consent | Schedule | Voicemail | Exclusions | Test

Supporting/contextual:
  Compliance / Consent evidence | Numbers | Cross-product Reports |
  Admin diagnostics | Onboarding | Public request form
```

---

## Cursor MCTB IA Pre-Implementation Checklist

Before changing navigation/routes:

- [ ] Identify whether feature is operational, configuration, audit, process, public, or admin
- [ ] Give feature one canonical home
- [ ] Use one canonical label
- [ ] Do not promote actions into navigation
- [ ] Do not promote filters/states into navigation
- [ ] Keep operational work more prominent than setup
- [ ] Preserve Missed Calls and Conversations as distinct core workspaces
- [ ] Use contextual cross-links instead of duplicate pages
- [ ] Keep consent mode inside Setup
- [ ] Keep Test/Try It inside Setup
- [ ] Treat Consent Log as compliance/audit, not automatically core nav
- [ ] Decide whether Voicemail is operational enough to deserve nav
- [ ] Map legacy Voice routes to canonical MCTB routes
- [ ] Preserve useful redirects
- [ ] Use one nav configuration/source of truth
- [ ] Ensure mobile uses the same conceptual IA

---

## Cursor MCTB IA Completion Checklist

- [ ] User can identify where they are
- [ ] User can reach Missed Calls quickly
- [ ] User can reach Conversations quickly
- [ ] Setup is discoverable but does not dominate
- [ ] Analytics has one canonical location
- [ ] Missed Call Detail and Conversation cross-link
- [ ] Contact relationships cross-link without duplicate objects
- [ ] Filters remain filters
- [ ] Needs Attention remains state/queue unless later justified otherwise
- [ ] Onboarding is temporary process navigation
- [ ] Public request form does not inherit admin navigation
- [ ] Admin support pages remain outside customer IA
- [ ] Legacy Voice navigation no longer defines MCTB architecture
- [ ] Route/page names use user terminology
- [ ] Page titles match nav labels
- [ ] Deep links load correctly
- [ ] Return-navigation preserves working context
- [ ] Mobile preserves the same conceptual destinations
- [ ] No page exposes backend architecture as product taxonomy

---

## Relationship to the standards stack

```
TRANSOVO-PRODUCT-DESIGN-UX-GOVERNANCE
        ↓
TRANSOVO-MCTB-PRODUCT-SCOPE-AND-DOMAIN-RULES
        ↓
TRANSOVO-MCTB-INFORMATION-ARCHITECTURE-AND-NAVIGATION-MAP  ← this document
        ↓
TRANSOVO-MCTB-PAGE-INVENTORY-AND-ROUTE-MANIFEST
        ↓
TRANSOVO-MCTB-CANONICAL-PRODUCT-MAP
        ↓
TRANSOVO-MCTB-PAGE-BUILD-SPECS  ← screen-by-screen implementation
        ↓
TRANSOVO-HUMAN-CENTERED-DESIGN-STANDARDS
        ↓
TRANSOVO-PAGE-ARCHITECTURE-RULES
        ↓
TRANSOVO-VISUAL-DESIGN-GUIDE
        ↓
Formal implementation standards
        ↓
Existing implementation/screenshots
```

This document gives Cursor the **where-everything-lives** authority. The next document in the MCTB stack should be the **MCTB Page Inventory & Route Manifest** — enumerating every actual screen, subpage, wizard, state, and route Cursor must account for.

---

**This document is the authoritative information-architecture and navigation ruleset for Transovo Missed Call Text Back. Cursor must read it (after product scope) before mapping routes, navigation, or rebuilding MCTB pages.**
