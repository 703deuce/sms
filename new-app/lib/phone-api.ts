import type { PhoneCallDto, PhoneReadinessDto, RoutePolicyDto } from "@/lib/phone/types";

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data as T;
}

/** Browser-safe headers only — no privileged keys in client bundles. */
function mutatingHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function fetchPhoneReadiness() {
  return parse<PhoneReadinessDto>(await fetch("/api/phone/readiness"));
}

export async function fetchPhoneSettings() {
  return parse<{
    defaultCallerIdNumber: string | null;
    recordCalls: boolean;
    transcribeVoicemail: boolean;
    noiseSuppression: boolean;
  }>(await fetch("/api/phone/settings"));
}

export async function patchPhoneSettings(patch: Record<string, unknown>) {
  return parse(
    await fetch("/api/phone/settings", {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(patch),
    }),
  );
}

export async function fetchWebRtcToken() {
  return parse<{ mode: string; loginToken: string | null; error?: string }>(
    await fetch("/api/phone/webrtc-token"),
  );
}

export async function reportWebRtcPresence(registered: boolean) {
  await fetch("/api/phone/webrtc/presence", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ registered }),
  });
}

export async function fetchCalls(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const res = await fetch(`/api/phone/calls?${q}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return { data: json.data as PhoneCallDto[], total: json.meta?.total as number };
}

export async function fetchCall(id: string) {
  return parse<PhoneCallDto>(await fetch(`/api/phone/calls/${id}`));
}

export async function patchCall(id: string, patch: Record<string, unknown>) {
  return parse<PhoneCallDto>(
    await fetch(`/api/phone/calls/${id}`, {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(patch),
    }),
  );
}

export async function registerOutboundCall(body: Record<string, unknown>) {
  const res = await fetch("/api/phone/calls", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "outbound_register", ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data as { call: { id: string; from: string; to: string }; mode: string };
}

export async function linkCallControl(body: Record<string, unknown>) {
  const res = await fetch("/api/phone/calls", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "link_control", ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}

export async function fetchRouting() {
  return parse<RoutePolicyDto>(await fetch("/api/phone/routing"));
}

export async function saveRouting(body: Record<string, unknown>) {
  return parse<RoutePolicyDto>(
    await fetch("/api/phone/routing", {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export type PhoneAnalyticsDto = {
  totals: {
    calls: number;
    inbound: number;
    outbound: number;
    answered: number;
    missed: number;
    voicemail: number;
    talkSec: number;
    answerRate: number;
    avgDurationSec: number;
  };
  trend: { day: string; inbound: number; outbound: number; missed: number }[];
  hourly: { hour: string; calls: number }[];
  campaigns: {
    id: string;
    name: string;
    attemptedCount: number;
    connectedCount: number;
    completedCount: number;
    totalContacts: number;
  }[];
};

export async function fetchPhoneAnalytics(range: "7d" | "30d" | "90d") {
  return parse<PhoneAnalyticsDto>(await fetch(`/api/phone/analytics?range=${range}`));
}

export async function fetchOverviewMetrics() {
  const res = await fetch("/api/phone/analytics?range=7d");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data.totals;
}

export async function searchContactsApi(q: string) {
  return parse<{ id: string; name: string; phone: string; status: string }[]>(
    await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`),
  );
}

export type PowerCampaignDto = {
  id: string;
  name: string;
  description: string | null;
  listId: string;
  listName: string;
  callerId: string;
  status: string;
  completedPct: number;
  attempts: number;
  maxAttempts: number;
  created: string;
};

export type PowerListDto = {
  id: string;
  name: string;
  description: string | null;
  total: number;
  eligible: number;
  ineligible: number;
  source: string;
  updated: string;
};

export async function fetchPowerCampaigns() {
  return parse<PowerCampaignDto[]>(await fetch("/api/phone/power-dialer/campaigns"));
}

export async function createPowerCampaign(body: Record<string, unknown>) {
  return parse(
    await fetch("/api/phone/power-dialer/campaigns", {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function patchPowerCampaign(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/phone/power-dialer/campaigns/${id}`, {
    method: "PATCH",
    headers: mutatingHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export async function fetchPowerLists() {
  return parse<PowerListDto[]>(await fetch("/api/phone/power-dialer/lists"));
}

export async function createPowerList(name: string, description?: string) {
  return parse(
    await fetch("/api/phone/power-dialer/lists", {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function importPowerListRows(listId: string, rows: { name?: string; phone: string; company?: string }[]) {
  return parse<{ imported: number; skipped: number; errors: string[] }>(
    await fetch("/api/phone/power-dialer/lists/import", {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ listId, rows }),
    }),
  );
}

export async function startPowerSession(campaignId: string) {
  return parse<{ id: string; status: string; campaignId: string }>(
    await fetch("/api/phone/power-dialer/sessions", {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ campaignId }),
    }),
  );
}

export type PowerSessionStateDto = {
  next: {
    contact: { id: string; firstName: string | null; lastName: string | null; phone: string; company: string | null };
    attemptNumber: number;
    campaign: { id: string; callerIdE164: string; name: string; configJson: unknown };
    sessionId: string;
  } | null;
  session: {
    id: string;
    status: string;
    campaign: { name: string; callerIdE164: string; configJson: unknown; list: { name: string } };
  } | null;
  attempts?: {
    id: string;
    disposition: string | null;
    notes: string | null;
    status: string;
    attemptNumber: number;
    createdAt: string;
    contactName: string;
    contactPhone: string;
  }[];
};

export async function fetchPowerSession(sessionId: string, withAttempts = true) {
  const q = withAttempts ? "?attempts=1" : "";
  return parse<PowerSessionStateDto>(await fetch(`/api/phone/power-dialer/sessions/${sessionId}${q}`));
}

export async function powerSessionAction(
  sessionId: string,
  action: "pause" | "resume" | "end" | "create_attempt",
  extra?: Record<string, unknown>,
) {
  const res = await fetch(`/api/phone/power-dialer/sessions/${sessionId}`, {
    method: "PATCH",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action, ...extra }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}

export async function savePowerAttemptOutcome(
  attemptId: string,
  body: { disposition: string; notes?: string; callbackAt?: string | null },
) {
  return parse(
    await fetch(`/api/phone/power-dialer/attempts/${attemptId}`, {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export async function registerInboundAnswer(humanCallId: string, webrtcCallId?: string) {
  const res = await fetch("/api/phone/calls", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "inbound_answer", humanCallId, webrtcCallId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}

export async function registerInboundReject(humanCallId: string) {
  const res = await fetch("/api/phone/calls", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "inbound_reject", humanCallId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}
