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

  if (unread) filters.unread = true;
  if (filter === "mine") filters.filter = "mine";
  if (filter === "unassigned") filters.filter = "unassigned";
  if (filter === "archived" || filter === "closed") filters.filter = "archived";
  if (filter === "open") filters.status = "OPEN";
  if (filter === "pending") filters.status = "PENDING";

  const contactId =
    (typeof params.contactId === "string" && params.contactId) ||
    (typeof params.contact === "string" && params.contact) ||
    undefined;
  if (contactId) filters.contactId = contactId;

  return filters;
}
