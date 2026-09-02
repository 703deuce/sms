import type { MassTextConversationProductSource } from "@/lib/mass-texting/constants";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";

export type InboxListFilters = {
  product?: MassTextConversationProductSource | "all";
  phoneNumberId?: string;
  campaignId?: string;
  contactId?: string;
  unread?: boolean;
  filter?: string;
  assigneeId?: string | null;
  status?: "OPEN" | "PENDING" | "CLOSED" | "SNOOZED" | "SPAM";
  tag?: string;
  q?: string;
};

export function parseInboxSearchParams(
  searchParams: URLSearchParams,
): InboxListFilters {
  const productRaw = searchParams.get("product");
  const product =
    productRaw === "mctb" ||
    productRaw === "mass_text" ||
    productRaw === "manual" ||
    productRaw === "automation"
      ? productRaw
      : productRaw === "all" || !productRaw
        ? "all"
        : undefined;

  return {
    product: product ?? "all",
    phoneNumberId: searchParams.get("phoneNumberId") || undefined,
    campaignId: searchParams.get("campaignId") || undefined,
    contactId: searchParams.get("contactId") || undefined,
    unread: searchParams.get("unread") === "1" || searchParams.get("unread") === "true",
    filter: searchParams.get("filter") || undefined,
    assigneeId: searchParams.get("assigneeId") || undefined,
    status: parseStatusParam(searchParams.get("status")),
    tag: searchParams.get("tag") || undefined,
    q: searchParams.get("q")?.trim() || undefined,
  };
}

function parseStatusParam(raw: string | null): InboxListFilters["status"] | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s === "open") return "OPEN";
  if (s === "pending") return "PENDING";
  if (s === "closed" || s === "archived") return "CLOSED";
  if (s === "snoozed") return "SNOOZED";
  if (s === "spam") return "SPAM";
  return undefined;
}

export function buildConversationWhere(
  workspaceId: string,
  filters: InboxListFilters,
  userId?: string,
) {
  const where: Record<string, unknown> = { workspaceId };

  if (filters.product && filters.product !== "all") {
    where.productSource = appProductSourceToPrisma(filters.product);
  }
  if (filters.phoneNumberId) where.phoneNumberId = filters.phoneNumberId;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.unread) where.unread = true;
  if (filters.status) where.status = filters.status;

  const legacy = filters.filter;
  if (legacy === "unassigned") where.assigneeId = null;
  if (legacy === "unread") where.unread = true;
  if (legacy === "archived") where.status = "CLOSED";
  if (legacy === "mine" && userId) where.assigneeId = userId;
  if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.tag) where.tags = { has: filters.tag };

  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { contact: { firstName: { contains: q, mode: "insensitive" } } },
      { contact: { lastName: { contains: q, mode: "insensitive" } } },
      { contact: { phone: { contains: q } } },
      { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
    ];
  }

  return where;
}
