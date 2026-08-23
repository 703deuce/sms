import type { DraftConfig } from "./types";

export const SR_PURPLE = "#6366f1";

export const FLOW_TYPE_LABELS: Record<string, string> = {
  phone_menu: "Phone Menu",
  missed_call_recovery: "Missed Call Recovery",
  after_hours: "After-Hours Routing",
  department: "Department Routing",
  call_gate: "Call Screening",
  custom: "Custom Flow",
};

export const FLOW_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  testing: "Testing",
  paused: "Paused",
  needs_attention: "Needs Attention",
};

export function fmtPhoneDisplay(e164: string | null | undefined): string {
  if (!e164) return "—";
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return e164;
}

export function fmtRelativeTime(value: string | Date): string {
  const d = new Date(value);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}

export function fmtDurationMmSs(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtDurationMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  return fmtDurationMmSs(Math.round(ms / 1000));
}

export function derivePrimaryDestination(
  draft: DraftConfig | null | undefined,
  type?: string,
): string {
  if (!draft) return "—";
  const labels = (draft.menuOptions ?? []).map((o) => o.label).filter(Boolean);
  if (labels.length) return labels.slice(0, 2).join(" + ");
  const ai = draft.nodes?.find((n) => n.type === "AI_RECEPTIONIST");
  if (ai?.config?.agentName) return String(ai.config.agentName);
  if (type === "missed_call_recovery") return "Text Recovery";
  const ring = draft.nodes?.find((n) => n.type === "RING_GROUP");
  if (ring?.config?.label) return String(ring.config.label);
  return "—";
}

export function audioSourceLabel(sourceType: string): string {
  const map: Record<string, string> = {
    elevenlabs: "AI Generated",
    recording: "Recorded in Transovo",
    upload: "Uploaded Recording",
    telnyx_tts: "Telnyx TTS Draft",
  };
  return map[sourceType] ?? sourceType.replace(/_/g, " ");
}

const SMART_ROUTING_STATIC_SEGMENTS = new Set([
  "new",
  "audio",
  "setup",
  "ai",
  "flows",
  "destinations",
  "hours",
  "callback",
  "activity",
]);

export function smartRoutingFlowIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/smart-routing\/([^/]+)/);
  if (!match) return null;
  const id = match[1];
  if (SMART_ROUTING_STATIC_SEGMENTS.has(id)) return null;
  return id;
}

export function isSmartRoutingSectionPath(pathname: string): boolean {
  return pathname === "/smart-routing" || pathname.startsWith("/smart-routing/");
}
