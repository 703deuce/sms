import "server-only";

import { capLiveContextAppendText } from "@/lib/server/voice-v3/live/live-context-append-limits";
import type { VoiceV3LiveKitLiveContextEvent } from "@/lib/server/voice-v3/livekit/live-context";

export type SpeechReadyToolPayload = {
  ok: boolean;
  status: string;
  speech_line?: string;
  code?: string;
  message?: string;
  idempotency_key?: string;
  [key: string]: unknown;
};

export function speechLineFromToolResult(result: Record<string, unknown>): string | null {
  const direct = result.speech_line ?? result.speechLine;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  if (result.ok === true) {
    const status = String(result.status ?? "success");
    if (status === "sent" || status === "already_sent") {
      return "The booking link text was sent successfully.";
    }
    if (status === "callback_requested") {
      return "The callback request was recorded.";
    }
    if (status === "message_recorded") {
      return "The message was recorded for the team.";
    }
    if (status === "transfer_authorized" || status === "transfer_started") {
      return "The transfer is in progress.";
    }
  }
  if (result.ok === false) {
    const msg = typeof result.message === "string" ? result.message.trim() : "";
    if (msg) return `Action not completed: ${msg}`;
  }
  return null;
}

export function buildCommentaryEventsFromToolResult(
  result: Record<string, unknown>,
  delegationId?: string | null,
): VoiceV3LiveKitLiveContextEvent[] {
  const line = speechLineFromToolResult(result);
  if (!line) return [];
  return [
    {
      type: "session.commentary.append",
      content: capLiveContextAppendText(line),
      delegation_id: delegationId?.trim() || null,
    },
  ];
}
