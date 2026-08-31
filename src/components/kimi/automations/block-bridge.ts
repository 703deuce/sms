import { getBlock } from "@/lib/automations/catalog";
import { isConditionBlock } from "@/lib/automations/catalog";
import type { PaletteItem, PaletteKind } from "./palette-data";
import { paletteItems } from "./palette-data";

/** Kimi palette id → production blockType */
export const KIMI_ID_TO_BLOCK: Record<string, string> = {
  "t-contact-created": "customer_added",
  "t-field-changed": "customer_field_changed",
  "t-link-clicked": "general_link_clicked",
  "t-added-list": "customer_added_to_list",
  "t-removed-list": "customer_removed_from_list",
  "t-msg-received": "message_received",
  "t-convo-status": "inbox_conversation_status_changed",
  "t-convo-tagged": "inbox_conversation_tagged",
  "t-convo-untagged": "inbox_conversation_untagged",
  "t-convo-assigned": "inbox_conversation_assigned",
  "t-convo-unassigned": "inbox_conversation_unassigned",
  "t-cart-abandoned": "form_submitted",
  "a-send-message": "send_sms",
  "a-update-field": "update_customer",
  "a-delay": "wait",
  "a-add-list": "add_contact_to_list",
  "a-remove-list": "remove_contact_from_list",
  "a-split": "split_traffic",
  "a-assign": "assign_inbox_conversation",
  "a-unassign": "unassign_inbox_conversation",
  "a-tag-convo": "tag_inbox_conversation",
  "a-untag-convo": "untag_inbox_conversation",
  "a-set-status": "set_inbox_conversation_status",
  "a-mark-convo": "mark_inbox_conversation_read",
  "c-field-matches": "condition_customer_field",
  "c-on-list": "condition_contact_on_list",
  "c-segment": "condition_contact_segment",
  "c-msg-clicked": "condition_workflow_message_clicked",
  "c-link-clicked": "condition_general_link_clicked",
  "c-assignee": "condition_inbox_assignee",
  "c-convo-tags": "condition_inbox_tags",
  "c-convo-status": "condition_inbox_status",
  "c-unread": "condition_inbox_unread",
  "c-optin": "condition_sms_opt_in_status",
  "c-cart-status": "condition_cart_status",
  "c-cart-value": "condition_cart_value",
  "w-field-changed": "wait_for_customer_field_change",
  "w-msg-clicked": "wait_for_workflow_message_click",
  "w-link-clicked": "wait_for_link_click",
  "w-msg-received": "wait_for_reply",
};

const BLOCK_TO_KIMI_ID = Object.fromEntries(
  Object.entries(KIMI_ID_TO_BLOCK).map(([k, v]) => [v, k]),
) as Record<string, string>;

export function kimiIdForBlockType(blockType: string): string | undefined {
  if (BLOCK_TO_KIMI_ID[blockType]) return BLOCK_TO_KIMI_ID[blockType];
  const block = getBlock(blockType);
  if (!block) return undefined;
  const match = Object.values(paletteItems)
    .flat()
    .find((p) => p.label.toLowerCase() === block.label.toLowerCase());
  return match?.id;
}

export function blockTypeForKimiId(kimiId: string): string {
  return KIMI_ID_TO_BLOCK[kimiId] ?? "manual_enrollment";
}

export function kimiKindForBlock(blockType: string): PaletteKind {
  const block = getBlock(blockType);
  if (!block) return "action";
  if (block.category === "trigger") return "trigger";
  if (block.category === "logic" || isConditionBlock(blockType)) return "condition";
  if (blockType.startsWith("wait_for_") || blockType === "wait") return "wait";
  return "action";
}

export function paletteItemForBlockType(blockType: string): PaletteItem | undefined {
  const kimiId = kimiIdForBlockType(blockType);
  if (!kimiId) return undefined;
  return Object.values(paletteItems).flat().find((p) => p.id === kimiId);
}

export function paletteItemForKimiId(kimiId: string): PaletteItem | undefined {
  return Object.values(paletteItems).flat().find((p) => p.id === kimiId);
}
