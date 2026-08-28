# Cursor Brief — Add Missing Production Workflow Blocks First

**Policy:** Do not remove, hide, merge, rename, or simplify any existing automation blocks during this pass. Do not reduce the current automation catalog.

This pass is only about **adding** the missing native workflow capabilities needed to bring `/automations/[flowId]` to full parity with important SlickText-style workflow behaviors, while preserving all existing Transovo blocks and runtime behavior.

After this pass is complete and certified, we will do a **separate catalog audit** to determine which existing blocks are redundant or unnecessary.

## Categories

`Triggers | Actions | Conditions | Waits`

## Requirements for every new block

- Correct per-block configuration/settings UI
- Dynamic settings based on prior selections
- Human-readable canvas summary
- Named outgoing outcomes specific to that block
- Persisted configuration
- Persisted `sourceHandle`/outcome on edges
- Runtime execution that follows the correct named outcome
- Test coverage
- Migration compatibility with existing workflows
- No breaking changes to current blocks

---

## 1. Native triggers to add

See `AUTOMATION_PARITY_GAP_INVENTORY.md` for implementation status per block.

| Block | Output handle |
|-------|----------------|
| Customer Field Changed | `field_changed` |
| General Link Clicked | `link_clicked` |
| Customer Added to List | `added_to_list` |
| Customer Removed from List | `removed_from_list` |
| Message Received | `message_received` |
| Inbox Conversation Status Changed | `status_changed` |
| Inbox Conversation Tagged | `conversation_tagged` |
| Inbox Conversation Untagged | `conversation_untagged` |
| Inbox Conversation Assigned | `conversation_assigned` |
| Inbox Conversation Unassigned | `conversation_unassigned` |
| Contact Birthday | `birthday` |
| Popup Submitted | `popup_submitted` (or Form Submitted → Source Type: Popup) |

Full settings specifications are in the product brief (Aug 2026). Key rules:

- **Message Received** — first-class native SMS trigger with number, sender, and message matching filters.
- **General Link Clicked** — not limited to review links; expose URL/link ID/message ID/time as variables.
- **Popup Submitted** — reuse form infrastructure if popups share the event system; do not duplicate submission plumbing.

---

## 2. Native actions to add

| Block | Outcomes |
|-------|----------|
| Add Contact to List | Added, Already On List, Failed |
| Remove Contact from List | Removed, Wasn't On List, Failed |
| Assign Inbox Conversation | Assigned, Conversation Doesn't Exist, Failed |
| Unassign Inbox Conversation | Unassigned, Already Unassigned, Conversation Doesn't Exist, Failed |
| Tag Inbox Conversation | Tagged, Already Tagged, Conversation Doesn't Exist, Failed |
| Untag Inbox Conversation | Untagged, Tag Wasn't Present, Conversation Doesn't Exist, Failed |
| Set Inbox Conversation Status | Updated, Already In Status, Conversation Doesn't Exist, Failed |
| Mark Inbox Conversation Read/Unread | Updated, Already In State, Conversation Doesn't Exist, Failed |
| Create Inbox Conversation Note | Note Created, Conversation Doesn't Exist, Failed |
| Set Contact Opt-In Status | Updated, Not Allowed, No Consent Evidence, Failed — **never manufacture consent** |
| Split Traffic | Dynamic A/B/C… handles with percentages (2–6 paths, deterministic per execution) |
| Delete Contact | Deleted, Already Deleted/Not Found, Failed (destructive, only if deletion exists elsewhere) |
| End / Eject from Workflow | No outgoing connector; store reason in run history (enhance existing `end_automation`) |

---

## 3. Conditions to add / expand

Do not remove existing Condition, Customer Field Check, Review Status, Message Status, Tag Check, Has Responded, etc.

Add dedicated shortcut blocks or typed presets backed by the shared condition engine:

- Contact Is On List (Yes / No)
- Contact Matches Segment (Yes / No)
- General Link Clicked (Yes / No)
- Workflow Message Clicked (Yes / No)
- Inbox Conversation Assignee (Yes / No / Conversation Doesn't Exist)
- Inbox Conversation Tags (Yes / No / Conversation Doesn't Exist)
- Inbox Conversation Status (Yes / No / Conversation Doesn't Exist)
- Inbox Conversation Is Unread (Yes / No / Conversation Doesn't Exist)
- SMS Opt-In Status (compare or branch by state)
- Has Ever Unsubscribed (Yes / No — consent history, not current state only)
- Message Sentiment (Positive, Negative, Neutral, Mixed, Unknown)
- Workflow Status (Not Started, In Progress, Finished)
- Current Time / Business Hours (Yes / No)
- Ecommerce conditions (only where data exists — Cart/Order status, value, items, etc.)

---

## 4. True event waits to add

Preserve: Wait for Duration, Wait Until Date/Time, Call Outcome.

Add true event waits (suspend execution, resume on event or timeout):

- Wait for Message Received / Wait for Reply
- Wait for Link Click
- Wait for Workflow Message Click (may share runtime with link click)
- Wait for Customer Field Change

Event waits must persist waiting state, survive restart, and protect against duplicate events, timeout races, and double resume.

---

## 5–10. UI, operators, outcomes, edges, wait runtime, canvas summary

- Block-specific settings drawers — not generic JSON forms
- Reusable controls: ContactFieldSelect, ListSelect, SegmentSelect, TagSelect, ConversationTagSelect, TeamMemberSelect, SendingNumberSelect, MessageSelector, TrackedLinkSelect, DurationInput, DateTimeInput, TimezoneSelect, ScheduleSelector, ConditionBuilder, MessageComposer, VariablePicker, WorkflowSelect, EcommerceProductSelect, IntegrationAccountSelect
- Type-aware operators (text, number, date, boolean) — hide value input when operator doesn't require it
- Each block owns its output handles — not global success/failure or yes/no everywhere
- Edges persist `sourceHandle`; runtime follows matching edge
- Canvas summaries per configured node (examples in product brief)

---

## 11. Certification

For every new block family: create → configure → save → reload → persist settings/handles → connect outputs → execute runtime → prove correct branch.

Required E2E examples listed in product brief (Message Received trigger, field changed trigger, list add trigger, inbox assignment, wait for reply/timeout/email/link click, split traffic distribution, conversation actions, opt-in compliance).

**Do not mark complete because blocks render in the sidebar.**

---

## 12. Preserve everything else for now

Do not remove, hide, merge, rename unnecessarily, reduce integrations, redesign Smart Routing, delete voice blocks, or collapse CRM trigger coverage.

**Add first; catalog cleanup is a separate pass.**
