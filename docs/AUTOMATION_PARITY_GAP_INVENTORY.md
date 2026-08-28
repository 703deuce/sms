# Automation Parity Gap Inventory

**Policy:** Add-only pass. No removals, hiding, merging, or renames of existing blocks.

Status key: `missing` | `partial` | `added` (this branch)

Last updated: Aug 28, 2026 — branch `cursor/automation-slicktext-parity-foundation-9cca`

---

## Triggers

| Block | Prior status | Notes |
|-------|--------------|-------|
| Customer Field Changed | missing → **added** | `customer_field_changed` |
| General Link Clicked | partial → **added** | `review_request_clicked` was review-only; new `general_link_clicked` |
| Customer Added to List | missing → **added** | `customer_added_to_list` |
| Customer Removed from List | missing → **added** | `customer_removed_from_list` |
| Message Received | missing → **added** | First-class SMS trigger `message_received` |
| Inbox Conversation Status Changed | missing → **added** | `inbox_conversation_status_changed` |
| Inbox Conversation Tagged | missing → **added** | `inbox_conversation_tagged` |
| Inbox Conversation Untagged | missing → **added** | `inbox_conversation_untagged` |
| Inbox Conversation Assigned | missing → **added** | `inbox_conversation_assigned` |
| Inbox Conversation Unassigned | missing → **added** | `inbox_conversation_unassigned` |
| Contact Birthday | missing → **added** | `contact_birthday` (scheduled processor) |
| Popup Submitted | partial → **added** | `popup_submitted`; reuses form event path |

**Preserved (unchanged):** all existing triggers including CRM integrations, voice, reviews, `tag_added`, `form_submitted`, `scheduled_datetime`, etc.

---

## Actions

| Block | Prior status | Notes |
|-------|--------------|-------|
| Add Contact to List | missing → **added** | `add_contact_to_list` |
| Remove Contact from List | missing → **added** | `remove_contact_from_list` |
| Assign Inbox Conversation | missing → **added** | `assign_inbox_conversation` |
| Unassign Inbox Conversation | missing → **added** | `unassign_inbox_conversation` |
| Tag Inbox Conversation | missing → **added** | `tag_inbox_conversation` |
| Untag Inbox Conversation | missing → **added** | `untag_inbox_conversation` |
| Set Inbox Conversation Status | missing → **added** | `set_inbox_conversation_status` |
| Mark Inbox Read/Unread | missing → **added** | `mark_inbox_conversation_read` |
| Create Inbox Conversation Note | missing → **added** | `create_inbox_conversation_note` |
| Set Contact Opt-In Status | missing → **added** | `set_contact_opt_in_status` — no consent manufacture |
| Split Traffic | missing → **added** | `split_traffic` — deterministic per execution |
| Delete Contact | missing → **added** | `delete_contact` — mirrors `/api/contacts/[id]` DELETE |
| End / Eject from Workflow | partial → **enhanced** | `end_automation` + optional `ejectReason` |

**Preserved:** all existing actions (SMS, tags, webhooks, voice, CRM, etc.)

---

## Conditions

| Block | Prior status | Notes |
|-------|--------------|-------|
| Contact Is On List | missing → **added** | `condition_contact_on_list` |
| Contact Matches Segment | missing → **added** | `condition_contact_segment` — real segment evaluation via `segment-match.ts` |
| General Link Clicked | missing → **added** | `condition_general_link_clicked` |
| Workflow Message Clicked | missing → **added** | `condition_workflow_message_clicked` |
| Inbox Conversation Assignee | missing → **added** | `condition_inbox_assignee` |
| Inbox Conversation Tags | missing → **added** | `condition_inbox_tags` |
| Inbox Conversation Status | missing → **added** | `condition_inbox_status` |
| Inbox Conversation Is Unread | missing → **added** | `condition_inbox_unread` |
| SMS Opt-In Status | missing → **added** | `condition_sms_opt_in_status` |
| Has Ever Unsubscribed | missing → **added** | `condition_has_ever_unsubscribed` |
| Message Sentiment | missing → **added** | `condition_message_sentiment` (keyword heuristic until AI wired) |
| Workflow Status | missing → **added** | `condition_workflow_status` |
| Current Time / Business Hours | missing → **added** | `condition_business_hours` |
| Ecommerce conditions | partial → **added** | WooCommerce data only where `integration_order_*` facts exist |

**Preserved:** `condition`, `condition_customer_field`, `condition_review_status`, `condition_message_status`, `condition_tag`, `condition_has_responded`

---

## Waits (true event waits)

| Block | Prior status | Notes |
|-------|--------------|-------|
| Wait for Duration | exists | `wait` — unchanged |
| Wait Until Date/Time | exists | `wait_until_datetime` — unchanged |
| Call Outcome | exists | `wait_for_call_result` — unchanged |
| Wait for Reply | missing → **added** | `wait_for_reply` |
| Wait for Link Click | missing → **added** | `wait_for_link_click` |
| Wait for Workflow Message Click | missing → **added** | `wait_for_workflow_message_click` |
| Wait for Customer Field Change | missing → **added** | `wait_for_customer_field_change` |

---

## Infrastructure added

| Component | Path |
|-----------|------|
| Block registry (outcomes, operators, summaries) | `src/lib/automations/block-registry/` |
| Parity catalog entries | `src/lib/automations/catalog-parity-blocks.ts` |
| Runtime: lists, inbox, split, opt-in, conditions | `src/lib/automations/parity/` |
| Segment evaluation | `src/lib/automations/parity/segment-match.ts` |
| Birthday processor | `src/lib/automations/parity/birthday-processor.ts` |
| Inbox event emitters | `src/lib/automations/parity/inbox-events.ts` |
| Event wait resume | `src/lib/automations/parity/event-waits.ts` |
| Trigger matching | `src/lib/automations/parity/trigger-matching.ts` |
| Certification tests | `scripts/test-automation-parity-foundation.ts`, `scripts/test-automation-parity-full-cert.ts` |
| Catalog audit (recommendations) | `docs/AUTOMATION_CATALOG_AUDIT.md` |

---

## Certification checklist (per brief §11)

- [x] Message Received trigger — inbound SMS → workflow starts
- [x] Customer Field Changed — field update → workflow starts
- [x] Add to List action + Added to List trigger
- [x] Inbox assignment trigger
- [x] Wait for Reply — reply resumes correct branch
- [x] Wait timeout — no reply → timeout branch
- [x] Wait for Email extraction
- [x] Wait for Link Click
- [x] Field change wait
- [x] Split Traffic distribution + retry stability
- [x] Conversation actions mutate real conversation state
- [x] Opt-in action cannot manufacture consent
- [x] Contact matches segment (real segment engine)
- [x] Birthday processor runs on schedule
- [x] Popup submitted event wiring

Run:

```bash
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-parity-foundation.ts
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-parity-full-cert.ts
```
