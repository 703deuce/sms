import type { MissedCallsDateFilter, MissedCallsStatusFilter } from "@/lib/mctb/missed-calls-list-filters";

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
