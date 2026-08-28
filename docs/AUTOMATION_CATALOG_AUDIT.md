# Automation Catalog Audit (recommendations only)

**Date:** Aug 28, 2026  
**Branch:** `cursor/automation-slicktext-parity-foundation-9cca`  
**Policy:** This document is analysis only. No blocks were removed, hidden, merged, or renamed in the parity pass.

---

## Summary

The catalog now contains **50 additive parity blocks** (`catalog-parity-blocks.ts`) merged into `AUTOMATION_BLOCKS` alongside all legacy blocks. The sidebar is large but functionally complete for SlickText-style workflows. A future cleanup pass should focus on **consolidation behind presets**, not deletion of working runtime paths.

---

## Triggers — overlap candidates

| Legacy / existing | New parity block | Recommendation |
|-------------------|------------------|----------------|
| `form_submitted` | `popup_submitted` | Keep both. Popup uses dedicated trigger + `sourceType=popup` filter on form path. Consider UI hint linking popup flows to `popup_submitted`. |
| `review_request_clicked` | `general_link_clicked` | Keep both. Review links remain review-specific; general links use tracking tokens from campaigns/one-off SMS. |
| `tag_added` | — | Keep. Still valid for contact-level tags (not inbox conversation tags). |
| `customer_added` | — | Keep. Distinct from list add (`customer_added_to_list`). |
| `inbound_call` / `call_missed` / `message_received` | `message_received` | Keep all. Voice triggers are separate product surface; do not merge. |

**No removals recommended** for triggers in this pass.

---

## Actions — overlap candidates

| Legacy | New parity | Recommendation |
|--------|------------|----------------|
| `add_tag` / `remove_tag` | `tag_inbox_conversation` | Different scope (contact vs conversation). Keep both; document in builder tooltips. |
| `end_automation` | same (enhanced) | `ejectReason` config added. No duplicate block needed. |
| `send_sms` | — | Core product. Keep. |

---

## Conditions — overlap candidates

| Legacy | New parity | Recommendation |
|--------|------------|----------------|
| `condition` | Many parity shortcuts | Keep generic `condition` for power users. Parity blocks are typed presets (list, segment, inbox, opt-in, sentiment, business hours, ecommerce). |
| `condition_customer_field` | `customer_field_changed` trigger + `wait_for_customer_field_change` | Complementary: condition checks state at step time; trigger/wait react to changes. |
| `condition_tag` | `condition_contact_on_list` | Different semantics. Keep both. |
| `condition_message_status` | `condition_workflow_message_clicked` | Related but distinct (delivery vs click). Keep both. |

**Future UX:** Group "shortcut conditions" under a collapsible sub-section without removing legacy entries.

---

## Waits — overlap candidates

| Legacy | New parity | Notes |
|--------|------------|-------|
| `wait` | `wait_for_reply`, `wait_for_link_click`, etc. | Duration wait unchanged. Event waits are true event-driven (metadata + resume hooks). Do not merge. |
| `wait_for_call_result` | — | Voice product. Keep isolated from SMS event waits. |

---

## Blocks safe to hide in sidebar (future pass only)

These are candidates for **sidebar collapse / "Advanced"** — not removal:

- Duplicate CRM integration triggers where workspace has no CRM connected (already capability-gated in part).
- `condition` when a typed parity condition exists for the same check (show preset first, link to advanced).

**Do not hide** until analytics show zero usage in production flows.

---

## Runtime / registry completeness

| Area | Status |
|------|--------|
| Block registry outcomes | Complete for all 50 parity blocks + legacy multi-outcome blocks |
| Canvas summaries | `block-registry/summaries.ts` |
| Config UI | `parity-node-config.tsx` — covers all parity block types |
| Dynamic handles | `dynamic-outcome-handles.tsx` + `automation-node.tsx` |
| Certification | `test-automation-parity-foundation.ts`, `test-automation-parity-full-cert.ts` |

---

## Known limitations (document, don't block ship)

1. **Message sentiment** — keyword heuristic until AI sentiment service is wired.
2. **Ecommerce conditions** — evaluate only when `integration_order_*` facts exist on contact metadata.
3. **Contact birthday** — uses `customFields.dateOfBirth`; processor runs on cron window (±30 min of configured time).
4. **Popup detection** — `embedHost` includes `widget` or referrer contains `/embed/w/`; `PublicOptInForm` passes `embedHost` on embed variant.

---

## Recommended next pass (separate PR)

1. Sidebar grouping: Triggers / Actions / Conditions / Waits / Integrations with search.
2. "Suggested blocks" on empty canvas based on entitlements.
3. Deprecation badges on redundant blocks (no runtime removal).
4. Builder manual QA matrix per block type with screenshots.
