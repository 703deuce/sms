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

export async function fetchRingingInbound() {
  return parse<{
    humanCallId: string;
    fromE164: string;
    callerName: string | null;
    startedAt: string;
  } | null>(await fetch("/api/phone/calls/ringing-inbound"));
}

export async function startCallRecording(humanCallId: string) {
  return parse<{ started: boolean; reason: string }>(
    await fetch(`/api/phone/calls/${encodeURIComponent(humanCallId)}/recording/start`, {
      method: "POST",
      headers: mutatingHeaders(),
    }),
  );
}

/** Outbound WebRTC: Telnyx call_control_id often arrives after the browser is live. */
export async function startCallRecordingWhenReady(humanCallId: string) {
  const delaysMs = [0, 1500, 4000, 8000];
  for (let i = 0; i < delaysMs.length; i++) {
    if (delaysMs[i] > 0) {
      await new Promise((r) => setTimeout(r, delaysMs[i]));
    }
    try {
      const result = await startCallRecording(humanCallId);
      if (result.started) return result;
      if (result.reason === "already_recording" || result.reason === "call_ended") return result;
    } catch {
      // retry until delays exhausted
    }
  }
  return { started: false, reason: "no_control_id" };
}

export async function fetchCallRecordingUrl(callId: string): Promise<string> {
  const data = await parse<{ url: string }>(
    await fetch(`/api/phone/calls/${encodeURIComponent(callId)}/recording`),
  );
  if (!data.url) throw new Error("No recording");
  return data.url;
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

export async function finalizeWebRtcClientHangup(body: {
  humanCallId: string;
  wasAnswered?: boolean;
  failed?: boolean;
}) {
  const res = await fetch("/api/phone/calls", {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "webrtc_finalize", ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data as { ok: boolean; skipped?: boolean };
}

export async function fetchRouting() {
  return parse<RoutePolicyDto>(await fetch("/api/phone/routing"));
}

export async function fetchBusinessHours() {
  return parse<{ timezone: string; hours: unknown }>(await fetch("/api/phone/routing?part=hours"));
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

/** Save routing policy and/or workspace business hours (same API). */
export async function savePhoneRoutingAndHours(body: Record<string, unknown>) {
  return saveRouting(body);
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

export async function deleteContactApi(contactId: string) {
  return parse<{ action: string; reason?: string }>(
    await fetch(`/api/contacts/${contactId}`, { method: "DELETE" }),
  );
}

export async function fetchContactsPage(params: { q?: string; page?: number; pageSize?: number }) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return parse<{
    total: number;
    page: number;
    pageSize: number;
    contacts: {
      id: string;
      name: string;
      phone: string;
      email: string | null;
      company: string | null;
      status: string;
      createdAt: string;
      updatedAt: string;
    }[];
  }>(await fetch(`/api/contacts?${q}`));
}

export async function searchContactsApi(q: string) {
  return parse<{ id: string; name: string; phone: string; status?: string }[]>(
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
  dialingMode?: string;
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
  campaignUsage?: { id: string; name: string }[];
};

export type PowerDialerOverviewDto = {
  kpis: {
    attemptsToday: number;
    humanConversations: number;
    answerRate: number;
    talkSec: number;
    sessionsToday: number;
    callbacksDue: number;
    outboundCallsToday: number;
  };
  campaigns: {
    id: string;
    name: string;
    status: string;
    listName: string;
    completedPct: number;
    attemptedCount: number;
    totalContacts: number;
  }[];
  listCount: number;
  activeSession: {
    id: string;
    status: string;
    campaignId: string;
    campaignName: string;
  } | null;
  recentActivity: {
    id: string;
    disposition: string | null;
    status: string;
    createdAt: string;
    contactName: string;
    contactPhone: string;
    campaignName: string;
  }[];
  attentionRequired?: { code: string; message: string }[];
};

export type PowerDialerCallbackDto = {
  id: string;
  callbackAt: string | null;
  disposition: string | null;
  notes: string | null;
  status: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  company: string | null;
  contactStatus: string;
  campaignId: string;
  campaignName: string;
  timezone: string;
  assignedUserId?: string | null;
  visibility?: string;
  priority?: number;
  source?: string | null;
  routingPool?: string | null;
  overdue?: boolean;
};

export async function fetchPowerDialerOverview() {
  return parse<PowerDialerOverviewDto>(await fetch("/api/phone/power-dialer/overview"));
}

export async function fetchPowerDialerCallbacks(tab: string) {
  return parse<PowerDialerCallbackDto[]>(
    await fetch(`/api/phone/power-dialer/callbacks?tab=${encodeURIComponent(tab)}`),
  );
}

export async function patchPowerDialerCallback(
  id: string,
  body: {
    action?: "complete" | "cancel" | "reschedule";
    scheduledAt?: string;
    assignedUserId?: string;
    notes?: string;
  },
) {
  return parse(
    await fetch(`/api/phone/power-dialer/callbacks/${id}`, {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export type PowerDialerCallbackEligibility = {
  eligible: boolean;
  bucket: string;
  reason: string;
  message: string;
  retryEligibleAt: string | null;
};

export async function fetchPowerDialerCallbackEligibility(callbackId: string) {
  return parse<PowerDialerCallbackEligibility>(
    await fetch(`/api/phone/power-dialer/callbacks/${callbackId}/eligibility`),
  );
}

export async function addListContactsToCampaign(
  listId: string,
  campaignId: string,
  contactIds: string[],
) {
  return parse<{ added: number }>(
    await fetch(`/api/phone/power-dialer/lists/${listId}/campaign-actions`, {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ campaignId, contactIds }),
    }),
  );
}

export type DialerPrepDto = {
  dispositionLabels: string[];
  scriptRendered: string | null;
  voicemailDropId: string | null;
  voicemailDropName: string | null;
};

export async function fetchDialerPrep(campaignId: string, contactId: string) {
  return parse<DialerPrepDto>(
    await fetch(
      `/api/phone/power-dialer/campaigns/${campaignId}/dialer-prep?contactId=${encodeURIComponent(contactId)}`,
    ),
  );
}

export async function fetchPowerDialerSettings() {
  return parse<import("@/lib/products/power-dialer").PowerDialerWorkspaceSettings>(
    await fetch("/api/phone/power-dialer/settings"),
  );
}

export async function patchPowerDialerSettings(
  patch: Partial<import("@/lib/products/power-dialer").PowerDialerWorkspaceSettings>,
) {
  return parse<import("@/lib/products/power-dialer").PowerDialerWorkspaceSettings>(
    await fetch("/api/phone/power-dialer/settings", {
      method: "PATCH",
      headers: mutatingHeaders(),
      body: JSON.stringify(patch),
    }),
  );
}

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

export async function startPowerSession(campaignId: string, focusContactId?: string) {
  return parse<{ id: string; status: string; campaignId: string }>(
    await fetch("/api/phone/power-dialer/sessions", {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ campaignId, focusContactId: focusContactId || undefined }),
    }),
  );
}

export type PowerSessionStateDto = {
  next: {
    contact: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      phone: string;
      company: string | null;
      customFields?: Record<string, unknown> | null;
      timezone?: string | null;
    };
    attemptNumber: number;
    campaign: { id: string; callerIdE164: string; name: string; configJson: unknown };
    sessionId: string;
  } | null;
  session: {
    id: string;
    status: string;
    campaign: { name: string; callerIdE164: string; configJson: unknown; list: { name: string } };
  } | null;
  rules?: {
    dialingMode: string;
    postCallIntervalSeconds: number;
    requireDispositionBeforeNext: boolean;
    ringTimeoutSeconds: number;
    totalAttemptCap: number;
  };
  progression?: {
    phase: string;
    nextCallAt: string | null;
    countdownSeconds: number;
    autoDialReady: boolean;
  };
  eligibilityCounts?: Record<string, number>;
  ringTimeoutHangup?: string | null;
  emptyReasons?: { bucket: string; count: number }[];
  nextEligibleAt?: string | null;
  queueContext?: {
    activeListId: string;
    activeListName: string;
    waterfallIndex: number;
    waterfallReason: string | null;
    teamQueueMode: string;
    listChain: { id: string; name: string }[];
  };
  upcomingQueue?: {
    contactId: string;
    attemptNumber: number;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    company: string | null;
  }[];
  currentAttempt?: { id: string; status: string; disposition: string | null } | null;
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
  action:
    | "pause"
    | "resume"
    | "end"
    | "create_attempt"
    | "skip_countdown"
    | "orchestrate"
    | "reconcile"
    | "skip_contact"
    | "preview_held",
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
  body: {
    disposition: string;
    notes?: string;
    callbackAt?: string | null;
    callRating?: number | null;
  },
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

export async function transferCall(humanCallId: string, toE164: string) {
  const res = await fetch(`/api/phone/calls/${encodeURIComponent(humanCallId)}/transfer`, {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify({ to: toE164 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data as { id: string; status: string; disposition: string | null };
}

export async function transferPowerDialerAttempt(
  attemptId: string,
  input: { to: string; mode?: "cold" | "warm" | "three_way"; action?: "start" | "complete" | "cancel" },
) {
  const res = await fetch(`/api/phone/power-dialer/attempts/${encodeURIComponent(attemptId)}/transfer`, {
    method: "POST",
    headers: mutatingHeaders(),
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}

export type TransferTargetDto = { id: string; name: string; number: string };

export async function fetchTransferTargets() {
  return parse<TransferTargetDto[]>(await fetch("/api/phone/transfer-targets"));
}

export async function saveTransferTargets(targets: TransferTargetDto[]) {
  return parse<TransferTargetDto[]>(
    await fetch("/api/phone/transfer-targets", {
      method: "PUT",
      headers: mutatingHeaders(),
      body: JSON.stringify({ targets }),
    }),
  );
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

export type PowerCampaignTableRow = {
  id: string;
  name: string;
  status: string;
  listName: string;
  totalContacts: number;
  eligible: number;
  deferred: number;
  completed: number;
  suppressed: number;
  failed: number;
  rollupTruncated: boolean;
  attempts: number;
  humanConversations: number;
  lastActivity: string;
};

export async function fetchPowerCampaignTable(params?: { q?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.q) q.set("q", params.q);
  if (params?.status) q.set("status", params.status);
  return parse<PowerCampaignTableRow[]>(
    await fetch(`/api/phone/power-dialer/campaigns/table?${q}`),
  );
}

export async function fetchPowerCampaignDetail(id: string) {
  return parse<{
    id: string;
    name: string;
    description: string | null;
    listId: string;
    callerIdE164: string;
    timezone: string;
    status: string;
    rules: {
      dialingMode: string;
      ringTimeoutSeconds: number;
      retryIntervalMinutes: number;
      dailyAttemptCap: number;
      totalAttemptCap: number;
      postCallIntervalSeconds: number;
      callingHoursStart: string;
      callingHoursEnd: string;
      phoneFieldPriority: string[];
      allowedDays: number[];
      requireDispositionBeforeNext: boolean;
    };
    extended: {
      scriptId?: string | null;
      voicemailDropId?: string | null;
      dispositionSetId?: string | null;
      recordingEnabled?: boolean;
      screeningMode?: string;
      leadOwnerRouting?: string;
      leadSource?: string;
      duplicateBehavior?: string;
      memberUserIds?: string[];
    };
    configJson?: Record<string, unknown>;
    eligibility: {
      counts: Record<string, number>;
      truncated: boolean;
    };
  }>(await fetch(`/api/phone/power-dialer/campaigns/${id}`));
}

export async function savePowerCampaignDetail(id: string, body: Record<string, unknown>) {
  return parse(await fetch(`/api/phone/power-dialer/campaigns/${id}`, {
    method: "PATCH",
    headers: mutatingHeaders(),
    body: JSON.stringify(body),
  }));
}

export async function clonePowerCampaign(id: string, name?: string) {
  return parse(
    await fetch(`/api/phone/power-dialer/campaigns/${id}/clone`, {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify({ name }),
    }),
  );
}

export async function patchPowerCampaignAction(
  id: string,
  action: "archive" | "pause" | "resume",
) {
  return patchPowerCampaign(id, { action });
}

export type CampaignContactRow = {
  contactId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  bucket: string;
  reasonLabel: string;
  attemptCount: number;
  latestDisposition: string | null;
  latestStatus: string | null;
  nextCallbackAt: string | null;
  retryEligibleAt: string | null;
};

export async function fetchCampaignContacts(
  campaignId: string,
  params: { page?: number; bucket?: string },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.bucket) q.set("bucket", params.bucket);
  return parse<{ rows: CampaignContactRow[] }>(
    await fetch(`/api/phone/power-dialer/campaigns/${campaignId}/contacts?${q}`),
  );
}

export type PowerSessionSummaryDto = {
  totalAttempts: number;
  uniqueContacts: number;
  humanConversations: number;
  classifications: Record<string, number>;
  talkSec: number;
  sessionDurationSec: number;
  followUps: number;
  dispositions: Record<string, number>;
  remainingEligible: number;
  errors: number;
};

export async function fetchPowerSessionSummary(sessionId: string) {
  return parse<PowerSessionSummaryDto>(
    await fetch(`/api/phone/power-dialer/sessions/${sessionId}/summary`),
  );
}

export async function importListCsv(
  listId: string,
  body: {
    csvText: string;
    mapping: Record<string, unknown>;
    duplicateBehavior?: string;
    dryRun?: boolean;
  },
) {
  return parse(
    await fetch(`/api/phone/power-dialer/lists/${listId}/import-csv`, {
      method: "POST",
      headers: mutatingHeaders(),
      body: JSON.stringify(body),
    }),
  );
}

export type PowerListDetailDto = {
  id: string;
  name: string;
  description: string | null;
  source: string;
  filtersJson?: unknown;
  updatedAt: string;
  total: number;
  filteredTotal: number;
  page: number;
  pageSize: number;
  campaigns: { id: string; name: string; status: string }[];
  contacts: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    company: string | null;
    status: string;
  }[];
};

export async function fetchPowerListDetail(
  listId: string,
  params?: { page?: number; q?: string },
) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.q) q.set("q", params.q);
  return parse<PowerListDetailDto>(
    await fetch(`/api/phone/power-dialer/lists/${listId}?${q}`),
  );
}

export async function archivePowerList(listId: string) {
  const res = await fetch(`/api/phone/power-dialer/lists/${listId}`, {
    method: "PATCH",
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: "archive" }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export type CampaignHistorySession = {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  attemptCount: number;
  attempts: {
    id: string;
    disposition: string | null;
    status: string;
    createdAt: string;
    contactName: string;
    contactPhone: string;
  }[];
};

export async function fetchCampaignHistory(campaignId: string) {
  return parse<CampaignHistorySession[]>(
    await fetch(`/api/phone/power-dialer/campaigns/${campaignId}/history`),
  );
}

export type CampaignAnalyticsDto = {
  totalAttempts: number;
  uniqueContacts: number;
  humanConversations: number;
  talkSec: number;
  dispositions: Record<string, number>;
  answerRate: number;
};

export async function fetchCampaignAnalytics(campaignId: string) {
  return parse<CampaignAnalyticsDto>(
    await fetch(`/api/phone/power-dialer/campaigns/${campaignId}/analytics`),
  );
}

export async function patchListMembers(listId: string, action: 'add' | 'remove', contactIds: string[]) {
  const res = await fetch(`/api/phone/power-dialer/lists/${listId}/members`, {
    method: 'PATCH',
    headers: mutatingHeaders(),
    body: JSON.stringify({ action, contactIds }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json.data;
}

export async function saveListFilters(listId: string, filters: unknown[]) {
  const res = await fetch(`/api/phone/power-dialer/lists/${listId}`, {
    method: 'PATCH',
    headers: mutatingHeaders(),
    body: JSON.stringify({ action: 'save_filters', filters }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export type ContactCampaignHistoryDto = {
  attempts: { id: string; disposition: string | null; notes: string | null; createdAt: string }[];
  callbacks: { id: string; scheduledAt: string; status: string; notes: string | null }[];
};

export async function fetchContactCampaignHistory(campaignId: string, contactId: string) {
  return parse<ContactCampaignHistoryDto>(
    await fetch(
      `/api/phone/power-dialer/campaigns/${campaignId}/contact-history?contactId=${encodeURIComponent(contactId)}`,
    ),
  );
}

export async function triggerVoicemailDrop(attemptId: string) {
  return parse(
    await fetch(`/api/phone/power-dialer/attempts/${attemptId}/voicemail-drop`, {
      method: 'POST',
      headers: mutatingHeaders(),
    }),
  );
}
