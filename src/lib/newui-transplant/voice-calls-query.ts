import type { CallOutcome } from "@/newui-transplant/lib/view-models";

export type VoiceCallsFetchParams = {
  limit?: number;
  dateRange: "today" | "7d" | "30d";
  filter: CallOutcome | "all";
  q: string;
  attentionOnly: boolean;
};

export function voiceCallsApiFilter(outcome: CallOutcome | "all"): string {
  switch (outcome) {
    case "Lead":
      return "leads";
    case "Appointment":
      return "booked";
    case "Message":
      return "messages";
    case "Transfer":
      return "transferred";
    case "No Answer":
      return "no_action";
    default:
      return "all";
  }
}

export function buildVoiceCallsSearchParams(input: VoiceCallsFetchParams): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 200));
  params.set("dateRange", input.dateRange);
  params.set("filter", "all");
  params.set("test", "0");
  const apiFilter = voiceCallsApiFilter(input.filter);
  if (apiFilter !== "all") params.set("filter", apiFilter);
  const q = input.q.trim();
  if (q) params.set("q", q);
  return params;
}

export function filterCallsClientSide<T extends { outcome: CallOutcome; attention?: boolean }>(
  rows: T[],
  outcome: CallOutcome | "all",
  attentionOnly: boolean,
): T[] {
  return rows.filter((c) => {
    if (attentionOnly && !c.attention) return false;
    if (outcome === "all") return true;
    if (outcome === "Voicemail" || outcome === "Transfer") return c.outcome === outcome;
    return c.outcome === outcome;
  });
}
