import type { Prisma } from "@prisma/client";
import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  normalizeGlobalTablePageSize,
} from "@/lib/ui/global-data-table";

export type MissedCallsStatusFilter =
  | "all"
  | "needs_attention"
  | "replied"
  | "waiting_consent"
  | "suppressed"
  | "failed";

export type MissedCallsDateFilter = "today" | "7d" | "30d" | "all";

export type MissedCallsSort = "detectedAt_desc" | "detectedAt_asc";

export type MissedCallsListQuery = {
  q?: string;
  status?: MissedCallsStatusFilter;
  date?: MissedCallsDateFilter;
  trigger?: string;
  consentMode?: "press_1" | "existing_consent";
  page?: number;
  pageSize?: number;
  sort?: MissedCallsSort;
};

export const MISSED_CALLS_PAGE_SIZE_DEFAULT = GLOBAL_TABLE_DEFAULT_PAGE_SIZE;

export function parseMissedCallsListQuery(
  searchParams: URLSearchParams,
): MissedCallsListQuery {
  const statusParam = searchParams.get("status") as MissedCallsStatusFilter | null;
  const recoveryLegacy = searchParams.get("recovery");
  const status =
    statusParam === "needs_attention" ||
    statusParam === "replied" ||
    statusParam === "waiting_consent" ||
    statusParam === "suppressed" ||
    statusParam === "failed"
      ? statusParam
      : recoveryLegacy === "suppressed"
        ? "suppressed"
        : recoveryLegacy === "failed"
          ? "failed"
          : recoveryLegacy === "replied"
            ? "replied"
            : null;
  const dateParam = searchParams.get("date") as MissedCallsDateFilter | null;
  const rangeLegacy = searchParams.get("range");
  const date =
    dateParam === "today" || dateParam === "7d" || dateParam === "30d" || dateParam === "all"
      ? dateParam
      : rangeLegacy === "7d"
        ? "7d"
        : rangeLegacy === "30d" || rangeLegacy === "90d"
          ? "30d"
          : null;
  const consentMode = searchParams.get("consentMode") as "press_1" | "existing_consent" | null;
  const sort = searchParams.get("sort") as MissedCallsSort | null;
  const page = Number(searchParams.get("page") || "1");
  const pageSize = normalizeGlobalTablePageSize(searchParams.get("pageSize"));

  return {
    q: searchParams.get("q")?.trim() || undefined,
    status: status ?? "all",
    date: date ?? "all",
    trigger: searchParams.get("trigger")?.trim() || undefined,
    consentMode:
      consentMode === "press_1" || consentMode === "existing_consent" ? consentMode : undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize,
    sort: sort === "detectedAt_asc" ? "detectedAt_asc" : "detectedAt_desc",
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateRangeFromFilter(date: MissedCallsDateFilter): { gte?: Date } | undefined {
  if (date === "all") return undefined;
  const now = new Date();
  if (date === "today") return { gte: startOfToday() };
  const days = date === "7d" ? 7 : 30;
  const gte = new Date(now);
  gte.setDate(gte.getDate() - days);
  return { gte };
}

export function missedCallsSummaryRangeLabel(date: MissedCallsDateFilter = "all"): string {
  switch (date) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    default:
      return "All time";
  }
}

/** User-facing name for the `status` query filter (recovery / reply / consent outcomes). */
export const MISSED_CALLS_OUTCOME_FILTER_LABEL = "Recovery";

function statusWhere(status: MissedCallsStatusFilter): Prisma.MissedCallEventWhereInput | undefined {
  switch (status) {
    case "replied":
      return { status: "CUSTOMER_REPLIED" };
    case "suppressed":
      return { status: "SUPPRESSED" };
    case "failed":
      return { status: "FAILED" };
    case "waiting_consent":
      return {
        OR: [
          { suppressionReason: "NOT_EXISTING_CONSENT" },
          {
            status: { in: ["DETECTED", "ELIGIBILITY_CHECK"] },
            smsSentAt: null,
            suppressionReason: null,
          },
        ],
      };
    case "needs_attention":
      return {
        OR: [
          { status: "FAILED" },
          { status: "SUPPRESSED" },
          { suppressionReason: "NOT_EXISTING_CONSENT" },
          {
            status: "CUSTOMER_REPLIED",
          },
        ],
      };
    default:
      return undefined;
  }
}

export function buildMissedCallsListWhere(
  workspaceId: string,
  query: MissedCallsListQuery,
): Prisma.MissedCallEventWhereInput {
  const where: Prisma.MissedCallEventWhereInput = { workspaceId };

  const detectedRange = dateRangeFromFilter(query.date ?? "all");
  if (detectedRange) {
    where.detectedAt = detectedRange;
  }

  const statusFilter = statusWhere(query.status ?? "all");
  if (statusFilter) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), statusFilter];
  }

  if (query.trigger) {
    where.disposition = query.trigger;
  }

  if (query.q) {
    const digits = query.q.replace(/\D/g, "");
    const text = query.q.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          ...(digits.length >= 3 ? [{ callerE164: { contains: digits } }] : []),
          ...(text.length >= 2 ? [{ businessE164: { contains: digits || text } }] : []),
        ],
      },
    ];
  }

  return where;
}

export function missedCallsOrderBy(
  sort: MissedCallsSort = "detectedAt_desc",
): Prisma.MissedCallEventOrderByWithRelationInput {
  return { detectedAt: sort === "detectedAt_asc" ? "asc" : "desc" };
}

/** Client-side consent mode filter when stored in event metadata (API enriches rows). */
export function filterEventsByConsentMode<T extends { consentMode?: string | null }>(
  events: T[],
  consentMode?: "press_1" | "existing_consent",
): T[] {
  if (!consentMode) return events;
  return events.filter((e) => e.consentMode === consentMode);
}

export function classificationToTriggerLabel(classification: string | null | undefined): string {
  if (!classification) return "—";
  const map: Record<string, string> = {
    missed_no_answer: "No answer",
    missed_busy: "Busy",
    missed_rejected: "Rejected",
    missed_timeout: "Unreachable",
    missed_failed: "Unreachable",
    voicemail: "Voicemail",
    abandoned: "No answer",
  };
  return map[classification] || classification.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function missedCallsListSearchParams(query: MissedCallsListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status && query.status !== "all") params.set("status", query.status);
  if (query.date && query.date !== "all") params.set("date", query.date);
  if (query.trigger) params.set("trigger", query.trigger);
  if (query.consentMode) params.set("consentMode", query.consentMode);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.pageSize && query.pageSize !== MISSED_CALLS_PAGE_SIZE_DEFAULT) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.sort && query.sort !== "detectedAt_desc") params.set("sort", query.sort);
  return params;
}
