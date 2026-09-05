import "server-only";

/**
 * Telnyx Meeting API (AI Notetaker — external Zoom/Meet/Teams/Webex).
 * Account access is via /v2/meeting_sessions (not beta-gated for Transovo).
 * Smoke: invalid meeting_url → 400 invalid_request proves auth + endpoint reachability.
 * Final validation: create a session with a real supported meeting URL.
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export type TelnyxMeetingSessionCreateInput = {
  meetingUrl: string;
  botName: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
  scheduledStartAt?: Date | null;
  summarizeOnEnd?: boolean;
};

export type TelnyxMeetingSessionRecord = {
  id?: string;
  status?: string;
  meeting_url?: string;
  [key: string]: unknown;
};

function meetingsWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/webhooks/telnyx/meetings`;
}

export async function telnyxCreateMeetingSession(
  input: TelnyxMeetingSessionCreateInput,
): Promise<TelnyxMeetingSessionRecord> {
  const body: Record<string, unknown> = {
    meeting_url: input.meetingUrl,
    bot_name: input.botName,
    webhook_url: meetingsWebhookUrl(),
    summarize_on_end: input.summarizeOnEnd !== false,
    metadata: input.metadata || {},
    idempotency_key: input.idempotencyKey,
  };
  if (input.scheduledStartAt) {
    body.scheduled_start_time = input.scheduledStartAt.toISOString();
  }

  const res = await telnyxRequest<{ data?: TelnyxMeetingSessionRecord }>("/meeting_sessions", {
    method: "POST",
    body,
    idempotencyKey: input.idempotencyKey,
  });
  return res?.data || {};
}

export async function telnyxGetMeetingSession(providerSessionId: string) {
  const res = await telnyxRequest<{ data?: TelnyxMeetingSessionRecord }>(
    `/meeting_sessions/${encodeURIComponent(providerSessionId)}`,
  );
  return res?.data || null;
}

export async function telnyxCancelMeetingSession(providerSessionId: string) {
  return telnyxRequest(`/meeting_sessions/${encodeURIComponent(providerSessionId)}/actions/cancel`, {
    method: "POST",
    body: {},
  });
}

export async function telnyxUpdateMeetingSession(
  providerSessionId: string,
  patch: { meeting_url?: string; scheduled_start_time?: string },
) {
  return telnyxRequest(`/meeting_sessions/${encodeURIComponent(providerSessionId)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function telnyxFetchMeetingTranscript(
  providerSessionId: string,
  after = 0,
  limit = 500,
) {
  const res = await telnyxRequest<{ data?: unknown }>(
    `/meeting_sessions/${encodeURIComponent(providerSessionId)}/transcript?after=${after}&limit=${limit}`,
  );
  return res?.data;
}

export async function telnyxFetchMeetingRecordings(providerSessionId: string) {
  const res = await telnyxRequest<{ data?: unknown }>(
    `/meeting_sessions/${encodeURIComponent(providerSessionId)}/recordings`,
  );
  return res?.data;
}

export async function telnyxRequestMeetingArtifact(
  providerSessionId: string,
  artifactType: "summary" | "action_items",
) {
  return telnyxRequest(`/meeting_sessions/${encodeURIComponent(providerSessionId)}/artifacts`, {
    method: "POST",
    body: { artifact_type: artifactType },
  });
}

export function mapTelnyxMeetingStatus(raw?: string): import("./types").MeetingSessionStatus {
  const s = String(raw || "").toLowerCase();
  if (!s) return "pending";
  if (s.includes("cancel")) return "canceled";
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("admit") || s.includes("lobby") || s.includes("waiting")) return "awaiting_admission";
  if (s === "joining" || s.includes("joining")) return "joining";
  if (s.includes("joined") && !s.includes("unjoined")) return "active";
  if (s.includes("record")) return "recording";
  if (s.includes("active") || s.includes("in_progress")) return "active";
  if (s.includes("process")) return "processing";
  if (s === "ended" || s.includes("ended")) return "ended";
  if (s.includes("complete")) return "completed";
  if (s.includes("schedule")) return "scheduled";
  return "pending";
}

/** Normalize live Telnyx Meeting API session payload into DB patch fields. */
export function mapTelnyxMeetingSessionToDbPatch(
  record: TelnyxMeetingSessionRecord,
): Record<string, unknown> {
  const status = mapTelnyxMeetingStatus(String(record.status || ""));
  const patch: Record<string, unknown> = {
    status,
    provider: String(record.provider || "telnyx"),
    providerMetadata: record,
  };
  if (record.platform) patch.meetingPlatform = String(record.platform);
  if (record.bot_name) patch.botName = String(record.bot_name);
  if (typeof record.recording === "boolean") patch.recordingEnabled = record.recording;
  if (record.joined_at) patch.actualJoinAt = new Date(String(record.joined_at));
  if (record.ended_at) patch.endedAt = new Date(String(record.ended_at));
  if (record.failure_reason) {
    patch.failureMessage = String(record.failure_reason);
    patch.status = "failed";
  }
  if (status === "active" && record.joined_at) patch.actualStartAt = new Date(String(record.joined_at));
  if (record.joined_at && record.ended_at) {
    const ms =
      new Date(String(record.ended_at)).getTime() - new Date(String(record.joined_at)).getTime();
    if (ms > 0) patch.durationSeconds = Math.round(ms / 1000);
  }
  return patch;
}
