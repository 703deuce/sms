import { recordPowerDialerDetectionEvent } from "./answer-detection-events";

export const LATENCY_MILESTONES = [
  "session_start",
  "agent_webrtc_registered",
  "agent_media_established",
  "agent_media_ready",
  "prospect_origination_requested",
  "prospect_ringing",
  "prospect_answered",
  "answer_webhook_received",
  "amd_started",
  "amd_completed",
  "screening_started",
  "screening_completed",
  "winner_claim_attempted",
  "winner_committed",
  "bridge_command_issued",
  "bridge_api_response",
  "telnyx_bridge_completed",
  "agent_audio_ready",
  "call_disconnected",
] as const;

export type LatencyMilestone = (typeof LATENCY_MILESTONES)[number];

/** Off critical path — idempotent by milestone key per attempt/session. */
export function recordLatencyMilestone(input: {
  workspaceId: string;
  milestone: LatencyMilestone;
  attemptId?: string | null;
  sessionId?: string | null;
  humanCallId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const keyParts = [
    "latency",
    input.milestone,
    input.sessionId || "no_session",
    input.attemptId || "no_attempt",
    input.humanCallId || "no_call",
  ];
  void recordPowerDialerDetectionEvent({
    workspaceId: input.workspaceId,
    attemptId: input.attemptId,
    humanCallId: input.humanCallId,
    eventType: `latency_${input.milestone}`,
    idempotencyKey: keyParts.join(":"),
    payload: {
      ...input.payload,
      recordedAt: new Date().toISOString(),
      monotonicMs: Date.now(),
    },
  }).catch(() => undefined);
}
