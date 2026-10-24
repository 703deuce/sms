export type MctbOverviewSnapshot = {
  masterEnabled: boolean;
  activeLines: number;
  missedToday: number;
  textsSentToday: number;
  needsReply: number;
  consentMode: string;
  recentMissed: {
    id: string;
    callerE164: string;
    status: string;
    detectedAt: string;
    smsSentAt: string | null;
  }[];
};

export type MctbMissedCallRow = {
  id: string;
  callerE164: string;
  businessE164: string;
  status: string;
  suppressionReason: string | null;
  detectedAt: string;
  smsSentAt: string | null;
  eligible: boolean;
};

export async function fetchMctbOverview(): Promise<MctbOverviewSnapshot> {
  const res = await fetch("/api/mctb/overview", { cache: "no-store" });
  const json = (await res.json()) as { ok?: boolean; error?: string; data?: MctbOverviewSnapshot };
  if (!res.ok || json.ok === false || !json.data) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data;
}

export async function fetchMctbMissedCalls(input: {
  page?: number;
  limit?: number;
  q?: string;
}): Promise<{ data: MctbMissedCallRow[]; total: number }> {
  const q = new URLSearchParams();
  if (input.page != null) q.set("page", String(input.page));
  if (input.limit != null) q.set("limit", String(input.limit));
  if (input.q) q.set("q", input.q);
  const res = await fetch(`/api/mctb/missed-calls?${q}`, { cache: "no-store" });
  const json = (await res.json()) as { ok?: boolean; error?: string; data?: MctbMissedCallRow[]; total?: number };
  if (!res.ok || json.ok === false) throw new Error(json.error || `Request failed (${res.status})`);
  return { data: json.data ?? [], total: json.total ?? 0 };
}
