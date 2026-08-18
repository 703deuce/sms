import "server-only";

import { getPrisma } from "@/lib/db";
import { loadCallSession, updateSessionState } from "./session-store";
import type { SessionState } from "./types";

/** Canonical inbound row for Personal activity, voicemail, and analytics. */
export async function ensureSmartRoutingHumanCall(input: {
  workspaceId: string;
  sessionId: string;
  fromE164: string;
  toE164: string;
  callSid: string;
  provider: "telnyx" | "twilio";
}) {
  const { handleInboundHumanCall } = await import("@/lib/phone/human-call-service");
  const human = await handleInboundHumanCall({
    workspaceId: input.workspaceId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.callSid,
    routingNote: `smart_routing:${input.sessionId} [provider:${input.provider}]`,
    autoAnswer: false,
  });

  const prisma = getPrisma();
  await prisma.humanCall.update({
    where: { id: human.callId },
    data: {
      notes: `${human.call?.notes || ""}\n[smart_routing_session:${input.sessionId}]`.trim(),
    },
  });

  await updateSessionState(input.sessionId, {
    stateJson: {
      humanCallId: human.callId,
    },
  });

  return human.callId;
}

export async function syncHumanCallFromSmartRoutingSession(sessionId: string, outcome: string) {
  const session = await loadCallSession(sessionId);
  if (!session) return;

  const state = (session.stateJson as SessionState) ?? {};
  const humanCallId = state.humanCallId;
  if (!humanCallId) return;

  const prisma = getPrisma();
  let status: string = "completed";
  if (outcome === "voicemail") status = "voicemail";
  else if (outcome === "connected") status = "completed";
  else if (
    outcome.includes("failed") ||
    outcome.includes("error") ||
    outcome === "no_selection" ||
    outcome === "transfer_failed"
  ) {
    status = "missed";
  } else if (outcome === "caller_hung_up" && !session.answeredAt) {
    status = "missed";
  }

  await prisma.humanCall.update({
    where: { id: humanCallId },
    data: {
      status,
      disposition: `smart_routing:${outcome}`,
      endedAt: new Date(),
      ...(session.answeredAt ? { answeredAt: session.answeredAt } : {}),
    },
  });
}

export async function humanCallIdForSession(sessionId: string): Promise<string | null> {
  const session = await loadCallSession(sessionId);
  const state = (session?.stateJson as SessionState) ?? {};
  return state.humanCallId ?? null;
}
