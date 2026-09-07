# Transovo MCTB Page Build Spec — 04: Conversations

**Status:** Active — mandatory implementation specification  
**Route:** `/mctb/conversations` or canonical shared Transovo Conversations route with MCTB context/filtering  
**Product:** Missed Call Text Back  
**Page archetype:** Operational messaging workspace / master-detail inbox  
**Canonical navigation:** MCTB → Conversations  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment product screenshots + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Interaction, Forms, Responsive, Tables, Privacy/Consent, Security, Date/Time, and i18n standards plus MCTB product/domain, IA, manifest, Overview, Missed Calls, Missed Call Detail specs, and canonical map

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-04-conversations.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule for this page

The MCTB Conversations page is the canonical messaging workspace for SMS conversations that originated from Missed Call Text Back. Its purpose is to let staff understand which recovered callers have replied, read the authoritative conversation history, respond when permitted, and move naturally between the conversation and the missed-call event that started it. **MCTB must not create a second independent SMS inbox** if Transovo already has a canonical Conversations/Inbox engine. Reuse that engine and apply MCTB context, filters, source metadata, permission checks, compliance state, and product-specific related-object links. Conversation state, message history, sender identity, opt-out state, assignment, and reply eligibility must come from authoritative runtime data.

---

## 2. Primary users and context

### Primary users

Receptionist, Office manager, Business owner, Scheduler, Staff assigned to customer follow-up.

### Primary context

Checking who replied; responding quickly; reviewing context before callback; checking if another staff member replied; opt-out/sender blocks; working through several conversations; desktop active follow-up; mobile quick checks.

### Primary user question

**"Which missed callers are talking to us, and who needs a response?"**

---

## 3. Primary job

Exactly one primary job: **Read and respond to MCTB conversations from one authoritative messaging workspace.**

| Question | Answer |
|----------|--------|
| Where am I? | MCTB → Conversations |
| What is this for? | Handle replies from missed callers |
| What can I do? | Find conversation, read thread, reply, assign/follow up, call customer, open originating missed call |
| Attention needed? | Needs reply, unread, blocked, opted out, delivery problems must be clear |
| Where next? | Missed Call Detail, Contact, callback, appointment (if integrated) |

---

## 4. Canonical architecture decision (hard rule)

**Do not build an MCTB-specific duplicate inbox** if existing Transovo `/inbox` is the canonical SMS conversation engine.

The shared inbox already supports: conversation lists, thread history, reply/note composition, assignment, AI assistance, templates, media, translation, CRM context.

**Preferred architecture:**

```
MCTB Conversations → Canonical Transovo Conversations/Inbox engine → MCTB source filter + MCTB context
```

**Route models:**

- **Option A:** `/mctb/conversations` renders/links shared inbox with `source=mctb`
- **Option B:** `/inbox?source=mctb` with MCTB local nav labeling **Conversations**

Prefer architecture that preserves the existing canonical messaging engine.

---

## 5. Legacy conversation cleanup

Audit `/voice/conversations` and `/inbox`.

**Known legacy issue:** `/voice/conversations` may represent voice-call data while SMS threads live in `/inbox`.

For MCTB: **SMS thread = canonical Conversation.**

Do not keep misleading MCTB nav that opens voice-call list then redirects elsewhere to reply.

**Preferred:** `/voice/conversations` → redirect to canonical MCTB Conversations, or retire from MCTB IA.

---

## 6. Screenshot calibration

Capture: split-pane messaging/inbox, contact/detail panel, list density, unread/selected states, composer, assignment, note/reply mode, action menus, mobile detail, workspace alerts/errors.

If `/inbox` already matches finished Transovo visual system — **preserve shared components** rather than rebuilding for "MCTB."

---

## 7. Global page anatomy

```
Global Transovo shell
    ↓
MCTB local navigation
    ↓
┌─────────────────┬──────────────────────────┬─────────────────┐
│ Conversation    │ Selected conversation    │ Context panel   │
│ list            │                          │ (optional)      │
└─────────────────┴──────────────────────────┴─────────────────┘
```

Third panel optional — do not force three columns if shared inbox uses two.

---

## 8–9. Page header & primary action

User must know: **Conversations** — contextualized to **Missed Call Text Back**. Compact header; no giant marketing heading in dense workspace.

**Normally no "New conversation"** — MCTB conversations originate from missed-call recovery and inbound replies. Hide unrelated creation actions if shared inbox supports them elsewhere.

---

## 10–13. Conversation list & filters

**List item anatomy:** Contact name or phone → last message preview → time → Needs reply/Unread.

Optional subtle *Missed call* source indicator only if inbox has multiple sources.

**Filters (if supported):** All | Needs reply | Unread | Mine | Unassigned | Resolved/Open — only if domain supports; no fake Mine/Unassigned in V1.

**Search:** caller/contact name, phone; conversation text only if backend genuinely supports. Search state persists while opening/closing conversations.

---

## 14. Selected conversation route

Preferred: `/mctb/conversations/:conversationId` or `/inbox/:conversationId?source=mctb`

Deep linking must work without prior list navigation.

---

## 15–17. Thread header & actions

**Identity:** Anthony Johnson / (571) 555-0184

**MCTB context:** *Started from a missed call · Today at 10:42 AM* — **View missed call** (link)

Optional: *Called 3× today*, Business line if useful.

**Actions:** Call customer | Assign (if supported) | More — Open contact, View missed call, Mark resolved if canonical.

**Callback:** real number via dialer; do not mark completed unless authoritative; do not auto-resolve conversation.

---

## 18–24. Message thread

Display actual historical communications:

- System compliance confirmation
- Recovery opener
- Customer/business SMS
- Automated MCTB response if supported
- Opt-out / HELP events
- Delivery/error events where useful

**Never reconstruct from current templates.**

### System message distinction

Press-1 compliance confirmation visually distinct from business conversational message. Understandable without excessive noise.

### Delivery status (outbound)

Sending | Sent | Delivered | Failed | Suppressed — where useful; no provider-level states in main thread.

### Suppressed

*Message not sent — Customer opted out* — not a normal SMS bubble.

### Opt-out event

Explicit system event: *Customer opted out of SMS · 10:51 AM* — then update composer eligibility.

---

## 25–31. Composer & send

**Composer:** Reply… + Template/Attach/Send — only supported controls.

**Eligibility before enable:** opted out, sender unavailable, no sender, read-only, permission denied, compliance unavailable, channel blocked. Do not allow typing then fail on Send if blocker known.

**Blocked examples:**

- *SMS replies are disabled — This customer opted out…* — no "Turn messaging back on"
- *Messaging temporarily unavailable — text-back sender needs attention* → View messaging setup (if permitted)

**Recheck eligibility on Send** — frontend state not authoritative.

**Send behavior:** disable duplicate submission; Sending state; preserve draft on failure; idempotent where possible.

**Send failure:** *Message couldn't be sent. Draft preserved. Retry* — if eligible. Opt-out between draft and send: no retry.

---

## 32–33. Drafts & notes

Preserve safe drafts per canonical inbox behavior. Do not persist insecurely.

If internal notes supported: explicit **Reply** vs **Internal note** modes — notes never transmitted. Hide notes in MCTB V1 if unnecessary.

---

## 34–36. Assignment & conversation state

**Assignment:** Assigned to Sarah | Assign to me | Change assignee — on conversation object, not separate MCTB queue.

**Needs-reply:** centralized domain rule — latest meaningful customer message newer than latest business response; conversation open; not terminal state. Frontend must not infer differently per page.

**Resolution:** reuse canonical Open | Resolved | Archived — no ad-hoc MCTB Recovered/Closed/Done unless formally defined.

---

## 37–40. AI assistance

AI remains **assistive** — no silent auto-send.

- **Suggested reply** — labeled as suggestion until user sends
- **Summary** — does not replace message history (evidence for disputes)
- **Translation** — original accessible; translation labeled; do not replace source

---

## 41–45. Context panel (optional)

Missed call summary + View missed call | Contact link | Recent activity | Callback action.

Do not duplicate full Contact detail page.

**Appointments later:** Book appointment / upcoming — canonical Appointment engine only.

**Templates:** operational Saved Replies only — no campaign/marketing templates.

**Attachments:** only if runtime/compliance supports MMS; no decorative paperclip.

---

## 46–49. List selection & live updates

Selected thread visually and programmatically distinct; focus ≠ selection.

Reuse canonical list keyboard model — no invented ARIA grid unless full APG grid required.

**New messages:** append without stealing focus; announce appropriately; safe scroll behavior.

**New conversations:** do not reorder focused item unexpectedly; *1 new conversation [Show]* per shared inbox pattern.

---

## 50. Unread vs needs-reply

Not the same concept. Do not collapse casually.

---

## 51–57. Empty & error states

| State | Treatment |
|-------|-----------|
| Active, no conversations | *No conversations yet — When a missed caller replies…* |
| Setup incomplete | *Finish setting up MCTB… Continue setup* |
| Filtered empty | *No conversations match these filters* + Clear filters |
| Loading | Skeleton list + thread + context — no flash empty |
| List error | *Conversations couldn't be loaded* + Retry |
| Thread error | List remains; thread area error localized |
| Partial | Only affected features degrade |

---

## 58–60. Opt-out, consent, sender context

**Current:** SMS Opted out | **History:** event preserved; earlier messages not rewritten.

**Consent:** compact — *Verified Call Consent captured Sep 8* + View consent record link; not giant permanent card.

**Sender near composer:** *Sending from (571) 555-4428* or *Text-back sender:* — truthful labels, not ambiguous "Your number."

---

## 61–64. Security & privacy

Tenant/workspace scoped; switching workspace clears previous thread; server authorizes conversation IDs.

**Roles:** view+reply normal | view-only blocked composer | cannot access server rejects.

Export/search: permission-controlled; minimum necessary preview.

---

## 65–69. Date/time, Unicode, segments, truncation, RTL

Canonical temporal utilities; locale-aware; ordering by instants.

Composer Unicode-safe; segment count from actual encoding — not raw JS `.length` for Unicode.

Thread bodies wrap — no truncation in selected thread. List previews may truncate with recovery via opening thread.

`dir="auto"` for mixed-direction user content; bidi-safe rendering.

---

## 70–77. Responsive layout

**Desktop:** canonical inbox density; list ~300–360px, thread flexible, context ~280–320px optional — from design system tokens.

**Tablet:** collapse context; list+thread or overlay.

**Mobile:** list → full-screen thread; Back to Conversations; Details sheet for context.

**Composer:** reachable above software keyboard; safe areas; last message not covered.

**Orientation:** preserve draft, selection, scroll where feasible.

**200% zoom / 320px:** wrap, reflow, one pane at a time, no horizontal scroll.

---

## 78–82. Accessibility

Workspace heading; list structure; selected conversation identifiable; messages have sender+time; inbound/outbound not color-only; composer labeled; Send is button; opt-out announced; errors associated with composer; keyboard-only complete.

**Screen reader message example:** *Anthony Johnson, received message, 10:47 AM: "Can someone call me after 3?"*

**System events:** *System event: Customer opted out of SMS at 10:53 AM*

**Focus after send:** remains in composer; on failure preserve draft and logical focus.

**Opening conversation:** intentional focus on mobile; desktop without chaotic jumps.

---

## 83–85. Navigation context

Return from Missed Call Detail preserves selected/filtered conversation where practical.

Deep links: auth + workspace + thread + MCTB context without prior list.

Browser history: route-per-thread if supported; Back behaves predictably.

---

## 86–88. Failure & row actions

AI/provider failures: core conversation usable; localized unavailable messages.

List row: primary = open conversation; secondary in overflow only if canonical inbox supports (Assign, Mark unread, Resolve).

**Badge discipline:** not MCTB+SMS+Unread+Open+Needs reply+Assigned+Hot all as pills.

---

## 89–91. Visual emphasis & empty thread

Thread priority: customer identity → attention/permission → messages → composer → context.

**Empty thread panel (desktop):** *Select a conversation — Choose a caller from the list…* — no fake sample.

---

## 92–93. Outbound-only threads (architecture rule)

Inspect canonical conversation semantics:

- **A:** Conversations only after customer reply
- **B:** Conversation exists once messaging thread exists (may show *Waiting for reply*)

**Runtime truth wins** — do not inconsistently show outbound-only threads across pages. Prefer B only if shared engine already treats outbound thread as real conversation.

---

## 94–98. Sender labels, HELP/STOP, restrictions, audit integrity

Compliance messages label source truthfully (Transovo vs business). HELP/STOP handled by runtime — not frontend literal STOP detection only.

No Resume texts / Remove opt-out / Resubscribe without formal valid flow.

Staff cannot edit sent/received messages; deletion/hiding per policy with audit requirements.

---

## 99–100. Runtime contract & cross-page consistency

Reuse: `conversation_id`, `workspace_id`, `contact_id`, `caller_e164`, `source_product`, `source_missed_call_id`, `messages[]`, `last_message_at`, `needs_reply`, `assignee`, `conversation_status`, `sms_eligibility`, `opt_out_status`, `sender_number`, `draft`, etc.

**No parallel MCTB conversation state.**

Needs reply / opted out must agree across Overview, Missed Calls, Detail, and Conversations.

---

## 101. Test scenarios

| ID | Scenario |
|----|----------|
| A | Full Press-1 thread through business reply |
| B | Existing Consent — no fake Press-1 |
| C | Customer has not replied — correct waiting state |
| D | Needs reply — clear attention |
| E | Staff already replied — no stale needs reply |
| F | Opt-out — history, blocked composer, no override |
| G | Sender unavailable — blocked + fix path |
| H | Send failure — draft, no duplicate |
| I | Assignment if supported |
| J | AI assist failure — manual still works |
| K | Deep link loads |
| L | Multi-workspace isolation |
| M | Mobile list → thread; draft preserved |
| N | Mobile keyboard — composer reachable |
| O | Keyboard-only full workflow |
| P | RTL/mixed language layout |

---

## 102. Definition of done — Conversations

Cursor may mark MCTB Conversations complete only when:

- [ ] Reuses canonical Transovo conversation/inbox engine
- [ ] No duplicate SMS thread model
- [ ] Legacy `/voice/conversations` ambiguity resolved
- [ ] MCTB nav opens real conversation workspace
- [ ] List prioritizes caller, last message, attention, time
- [ ] Search/filter use real supported scope/state
- [ ] Deep link works; thread header links to missed call
- [ ] Compliance message distinct from conversational message
- [ ] Historical messages accurate; statuses authoritative
- [ ] Suppressed not rendered as sent; opt-out event visible
- [ ] Composer respects centralized eligibility; server rechecks on send
- [ ] No casual opt-out override; duplicate submission prevented
- [ ] Note/reply safe if notes included; assignment canonical if included
- [ ] Needs-reply centralized; AI assistive only
- [ ] Context panel does not duplicate object pages
- [ ] Contact/Appointment use canonical engines
- [ ] No marketing/campaign features in MCTB context
- [ ] All empty/loading/error/partial states complete
- [ ] Permissions + multi-tenant enforcement correct
- [ ] Date/time, Unicode, RTL, segment count correct
- [ ] Desktop/tablet/mobile + keyboard + 320px + 200% QA
- [ ] Cross-page status agrees with Overview, Missed Calls, Detail
- [ ] No mock controls/data; matches Appointment visual language

---

## Build handoff

Next screen in sequence: **05 — Visual Voicemail** — see `TRANSOVO-MCTB-PAGE-BUILD-SPEC-05-VISUAL-VOICEMAIL.md`.

**06 — Analytics** — pending build spec.
