/**
 * Named outgoing outcomes per automation block type.
 * Used by canvas handles, edge sourceHandle validation, and runtime branching.
 */

export type BlockOutcome = {
  id: string;
  label: string;
  /** Optional display hint e.g. "50%" for split traffic */
  hint?: string;
};

export type BlockOutcomeDef = {
  /** Single default output (triggers, simple actions) */
  single?: BlockOutcome;
  /** Branch outputs (conditions, multi-outcome actions/waits) */
  branches?: BlockOutcome[];
  /** No outgoing connector */
  terminal?: boolean;
};

const YES_NO: BlockOutcome[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

const CONVERSATION_MISSING: BlockOutcome = {
  id: "conversation_not_found",
  label: "Conversation Doesn't Exist",
};

function conversationActionOutcomes(
  success: BlockOutcome,
  already: BlockOutcome,
): BlockOutcome[] {
  return [success, already, CONVERSATION_MISSING, { id: "failed", label: "Failed" }];
}

/** Registry of outcomes per blockType. Additive — existing blocks keep legacy handles. */
export const BLOCK_OUTCOMES: Record<string, BlockOutcomeDef> = {
  // —— Triggers (single output) ——
  customer_field_changed: { single: { id: "field_changed", label: "Field Changed" } },
  general_link_clicked: { single: { id: "link_clicked", label: "Link Clicked" } },
  customer_added_to_list: { single: { id: "added_to_list", label: "Added to List" } },
  customer_removed_from_list: { single: { id: "removed_from_list", label: "Removed from List" } },
  message_received: { single: { id: "message_received", label: "Message Received" } },
  inbox_conversation_status_changed: { single: { id: "status_changed", label: "Status Changed" } },
  inbox_conversation_tagged: { single: { id: "conversation_tagged", label: "Conversation Tagged" } },
  inbox_conversation_untagged: { single: { id: "conversation_untagged", label: "Conversation Untagged" } },
  inbox_conversation_assigned: { single: { id: "conversation_assigned", label: "Conversation Assigned" } },
  inbox_conversation_unassigned: { single: { id: "conversation_unassigned", label: "Conversation Unassigned" } },
  contact_birthday: { single: { id: "birthday", label: "Birthday" } },
  popup_submitted: { single: { id: "popup_submitted", label: "Popup Submitted" } },

  // —— Actions ——
  add_contact_to_list: {
    branches: [
      { id: "added", label: "Added" },
      { id: "already_on_list", label: "Already On List" },
      { id: "failed", label: "Failed" },
    ],
  },
  remove_contact_from_list: {
    branches: [
      { id: "removed", label: "Removed" },
      { id: "wasnt_on_list", label: "Wasn't On List" },
      { id: "failed", label: "Failed" },
    ],
  },
  assign_inbox_conversation: {
    branches: [
      { id: "assigned", label: "Assigned" },
      CONVERSATION_MISSING,
      { id: "failed", label: "Failed" },
    ],
  },
  unassign_inbox_conversation: {
    branches: [
      { id: "unassigned", label: "Unassigned" },
      { id: "already_unassigned", label: "Already Unassigned" },
      CONVERSATION_MISSING,
      { id: "failed", label: "Failed" },
    ],
  },
  tag_inbox_conversation: {
    branches: conversationActionOutcomes(
      { id: "tagged", label: "Tagged" },
      { id: "already_tagged", label: "Already Tagged" },
    ),
  },
  untag_inbox_conversation: {
    branches: conversationActionOutcomes(
      { id: "untagged", label: "Untagged" },
      { id: "tag_wasnt_present", label: "Tag Wasn't Present" },
    ),
  },
  set_inbox_conversation_status: {
    branches: conversationActionOutcomes(
      { id: "updated", label: "Updated" },
      { id: "already_in_status", label: "Already In Status" },
    ),
  },
  mark_inbox_conversation_read: {
    branches: conversationActionOutcomes(
      { id: "updated", label: "Updated" },
      { id: "already_in_state", label: "Already In State" },
    ),
  },
  create_inbox_conversation_note: {
    branches: [
      { id: "note_created", label: "Note Created" },
      CONVERSATION_MISSING,
      { id: "failed", label: "Failed" },
    ],
  },
  set_contact_opt_in_status: {
    branches: [
      { id: "updated", label: "Updated" },
      { id: "not_allowed", label: "Not Allowed" },
      { id: "no_consent_evidence", label: "No Consent Evidence" },
      { id: "failed", label: "Failed" },
    ],
  },
  delete_contact: {
    branches: [
      { id: "deleted", label: "Deleted" },
      { id: "not_found", label: "Already Deleted / Not Found" },
      { id: "failed", label: "Failed" },
    ],
  },
  end_automation: { terminal: true },

  // —— Conditions ——
  condition_contact_on_list: { branches: YES_NO },
  condition_contact_segment: { branches: YES_NO },
  condition_general_link_clicked: { branches: YES_NO },
  condition_workflow_message_clicked: { branches: YES_NO },
  condition_inbox_assignee: {
    branches: [...YES_NO, CONVERSATION_MISSING],
  },
  condition_inbox_tags: { branches: [...YES_NO, CONVERSATION_MISSING] },
  condition_inbox_status: { branches: [...YES_NO, CONVERSATION_MISSING] },
  condition_inbox_unread: { branches: [...YES_NO, CONVERSATION_MISSING] },
  condition_sms_opt_in_status: {
    branches: [
      { id: "subscribed", label: "Subscribed" },
      { id: "pending", label: "Pending" },
      { id: "not_subscribed", label: "Not Subscribed" },
      { id: "unsubscribed", label: "Unsubscribed" },
      { id: "blocked", label: "Blocked" },
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  condition_has_ever_unsubscribed: { branches: YES_NO },
  condition_message_sentiment: {
    branches: [
      { id: "positive", label: "Positive" },
      { id: "negative", label: "Negative" },
      { id: "neutral", label: "Neutral" },
      { id: "mixed", label: "Mixed" },
      { id: "unknown", label: "Unknown" },
    ],
  },
  condition_workflow_status: {
    branches: [
      { id: "not_started", label: "Not Started" },
      { id: "in_progress", label: "In Progress" },
      { id: "finished", label: "Finished" },
    ],
  },
  condition_business_hours: { branches: YES_NO },
  condition_cart_status: { branches: YES_NO },
  condition_cart_value: { branches: YES_NO },
  condition_order_status: { branches: YES_NO },
  condition_order_value: { branches: YES_NO },
  condition_average_order_value: { branches: YES_NO },
  condition_order_count: { branches: YES_NO },
  condition_cart_items: { branches: YES_NO },
  condition_order_items: { branches: YES_NO },
  condition_product_viewed: { branches: YES_NO },

  // —— Event waits ——
  wait_for_reply: {
    branches: [
      { id: "reply_received", label: "Reply Received" },
      { id: "email_found", label: "Email Found" },
      { id: "reply_no_email", label: "Reply Received — No Email" },
      { id: "keyword_matched", label: "Keyword Matched" },
      { id: "different_reply", label: "Different Reply" },
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
      { id: "other_reply", label: "Other Reply" },
      { id: "no_reply", label: "No Reply" },
    ],
  },
  wait_for_link_click: {
    branches: [
      { id: "clicked", label: "Clicked" },
      { id: "timed_out", label: "Timed Out" },
    ],
  },
  wait_for_workflow_message_click: {
    branches: [
      { id: "clicked", label: "Clicked" },
      { id: "timed_out", label: "Timed Out" },
    ],
  },
  wait_for_customer_field_change: {
    branches: [
      { id: "condition_met", label: "Condition Met" },
      { id: "timed_out", label: "Timed Out" },
    ],
  },

  // —— Legacy blocks (for dynamic handle rendering) ——
  condition: { branches: YES_NO },
  condition_customer_field: { branches: YES_NO },
  condition_review_status: { branches: YES_NO },
  condition_message_status: { branches: YES_NO },
  condition_tag: { branches: YES_NO },
  condition_has_responded: { branches: YES_NO },
  wait_for_call_result: {
    branches: [
      { id: "default", label: "Default" },
      { id: "completed", label: "Completed" },
      { id: "failed", label: "Failed" },
      { id: "no_answer", label: "No Answer" },
      { id: "booked", label: "Booked" },
      { id: "answered", label: "Answered" },
      { id: "transferred", label: "Transferred" },
      { id: "voicemail", label: "Voicemail" },
      { id: "busy", label: "Busy" },
    ],
  },
};

/** Build split_traffic outcomes from config (2–6 paths). */
export function splitTrafficOutcomes(config: Record<string, unknown>): BlockOutcome[] {
  const pathCount = Math.min(6, Math.max(2, Number(config.pathCount || 2)));
  const labels = Array.isArray(config.pathLabels)
    ? (config.pathLabels as string[])
    : [];
  const percentages = Array.isArray(config.percentages)
    ? (config.percentages as number[])
    : [];
  const even = Math.floor(100 / pathCount);
  const outcomes: BlockOutcome[] = [];
  for (let i = 0; i < pathCount; i++) {
    const letter = String.fromCharCode(65 + i);
    const label = labels[i]?.trim() || `Version ${letter}`;
    const pct = percentages[i] ?? (i === pathCount - 1 ? 100 - even * (pathCount - 1) : even);
    outcomes.push({
      id: `path_${letter.toLowerCase()}`,
      label,
      hint: `${pct}%`,
    });
  }
  return outcomes;
}

export function getBlockOutcomes(
  blockType: string,
  config?: Record<string, unknown>,
): BlockOutcome[] {
  if (blockType === "split_traffic") {
    return [...splitTrafficOutcomes(config || {}), { id: "failed", label: "Failed" }];
  }
  const def = BLOCK_OUTCOMES[blockType];
  if (!def) {
    if (blockType === "end_automation") return [];
    return [{ id: "default", label: "Next" }];
  }
  if (def.terminal) return [];
  if (def.branches?.length) return def.branches;
  if (def.single) return [def.single];
  return [{ id: "default", label: "Next" }];
}

export function isTerminalBlock(blockType: string): boolean {
  return blockType === "end_automation" || BLOCK_OUTCOMES[blockType]?.terminal === true;
}

export function isMultiOutcomeBlock(blockType: string, config?: Record<string, unknown>): boolean {
  const outcomes = getBlockOutcomes(blockType, config);
  return outcomes.length > 1;
}
