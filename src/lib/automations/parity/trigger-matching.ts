/**
 * Trigger filter matching for parity native triggers.
 */

import { matchInboundMessage } from "./message-matching";

export type TriggerFilterContext = {
  tag?: string;
  formSlug?: string;
  listId?: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
  changeType?: string;
  body?: string;
  fromE164?: string;
  toE164?: string;
  phoneNumberId?: string;
  conversationId?: string;
  assigneeId?: string;
  previousAssigneeId?: string;
  fromStatus?: string;
  toStatus?: string;
  trackingToken?: string;
  messageId?: string;
  destinationUrl?: string;
  popupId?: string;
  sourceType?: string;
};

export function triggerConfigMatches(
  blockType: string,
  cfg: Record<string, unknown>,
  filters: TriggerFilterContext,
): boolean {
  switch (blockType) {
    case "customer_field_changed": {
      const field = String(cfg.field || "").trim();
      if (field && filters.field && field !== filters.field) return false;
      const changeType = String(cfg.changeType || "any");
      if (changeType === "becomes" && cfg.newValue != null) {
        if (String(filters.newValue ?? "") !== String(cfg.newValue)) return false;
      }
      if (changeType === "changes_from" && cfg.previousValue != null) {
        if (String(filters.previousValue ?? "") !== String(cfg.previousValue)) return false;
      }
      if (changeType === "becomes_empty" && filters.newValue?.trim()) return false;
      if (changeType === "becomes_non_empty" && !filters.newValue?.trim()) return false;
      return true;
    }
    case "general_link_clicked": {
      const mode = String(cfg.linkMode || "any");
      if (mode === "review") {
        // Review links still fire review_request_clicked; this is for general links.
        return true;
      }
      if (mode === "specific" && cfg.trackedLinkId) {
        return filters.trackingToken === String(cfg.trackedLinkId);
      }
      if (cfg.campaignId && filters.messageId) {
        // Loose match — campaign filtering done at emit site when available.
      }
      return true;
    }
    case "customer_added_to_list":
    case "customer_removed_from_list": {
      const mode = String(cfg.listMode || "any");
      if (mode === "any") return true;
      const ids = Array.isArray(cfg.listIds) ? (cfg.listIds as string[]) : [];
      return Boolean(filters.listId && ids.includes(filters.listId));
    }
    case "message_received": {
      const numberMode = String(cfg.receivingNumberMode || "any");
      if (numberMode === "specific" && filters.phoneNumberId) {
        const ids = Array.isArray(cfg.receivingNumberIds)
          ? (cfg.receivingNumberIds as string[])
          : [];
        if (ids.length && !ids.includes(filters.phoneNumberId)) return false;
      }
      const senderMode = String(cfg.senderMode || "any");
      if (senderMode === "unknown" && filters.fromE164) {
        // Unknown-only would need contact lookup at emit site.
      }
      const match = matchInboundMessage(filters.body || "", {
        matchType: String(cfg.matchType || "any"),
        matchValue: String(cfg.matchValue || ""),
        caseSensitive: cfg.caseSensitive === true,
      });
      return match.matched;
    }
    case "inbox_conversation_status_changed": {
      const mode = String(cfg.changeMode || "any");
      if (mode === "any") return true;
      if (cfg.fromStatus && filters.fromStatus !== String(cfg.fromStatus)) return false;
      if (cfg.toStatus && filters.toStatus !== String(cfg.toStatus)) return false;
      const statuses = Array.isArray(cfg.statuses) ? (cfg.statuses as string[]) : [];
      if (statuses.length && filters.toStatus && !statuses.includes(filters.toStatus)) {
        return false;
      }
      return true;
    }
    case "inbox_conversation_tagged":
    case "inbox_conversation_untagged": {
      const mode = String(cfg.tagMode || "any");
      if (mode === "any") return true;
      const tags = Array.isArray(cfg.tags) ? (cfg.tags as string[]) : [];
      return Boolean(filters.tag && tags.includes(filters.tag));
    }
    case "inbox_conversation_assigned": {
      const mode = String(cfg.assigneeMode || "anyone");
      if (mode === "anyone") return true;
      if (mode === "teammate" && cfg.assigneeIds) {
        const ids = Array.isArray(cfg.assigneeIds) ? (cfg.assigneeIds as string[]) : [];
        return Boolean(filters.assigneeId && ids.includes(filters.assigneeId));
      }
      if (cfg.onlyFromUnassigned && filters.previousAssigneeId) return false;
      return true;
    }
    case "inbox_conversation_unassigned":
      return true;
    case "popup_submitted": {
      const mode = String(cfg.popupMode || "any");
      if (mode !== "any" && cfg.popupId && filters.popupId !== String(cfg.popupId)) {
        return false;
      }
      if (filters.sourceType && filters.sourceType !== "popup") return false;
      return true;
    }
    case "form_submitted":
      if (filters.sourceType === "popup") return false;
      return true;
    default:
      return true;
  }
}

export const PARITY_TRIGGER_TYPES = new Set([
  "customer_field_changed",
  "general_link_clicked",
  "customer_added_to_list",
  "customer_removed_from_list",
  "message_received",
  "inbox_conversation_status_changed",
  "inbox_conversation_tagged",
  "inbox_conversation_untagged",
  "inbox_conversation_assigned",
  "inbox_conversation_unassigned",
  "contact_birthday",
  "popup_submitted",
]);

export function isParityTrigger(blockType: string): boolean {
  return PARITY_TRIGGER_TYPES.has(blockType);
}
