import type { AgentSession } from "@livekit/agents";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";
import { safeInterruptSession } from "../session-utils";
import type { OutboundLeadUserData } from "./userdata";

export type EndOutboundCallSource =
  | "end_call_tool"
  | "root_shell_resume"
  | "entry_fallback"
  | "dial_failed"
  | "qualification_failed";

export type EndOutboundCallResult =
  | { applied: true; source: EndOutboundCallSource; attempt: number }
  | { applied: false; reason: "already_ended"; attempt: number };

const END_CALL_TOOL_SUCCESS =
  "Call ended. Remain completely silent — do not speak, summarize, or call any tools again.";
const END_CALL_TOOL_DUPLICATE =
  "Call is already ending. Remain completely silent — do not speak or call any tools again.";

/** Enter the closing phase after outcome is saved — blocks further field collection. */
export function beginOutboundCallClosing(userData: OutboundLeadUserData): boolean {
  if (userData.callEnding || userData.callEnded) return false;
  userData.callEnding = true;
  return true;
}

export function isOutboundCallClosing(userData: OutboundLeadUserData): boolean {
  return Boolean(userData.callEnding || userData.callEnded);
}

function defaultShutdownReason(source: EndOutboundCallSource): string {
  switch (source) {
    case "dial_failed":
      return "dial_failed";
    case "qualification_failed":
      return "qualification_failed";
    case "entry_fallback":
      return "qualification_complete_fallback";
    default:
      return "qualification_complete";
  }
}

function logEndCallEvent(input: {
  callId: string;
  event: "outbound_end_call_effective" | "outbound_end_call_duplicate";
  source: EndOutboundCallSource;
  attempt: number;
  reason?: string;
}) {
  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: input.event,
      callId: input.callId,
      endCallSource: input.source,
      attempt: input.attempt,
      reason: input.reason || null,
    }),
  );
}

/**
 * Idempotent outbound hangup — only the first call performs shutdown and is logged as effective.
 */
export async function endOutboundCall(
  session: AgentSession<OutboundLeadUserData>,
  input: { source: EndOutboundCallSource; reason?: string },
): Promise<EndOutboundCallResult> {
  const ud = session.userData;
  ud.endCallAttemptCount = (ud.endCallAttemptCount || 0) + 1;
  const attempt = ud.endCallAttemptCount;

  if (ud.callEnded) {
    logEndCallEvent({
      callId: ud.callId,
      event: "outbound_end_call_duplicate",
      source: input.source,
      attempt,
      reason: input.reason,
    });
    return { applied: false, reason: "already_ended", attempt };
  }

  ud.callEnding = true;
  ud.callEnded = true;
  ud.endCallEffectiveAt = new Date().toISOString();

  logEndCallEvent({
    callId: ud.callId,
    event: "outbound_end_call_effective",
    source: input.source,
    attempt,
    reason: input.reason,
  });

  await appendTraceEvent(ud.callId, {
    kind: "outbound_end_call",
    detail: {
      source: input.source,
      attempt,
      reason: input.reason || defaultShutdownReason(input.source),
      effective: true,
    },
  }).catch(() => undefined);

  await safeInterruptSession(session);
  session.shutdown({
    reason: input.reason || defaultShutdownReason(input.source),
  });

  return { applied: true, source: input.source, attempt };
}

export function endCallToolMessage(result: EndOutboundCallResult): string {
  return result.applied ? END_CALL_TOOL_SUCCESS : END_CALL_TOOL_DUPLICATE;
}
