export type CustomerActivityItem = {
  id: string;
  label: string;
  at: string;
  sortMs: number;
};

type CallTimestamps = {
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
};

type VoiceEvent = {
  id: string;
  eventType: string;
  createdAt: string;
  payload?: unknown;
};

type ToolExecution = {
  id: string;
  status?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  toolType?: string | null;
  input?: unknown;
  output?: unknown;
};

type Transfer = {
  id: string;
  status?: string | null;
  destination?: string | null;
  createdAt?: string;
  completedAt?: string | null;
};

type Recording = {
  id: string;
  status?: string | null;
  createdAt?: string;
};

function isoMs(iso?: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function fmtActivityTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toolTypeOf(exec: ToolExecution): string {
  const direct = String(exec.toolType || "").toLowerCase();
  if (direct) return direct;
  const input = exec.input && typeof exec.input === "object" ? (exec.input as Record<string, unknown>) : {};
  const fromInput = String(input.toolName || input.name || "").toLowerCase();
  if (fromInput) return fromInput;
  const output = exec.output && typeof exec.output === "object" ? (exec.output as Record<string, unknown>) : {};
  return String(output.toolName || "").toLowerCase();
}

function labelForTool(exec: ToolExecution): string | null {
  const t = toolTypeOf(exec);
  if (!t) return null;
  if (t.includes("book") && !t.includes("link")) {
    return exec.status === "failed" || exec.errorMessage ? "Booking could not be completed" : "Appointment booked";
  }
  if (t.includes("submit_appointment") || t.includes("appointment_request")) {
    return "Appointment request submitted";
  }
  if (t.includes("send") && t.includes("link")) {
    return "Booking link sent";
  }
  if (t.includes("transfer")) {
    return exec.status === "failed" || exec.errorMessage ? "Transfer attempted" : "Transfer completed";
  }
  if (t.includes("callback") || t.includes("message")) {
    return "Callback requested";
  }
  return null;
}

const CUSTOMER_EVENT_LABELS: Record<string, string> = {
  "call.answered": "Caller connected",
  "call.initiated": "Call started",
  "call.ringing": "Call ringing",
  "inbound.routed": "Call connected",
  "transfer.native_status": "Transfer updated",
  "transfer.completed": "Transfer completed",
  "transfer.failed": "Transfer attempted",
  "inbound.voicemail": "Voicemail detected",
};

function labelForEvent(eventType: string): string | null {
  const key = eventType.toLowerCase();
  if (CUSTOMER_EVENT_LABELS[key]) return CUSTOMER_EVENT_LABELS[key];
  if (key.startsWith("transfer.")) {
    if (key.includes("complete") || key.includes("answered")) return "Transfer completed";
    if (key.includes("fail")) return "Transfer attempted";
    return "Transfer attempted";
  }
  if (key.startsWith("texml.")) return null;
  if (key.startsWith("media.")) return null;
  if (key.includes("tool_webhook")) return null;
  if (key === "every_call") return null;
  if (key.includes("workflow")) return null;
  return null;
}

function dedupeByLabelAndMinute(items: CustomerActivityItem[]): CustomerActivityItem[] {
  const seen = new Set<string>();
  const out: CustomerActivityItem[] = [];
  for (const item of items) {
    const bucket = Math.floor(item.sortMs / 60_000);
    const key = `${item.label}@${bucket}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildCustomerActivityFeed(input: {
  call: CallTimestamps & {
    appointmentBooked?: boolean;
    transferred?: boolean;
  };
  events?: VoiceEvent[];
  toolExecutions?: ToolExecution[];
  transfers?: Transfer[];
  recordings?: Recording[];
  callbackRequest?: { requestedAt: string } | null;
  demoItems?: CustomerActivityItem[];
}): CustomerActivityItem[] {
  if (input.demoItems?.length) {
    return [...input.demoItems].sort((a, b) => a.sortMs - b.sortMs);
  }

  const items: CustomerActivityItem[] = [];

  if (input.call.startedAt) {
    items.push({
      id: "call-started",
      label: "Call started",
      at: fmtActivityTime(input.call.startedAt),
      sortMs: isoMs(input.call.startedAt),
    });
  }
  if (input.call.answeredAt) {
    items.push({
      id: "call-answered",
      label: "Caller connected",
      at: fmtActivityTime(input.call.answeredAt),
      sortMs: isoMs(input.call.answeredAt),
    });
  }

  for (const ev of input.events || []) {
    const label = labelForEvent(ev.eventType);
    if (!label) continue;
    items.push({
      id: `ev-${ev.id}`,
      label,
      at: fmtActivityTime(ev.createdAt),
      sortMs: isoMs(ev.createdAt),
    });
  }

  for (const exec of input.toolExecutions || []) {
    const label = labelForTool(exec);
    if (!label) continue;
    const atIso = exec.completedAt || exec.createdAt;
    if (!atIso) continue;
    items.push({
      id: `tool-${exec.id}`,
      label,
      at: fmtActivityTime(atIso),
      sortMs: isoMs(atIso),
    });
  }

  for (const tr of input.transfers || []) {
    const failed = String(tr.status || "").toLowerCase().includes("fail");
    const atIso = tr.completedAt || tr.createdAt;
    if (!atIso) continue;
    items.push({
      id: `xfer-${tr.id}`,
      label: failed ? "Transfer attempted" : "Transfer completed",
      at: fmtActivityTime(atIso),
      sortMs: isoMs(atIso),
    });
  }

  if (input.callbackRequest?.requestedAt) {
    items.push({
      id: "callback",
      label: "Callback requested",
      at: fmtActivityTime(input.callbackRequest.requestedAt),
      sortMs: isoMs(input.callbackRequest.requestedAt),
    });
  }

  if (input.call.appointmentBooked) {
    const atIso = input.call.endedAt || input.call.startedAt;
    if (atIso) {
      items.push({
        id: "appointment-booked-flag",
        label: "Appointment booked",
        at: fmtActivityTime(atIso),
        sortMs: isoMs(atIso) + 1,
      });
    }
  }

  const recording = (input.recordings || []).find((r) => r.status && r.status !== "pending");
  if (recording?.createdAt && String(recording.status).toLowerCase() === "ready") {
    items.push({
      id: `rec-${recording.id}`,
      label: "Recording ready",
      at: fmtActivityTime(recording.createdAt),
      sortMs: isoMs(recording.createdAt),
    });
  }

  if (input.call.endedAt) {
    items.push({
      id: "call-ended",
      label: "Call ended",
      at: fmtActivityTime(input.call.endedAt),
      sortMs: isoMs(input.call.endedAt),
    });
  }

  return dedupeByLabelAndMinute(items).sort((a, b) => a.sortMs - b.sortMs);
}

export function formatCallCostCents(costCents: number | null | undefined): string | null {
  if (costCents == null || costCents <= 0) return null;
  return `$${(costCents / 100).toFixed(2)}`;
}

export function formatTelephonyProviderLabel(
  recordingProvider?: string | null,
): string | null {
  const p = String(recordingProvider || "").trim().toLowerCase();
  if (p === "telnyx") return "Telnyx";
  if (p === "twilio") return "Twilio";
  if (!p) return null;
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export type ArtifactPipelineState = "ready" | "processing" | "unavailable" | "failed";

export function recordingPipelineState(input: {
  recordings: Array<{ status?: string | null }>;
  callHistoryRecordingStatus?: string | null;
}): ArtifactPipelineState {
  const rec = input.recordings[0];
  const status = String(rec?.status || input.callHistoryRecordingStatus || "").toLowerCase();
  if (rec && (status === "ready" || status === "completed" || rec.status === "ready")) return "ready";
  if (status === "failed" || status === "error") return "failed";
  if (status === "recording" || status === "processing" || status === "pending") return "processing";
  if (rec) return "processing";
  return "unavailable";
}

export function transcriptPipelineState(input: {
  segmentsCount: number;
  transcripts: Array<{ status?: string | null }>;
}): ArtifactPipelineState {
  if (input.segmentsCount > 0) return "ready";
  const status = String(input.transcripts[0]?.status || "").toLowerCase();
  if (status === "failed" || status === "error") return "failed";
  if (status === "pending" || status === "processing") return "processing";
  return "unavailable";
}

export function summaryPipelineState(input: {
  summary?: string | null;
  insights: Array<{ status?: string | null }>;
  callEnded: boolean;
}): ArtifactPipelineState {
  if (input.summary?.trim()) return "ready";
  const status = String(input.insights[0]?.status || "").toLowerCase();
  if (status === "failed" || status === "error") return "failed";
  if (!input.callEnded) return "processing";
  if (status === "pending" || status === "processing") return "processing";
  return "unavailable";
}
