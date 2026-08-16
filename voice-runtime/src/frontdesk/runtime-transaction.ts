import type { AgentSession } from "@livekit/agents";
import { isAgentSessionAlive } from "../session-utils";

export type RuntimeTransactionContext = {
  callId: string;
  workspaceId: string;
};

export function logRuntimeTransaction(
  source: string,
  event: string,
  ctx: RuntimeTransactionContext,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      source,
      event,
      callId: ctx.callId,
      workspaceId: ctx.workspaceId,
      ...extra,
    }),
  );
}

export function transactionContextFromUserData(ud: {
  callId: string;
  workspaceId: string;
}): RuntimeTransactionContext {
  return { callId: ud.callId, workspaceId: ud.workspaceId };
}

/**
 * Best-effort caller notification after a critical write succeeded.
 * Speech failure must never affect transaction outcome.
 */
export async function tryConfirmationSpeech<T extends { callId: string }>(
  session: AgentSession<T>,
  operation: string,
  text: string,
  speak: (session: AgentSession<T>, text: string) => Promise<boolean>,
): Promise<boolean> {
  const ctx = { callId: session.userData.callId, workspaceId: (session.userData as { workspaceId?: string }).workspaceId || "" };
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (!isAgentSessionAlive(session)) {
    logRuntimeTransaction(operation, `${operation}_confirmation_speech_skipped`, ctx, {
      reason: "session_not_alive",
      preview: trimmed.slice(0, 80),
    });
    return false;
  }

  const spoken = await speak(session, trimmed);
  if (!spoken) {
    logRuntimeTransaction(operation, `${operation}_confirmation_speech_failed`, ctx, {
      preview: trimmed.slice(0, 80),
    });
  }
  return spoken;
}

/** IDs copied from userdata so async downstream work survives AgentSession close. */
export type DurableCallWorkContext = {
  workspaceId: string;
  agentId: string;
  callId: string;
  businessName: string;
  timezone: string;
  callerE164?: string;
};

export function durableCallWorkContextFromUserData(ud: {
  workspaceId: string;
  agentId: string;
  callId: string;
  businessName: string;
  timezone: string;
  callerE164?: string;
}): DurableCallWorkContext {
  return {
    workspaceId: ud.workspaceId,
    agentId: ud.agentId,
    callId: ud.callId,
    businessName: ud.businessName,
    timezone: ud.timezone,
    callerE164: ud.callerE164,
  };
}
