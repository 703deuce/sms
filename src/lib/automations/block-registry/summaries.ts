/**
 * Human-readable canvas summaries for parity blocks.
 */

import { splitTrafficOutcomes } from "./outcomes";

function joinLists(names: string[], fallback: string): string {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (!trimmed.length) return fallback;
  if (trimmed.length <= 2) return trimmed.join(", ");
  return `${trimmed.slice(0, 2).join(", ")} +${trimmed.length - 2}`;
}

function durationSummary(config: Record<string, unknown>): string {
  const weeks = Number(config.weeks || 0);
  const days = Number(config.days || 0);
  const hours = Number(config.hours || 0);
  const minutes = Number(config.minutes || 0);
  const parts: string[] = [];
  if (weeks) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} min`);
  return parts.length ? parts.join(" ") : "1 day";
}

export function parityNodeSummary(
  blockType: string,
  config: Record<string, unknown>,
  label: string,
): string | null {
  switch (blockType) {
    case "customer_field_changed": {
      const field = String(config.field || "field");
      const changeType = String(config.changeType || "any");
      if (changeType === "becomes" && config.newValue) {
        return `${field} → ${config.newValue}`;
      }
      if (changeType === "changes_from" && config.previousValue) {
        return `${field}: ${config.previousValue} → …`;
      }
      return field.replace(/_/g, " ");
    }
    case "general_link_clicked": {
      const mode = String(config.linkMode || "any");
      if (mode === "specific" && config.trackedLinkId) return "Specific link";
      if (mode === "review") return "Review link";
      return "Any tracked link";
    }
    case "customer_added_to_list":
    case "customer_removed_from_list":
    case "add_contact_to_list":
    case "remove_contact_from_list":
    case "condition_contact_on_list": {
      const ids = Array.isArray(config.listIds) ? (config.listIds as string[]) : [];
      const names = Array.isArray(config.listNames) ? (config.listNames as string[]) : [];
      const mode = String(config.listMode || (ids.length ? "specific" : "any"));
      if (mode === "any") return "Any list";
      return joinLists(names.length ? names : ids, "Selected lists");
    }
    case "message_received": {
      const match = String(config.matchType || "any");
      if (match === "any") return "Any message";
      const val = String(config.matchValue || "").trim();
      if (val) return `${match.replace(/_/g, " ")}: "${val.slice(0, 24)}${val.length > 24 ? "…" : ""}"`;
      return match.replace(/_/g, " ");
    }
    case "inbox_conversation_status_changed": {
      const to = String(config.toStatus || config.status || "");
      return to ? `→ ${to}` : "Any status change";
    }
    case "inbox_conversation_tagged":
    case "inbox_conversation_untagged":
    case "tag_inbox_conversation":
    case "untag_inbox_conversation":
    case "condition_inbox_tags": {
      const tags = Array.isArray(config.tags) ? (config.tags as string[]) : [];
      return tags.length ? joinLists(tags, "Any tag") : "Any tag";
    }
    case "inbox_conversation_assigned":
    case "assign_inbox_conversation":
    case "condition_inbox_assignee": {
      const name = String(config.assigneeName || config.teamName || "");
      return name || "Anyone";
    }
    case "contact_birthday":
      return String(config.timeOfDay || "9:00 AM");
    case "popup_submitted":
      return String(config.popupName || config.popupId || "Any popup");
    case "split_traffic": {
      const paths = splitTrafficOutcomes(config);
      return paths.map((p) => p.hint || "").filter(Boolean).join(" / ") || "50% / 50%";
    }
    case "set_inbox_conversation_status":
      return String(config.status || "Open");
    case "mark_inbox_conversation_read":
      return config.readState === "unread" ? "Unread" : "Read";
    case "set_contact_opt_in_status":
      return String(config.targetStatus || "Subscribed");
    case "delete_contact":
      return config.confirm ? "Confirmed delete" : "Requires confirmation";
    case "end_automation":
      return String(config.ejectReason || config.reason || label);
    case "wait_for_reply": {
      const match = String(config.matchType || "any");
      const max = durationSummary(config);
      const matchLabel =
        match === "email" ? "Email" : match === "any" ? "Any reply" : match.replace(/_/g, " ");
      return `${matchLabel} • Up to ${max}`;
    }
    case "wait_for_link_click":
    case "wait_for_workflow_message_click":
      return `Link click • Up to ${durationSummary(config)}`;
    case "wait_for_customer_field_change": {
      const field = String(config.field || "field");
      return `${field} • Up to ${durationSummary(config)}`;
    }
    case "condition_business_hours": {
      const check = String(config.checkType || "during");
      if (check === "during") return "During business hours";
      if (check === "outside") return "Outside business hours";
      return check.replace(/_/g, " ");
    }
    case "condition_sms_opt_in_status":
      return String(config.compareStatus || config.mode || "Compare status");
    case "condition_workflow_status": {
      const name = String(config.flowName || config.flowId || "automation");
      return name;
    }
    case "condition_message_sentiment":
      return String(config.messageScope || "Most recent inbound");
    default:
      return null;
  }
}
