import type { MassTextConversationProductSource } from "@/lib/mass-texting/constants";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";

export type InboxListFilters = {
  product?: MassTextConversationProductSource | "all";
  phoneNumberId?: string;
  campaignId?: string;
  unread?: boolean;
  filter?: string;
  assigneeId?: string | null;
  status?: "CLOSED";
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
    unread: searchParams.get("unread") === "1" || searchParams.get("unread") === "true",
    filter: searchParams.get("filter") || undefined,
  };
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
  if (filters.unread) where.unread = true;

  const legacy = filters.filter;
  if (legacy === "unassigned") where.assigneeId = null;
  if (legacy === "unread") where.unread = true;
  if (legacy === "archived") where.status = "CLOSED";
  if (legacy === "mine" && userId) where.assigneeId = userId;

  return where;
}
