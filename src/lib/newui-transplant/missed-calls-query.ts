import type {
  MissedCallsDateFilter,
  MissedCallsListQuery,
  MissedCallsStatusFilter,
} from "@/lib/mctb/missed-calls-list-filters";

export type MissedCallsUiListQuery = {
  q: string;
  recovery: string;
  date: string;
  trigger: string;
  sort: string;
  page: number;
};

/** Map analytics range to the closest missed-calls date filter (list has no 90d bucket). */
export function missedCallsDateFromAnalyticsRange(range: "7d" | "30d" | "90d"): MissedCallsDateFilter {
  if (range === "7d") return "7d";
  if (range === "30d") return "30d";
  return "30d";
}

export function missedCallsListQueryToUi(query: MissedCallsListQuery): MissedCallsUiListQuery {
  const date =
    query.date === "today"
      ? "Today"
      : query.date === "7d"
        ? "Last 7 days"
        : query.date === "30d"
          ? "Last 30 days"
          : "All";
  const recovery =
    query.status === "needs_attention"
      ? "Needs attention"
      : query.status === "replied"
        ? "Replied"
        : query.status === "waiting_consent"
          ? "Waiting for consent"
          : query.status === "suppressed"
            ? "Suppressed"
            : query.status === "failed"
              ? "Failed"
              : "All";
  const triggerFromApi: Record<string, string> = {
    NO_ANSWER: "No answer",
    BUSY: "Busy",
    REJECTED: "Rejected",
    TIMEOUT: "Unreachable",
    VOICEMAIL: "Voicemail",
  };
  const trigger = query.trigger ? triggerFromApi[query.trigger] ?? "All" : "All";
  return {
    q: query.q ?? "",
    recovery,
    date,
    trigger,
    sort: query.sort === "detectedAt_asc" ? "Oldest first" : "Newest first",
    page: query.page ?? 1,
  };
}

export function missedCallsUiDateToApi(date: string): MissedCallsDateFilter {
  if (date === "Today") return "today";
  if (date === "Last 7 days") return "7d";
  if (date === "Last 30 days") return "30d";
  return "all";
}

export function missedCallsUiRecoveryToApi(recovery: string): MissedCallsStatusFilter {
  switch (recovery) {
    case "Needs attention":
      return "needs_attention";
    case "Replied":
      return "replied";
    case "Waiting for consent":
      return "waiting_consent";
    case "Suppressed":
      return "suppressed";
    case "Failed":
      return "failed";
    default:
      return "all";
  }
}

export function missedCallsUiTriggerToApi(trigger: string): string | undefined {
  if (trigger === "All") return undefined;
  const map: Record<string, string> = {
    "No answer": "NO_ANSWER",
    Busy: "BUSY",
    Rejected: "REJECTED",
    Unreachable: "TIMEOUT",
    Voicemail: "VOICEMAIL",
  };
  return map[trigger];
}

export function buildMissedCallsListUrl(input: {
  q?: string;
  recovery: string;
  date: string;
  trigger: string;
  sort: string;
  page?: number;
  pageSize?: number;
}): string {
  const params = new URLSearchParams();
  const q = input.q?.trim();
  if (q) params.set("q", q);
  const status = missedCallsUiRecoveryToApi(input.recovery);
  if (status !== "all") params.set("status", status);
  const date = missedCallsUiDateToApi(input.date);
  if (date !== "all") params.set("date", date);
  const trigger = missedCallsUiTriggerToApi(input.trigger);
  if (trigger) params.set("trigger", trigger);
  params.set("sort", input.sort === "Oldest first" ? "detectedAt_asc" : "detectedAt_desc");
  if (input.page && input.page > 1) params.set("page", String(input.page));
  if (input.pageSize) params.set("pageSize", String(input.pageSize));
  return `/api/mctb/missed-calls?${params.toString()}`;
}
