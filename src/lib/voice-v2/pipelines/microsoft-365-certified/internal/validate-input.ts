import type { VoiceV2FindAvailabilityInput, VoiceV2TimeWindow } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function parseLocalTime(value: string): { hour: number; minute: number } | null {
  const m = String(value).trim().match(TIME_RE);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function validateVoiceV2FindAvailabilityInput(
  raw: Record<string, unknown>,
  resolvedWorkspaceId: string,
): VoiceV2FindAvailabilityInput {
  const workspaceId = resolvedWorkspaceId.trim();
  if (!workspaceId) throw new Error("workspace_id_required");

  const requestedDate = String(raw.requested_date || raw.requestedDate || "").trim();
  if (!DATE_RE.test(requestedDate)) {
    throw new Error("requested_date_invalid");
  }

  const twRaw = (raw.time_window || raw.timeWindow || {}) as Record<string, unknown>;
  const start = String(twRaw.start || "12:00").trim();
  const end = String(twRaw.end || "17:00").trim();
  const startParts = parseLocalTime(start);
  const endParts = parseLocalTime(end);
  if (!startParts || !endParts) {
    throw new Error("time_window_invalid");
  }
  if (startParts.hour * 60 + startParts.minute >= endParts.hour * 60 + endParts.minute) {
    throw new Error("time_window_start_must_be_before_end");
  }

  const timeWindow: VoiceV2TimeWindow = { start, end };
  const callId = raw.call_id || raw.callId ? String(raw.call_id || raw.callId) : null;

  return {
    workspaceId,
    callId,
    requestedDate,
    timeWindow,
    serviceName: raw.service_name ? String(raw.service_name) : null,
    maxSlots: raw.max_slots ? Number(raw.max_slots) : undefined,
  };
}
