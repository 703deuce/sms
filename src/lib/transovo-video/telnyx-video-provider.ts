import "server-only";

/**
 * Telnyx Video Rooms API (Transovo Video native meetings).
 * Account access confirmed via POST /v2/rooms (201).
 * Smoke script: scripts/test-telnyx-meeting-video-api-access.ts
 */

import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { telnyxVideoWebhookUrl } from "./meeting-url";

export type TelnyxVideoRoomCreateInput = {
  uniqueName: string;
  maxParticipants: number;
  enableRecording: boolean;
  idempotencyKey?: string;
};

export type TelnyxVideoRoomRecord = {
  id: string;
  unique_name?: string;
  max_participants?: number;
  enable_recording?: boolean;
  active_session_id?: string | null;
  status?: string;
};

export type TelnyxJoinTokenResponse = {
  data?: {
    token?: string;
    refresh_token?: string;
    token_ttl_secs?: number;
    refresh_token_ttl_secs?: number;
  };
};

export async function telnyxCreateVideoRoom(
  input: TelnyxVideoRoomCreateInput,
): Promise<TelnyxVideoRoomRecord> {
  const webhookUrl = telnyxVideoWebhookUrl();
  const res = await telnyxRequest<{ data?: TelnyxVideoRoomRecord }>("/rooms", {
    method: "POST",
    body: {
      unique_name: input.uniqueName,
      max_participants: input.maxParticipants,
      enable_recording: input.enableRecording,
      webhook_event_url: webhookUrl || undefined,
      webhook_timeout_secs: 25,
    },
    idempotencyKey: input.idempotencyKey,
  });
  if (!res.data?.id) throw new Error("Telnyx room creation returned no room id");
  return res.data;
}

export async function telnyxRetrieveVideoRoom(roomId: string) {
  const res = await telnyxRequest<{ data?: TelnyxVideoRoomRecord }>(
    `/rooms/${encodeURIComponent(roomId)}`,
  );
  return res.data;
}

export async function telnyxUpdateVideoRoom(
  roomId: string,
  patch: { max_participants?: number; enable_recording?: boolean },
) {
  return telnyxRequest(`/rooms/${encodeURIComponent(roomId)}`, {
    method: "PATCH",
    body: patch,
  });
}

export async function telnyxDeleteVideoRoom(roomId: string) {
  return telnyxRequest(`/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
}

export async function telnyxGenerateJoinClientToken(
  roomId: string,
  input?: { tokenTtlSecs?: number; refreshTokenTtlSecs?: number },
): Promise<TelnyxJoinTokenResponse["data"]> {
  const res = await telnyxRequest<TelnyxJoinTokenResponse>(
    `/rooms/${encodeURIComponent(roomId)}/actions/generate_join_client_token`,
    {
      method: "POST",
      body: {
        token_ttl_secs: input?.tokenTtlSecs ?? 600,
        refresh_token_ttl_secs: input?.refreshTokenTtlSecs ?? 3600,
      },
    },
  );
  return res.data;
}

export async function telnyxRetrieveRoomSession(sessionId: string) {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/room_sessions/${encodeURIComponent(sessionId)}`,
  );
  return res.data;
}

export async function telnyxEndRoomSession(sessionId: string) {
  return telnyxRequest(`/room_sessions/${encodeURIComponent(sessionId)}/actions/end`, {
    method: "POST",
    body: {},
  });
}

export async function telnyxMuteRoomParticipants(
  sessionId: string,
  participantIds: string[],
) {
  return telnyxRequest(`/room_sessions/${encodeURIComponent(sessionId)}/actions/mute`, {
    method: "POST",
    body: { participant_ids: participantIds },
  });
}

export async function telnyxUnmuteRoomParticipants(
  sessionId: string,
  participantIds: string[],
) {
  return telnyxRequest(`/room_sessions/${encodeURIComponent(sessionId)}/actions/unmute`, {
    method: "POST",
    body: { participant_ids: participantIds },
  });
}

export async function telnyxKickRoomParticipants(
  sessionId: string,
  participantIds: string[],
) {
  return telnyxRequest(`/room_sessions/${encodeURIComponent(sessionId)}/actions/kick`, {
    method: "POST",
    body: { participant_ids: participantIds },
  });
}

export async function telnyxListRoomRecordings(sessionId: string) {
  const res = await telnyxRequest<{ data?: unknown[] }>(
    `/room_recordings?filter[session_id]=${encodeURIComponent(sessionId)}`,
  );
  return res.data || [];
}

export async function telnyxRetrieveRoomRecording(recordingId: string) {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/room_recordings/${encodeURIComponent(recordingId)}`,
  );
  return res.data;
}

export async function telnyxCreateRoomComposition(input: {
  sessionId: string;
  webhookUrl?: string;
}) {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>("/room_compositions", {
    method: "POST",
    body: {
      session_id: input.sessionId,
      format: "mp4",
      resolution: "1280x720",
      video_layout: { grid: { rows: 2, columns: 2 } },
      webhook_event_url: input.webhookUrl || telnyxVideoWebhookUrl() || undefined,
      webhook_timeout_secs: 25,
    },
  });
  return res.data;
}

export async function telnyxRetrieveRoomComposition(compositionId: string) {
  const res = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/room_compositions/${encodeURIComponent(compositionId)}`,
  );
  return res.data;
}
