import type { FilterSel } from "@/components/kimi/conversations/components/InboxRail";
import type { AppointmentMessageFilter } from "@/lib/mass-texting/inbox-filters";
import type { InboxListFilters } from "@/lib/mass-texting/inbox-filters";

export function inboxFiltersFromUrlParams(
  params: Record<string, string | string[] | undefined>,
): InboxListFilters {
  const filter = typeof params.filter === "string" ? params.filter : undefined;
  const unread =
    params.unread === "1" ||
    params.unread === "true" ||
    filter === "unread";
  const filters: InboxListFilters = { product: "all" };

  const product = typeof params.product === "string" ? params.product : undefined;
  if (
    product === "mctb" ||
    product === "mass_text" ||
    product === "manual" ||
    product === "automation"
  ) {
    filters.product = product;
  }

  if (unread) filters.unread = true;
  if (filter === "mine") filters.filter = "mine";
  if (filter === "unassigned") filters.filter = "unassigned";
  if (filter === "archived" || filter === "closed") filters.filter = "archived";
  if (filter === "open") filters.status = "OPEN";
  if (filter === "pending") filters.status = "PENDING";

  const appointmentMessageFilters: AppointmentMessageFilter[] = [
    "sms",
    "email",
    "needs_reply",
    "ai_booking",
    "unknown_replies",
  ];
  if (filter && appointmentMessageFilters.includes(filter as AppointmentMessageFilter)) {
    filters.appointmentMessageFilter = filter as AppointmentMessageFilter;
  }

  const statusParam = typeof params.status === "string" ? params.status.toLowerCase() : undefined;
  if (statusParam === "open") filters.status = "OPEN";
  if (statusParam === "pending") filters.status = "PENDING";
  if (statusParam === "closed" || statusParam === "archived") filters.status = "CLOSED";
  if (statusParam === "snoozed") filters.status = "SNOOZED";
  if (statusParam === "spam") filters.status = "SPAM";

  const tag = typeof params.tag === "string" ? params.tag : undefined;
  if (tag) filters.tag = decodeURIComponent(tag);

  const q = typeof params.q === "string" ? params.q.trim() : undefined;
  if (q) filters.q = q;

  const assigneeId = typeof params.assigneeId === "string" ? params.assigneeId : undefined;
  if (assigneeId) filters.assigneeId = assigneeId;

  const contactId =
    (typeof params.contactId === "string" && params.contactId) ||
    (typeof params.contact === "string" && params.contact) ||
    undefined;
  if (contactId) filters.contactId = contactId;

  const phoneNumberId = typeof params.phoneNumberId === "string" ? params.phoneNumberId : undefined;
  if (phoneNumberId) filters.phoneNumberId = phoneNumberId;

  const campaignId = typeof params.campaignId === "string" ? params.campaignId : undefined;
  if (campaignId) filters.campaignId = campaignId;

  // Default: all conversations (no assignee filter). "mine" is only applied when filter=mine.

  return filters;
}

export function filterSelFromUrlParams(
  params: Record<string, string | string[] | undefined>,
): FilterSel {
  const filter = typeof params.filter === "string" ? params.filter : undefined;
  const unread =
    params.unread === "1" ||
    params.unread === "true" ||
    filter === "unread";
  const status =
    typeof params.status === "string" ? params.status.toLowerCase() : undefined;
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  const assigneeId = typeof params.assigneeId === "string" ? params.assigneeId : undefined;

  if (tag) {
    const sub =
      status === "open" || status === "pending" || status === "closed" ? status : undefined;
    return { kind: "tag", key: decodeURIComponent(tag), sub };
  }

  if (assigneeId) {
    const sub =
      status === "open" || status === "pending" ? status : undefined;
    return { kind: "teammate", key: assigneeId, sub };
  }

  if (filter === "mine") {
    if (unread) return { kind: "mine", key: "unread" };
    if (status === "open" || status === "pending") return { kind: "mine", key: status };
    return { kind: "mine", key: "all" };
  }

  if (filter === "all") return { kind: "all", key: "all" };
  if (filter === "unassigned") return { kind: "all", key: "unassigned" };
  if (unread || filter === "unread") return { kind: "all", key: "unread" };
  if (filter === "open" || status === "open") return { kind: "all", key: "open" };
  if (filter === "pending" || status === "pending") return { kind: "all", key: "pending" };
  if (filter === "archived" || filter === "closed" || status === "closed") {
    return { kind: "all", key: "closed" };
  }
  if (filter === "snoozed" || status === "snoozed") return { kind: "all", key: "snoozed" };
  if (filter === "spam" || status === "spam") return { kind: "all", key: "spam" };

  const q = typeof params.q === "string" ? params.q.trim() : undefined;
  if (q) {
    // Search is server-side; rail shows "Everyone / All"
    return { kind: "all", key: "all" };
  }

  return { kind: "all", key: "all" };
}

export function filterSelToSearchParams(
  sel: FilterSel,
  existing?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(existing?.toString() ?? "");
  params.delete("filter");
  params.delete("unread");
  params.delete("status");
  params.delete("tag");
  params.delete("assigneeId");
  // Preserve `q` — managed by the search box debounce, not rail selection.

  if (sel.kind === "mine") {
    params.set("filter", "mine");
    if (sel.key === "unread") params.set("unread", "1");
    if (sel.key === "open" || sel.key === "pending") params.set("status", sel.key);
  } else if (sel.kind === "all") {
    if (sel.key === "all") params.set("filter", "all");
    else if (sel.key === "unassigned") params.set("filter", "unassigned");
    else if (sel.key === "unread") {
      params.set("filter", "unread");
      params.set("unread", "1");
    } else if (sel.key === "open" || sel.key === "pending") params.set("filter", sel.key);
    else if (sel.key === "closed") params.set("filter", "closed");
    else if (sel.key === "snoozed") params.set("filter", "snoozed");
    else if (sel.key === "spam") params.set("filter", "spam");
  } else if (sel.kind === "tag") {
    params.set("tag", sel.key);
    if (sel.sub) params.set("status", sel.sub);
  } else if (sel.kind === "teammate") {
    params.set("assigneeId", sel.key);
    if (sel.sub) params.set("status", sel.sub);
  }

  return params;
}
