/**
 * Structured console tracing for Transovo Video (Telnyx Video Rooms).
 *
 * On by default. Set VIDEO_PIPELINE_TRACE=0 to disable.
 * Grep production logs: `[video-pipeline]` or `"source":"video-pipeline"`.
 */

export type VideoPipelineLayer =
  | "meeting-room"
  | "video-client"
  | "join-api"
  | "provision";

export type VideoPipelineOutcome =
  | "ok"
  | "skip"
  | "fail"
  | "connected"
  | "disconnected"
  | "published"
  | "subscribed";

export type VideoPipelineTraceInput = {
  layer: VideoPipelineLayer;
  step: string;
  outcome?: VideoPipelineOutcome;
  reason?: string;
  roomId?: string | null;
  participantId?: string | null;
  meetingToken?: string | null;
  [key: string]: unknown;
};

export function isVideoPipelineTraceEnabled(): boolean {
  const raw = process.env.VIDEO_PIPELINE_TRACE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

function serializeError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

export function traceVideoPipeline(input: VideoPipelineTraceInput): void {
  if (!isVideoPipelineTraceEnabled()) return;
  const payload = {
    source: "video-pipeline",
    at: new Date().toISOString(),
    ...input,
  };
  console.log(`[video-pipeline] ${input.layer}:${input.step}`, JSON.stringify(payload));
}

export function traceVideoPipelineSkip(
  layer: VideoPipelineLayer,
  step: string,
  reason: string,
  fields?: Record<string, unknown>,
): void {
  traceVideoPipeline({ layer, step, outcome: "skip", reason, ...fields });
}

export function traceVideoPipelineError(
  layer: VideoPipelineLayer,
  step: string,
  err: unknown,
  fields?: Record<string, unknown>,
): void {
  if (!isVideoPipelineTraceEnabled()) return;
  const { error, stack } = serializeError(err);
  traceVideoPipeline({ layer, step, outcome: "fail", reason: error, stack, ...fields });
  console.error(`[video-pipeline] ${layer}:${step} ERROR`, error);
}

export function summarizeVideoRoomState(state: {
  status?: string;
  localParticipantId?: string;
  participants?: { size?: number } | Record<string, unknown>;
  streams?: { size?: number } | Record<string, unknown>;
  subscriptions?: { size?: number } | Record<string, unknown>;
} | null): Record<string, unknown> {
  if (!state) return { status: "null" };
  const participantCount =
    state.participants && typeof (state.participants as { size?: number }).size === "number"
      ? (state.participants as { size: number }).size
      : state.participants
        ? Object.keys(state.participants).length
        : 0;
  const streamCount =
    state.streams && typeof (state.streams as { size?: number }).size === "number"
      ? (state.streams as { size: number }).size
      : state.streams
        ? Object.keys(state.streams).length
        : 0;
  const subscriptionCount =
    state.subscriptions && typeof (state.subscriptions as { size?: number }).size === "number"
      ? (state.subscriptions as { size: number }).size
      : state.subscriptions
        ? Object.keys(state.subscriptions).length
        : 0;
  return {
    status: state.status,
    localParticipantId: state.localParticipantId,
    participantCount,
    streamCount,
    subscriptionCount,
  };
}
