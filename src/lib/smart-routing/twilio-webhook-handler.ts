import "server-only";

import { getPrisma } from "@/lib/db";
import { resolveActiveFlowForNumber } from "./flow-service";
import {
  handleTwilioGatherCallback,
  handleTwilioTransferCallback,
  handleTwilioRecordingCallback,
  startTwilioFlowForInbound,
} from "./twilio-flow-runtime";
import { loadCallSession } from "./session-store";
import {
  buildWhisperAcceptTwiml,
  buildWhisperAgentTwiml,
  cancelTwilioWhisperAgent,
} from "./twilio-whisper-service";
import { finalizeSession } from "./flow-runtime";
import type { SessionState } from "./types";

export async function tryStartTwilioSmartRoutingInbound(input: {
  workspaceId: string;
  phoneNumberId: string;
  fromE164: string;
  toE164: string;
  callSid: string;
  forwardedFrom?: string;
}) {
  const flow = await resolveActiveFlowForNumber(input.workspaceId, input.phoneNumberId);
  if (!flow?.publishedVersionId) return { started: false as const };

  const prisma = getPrisma();
  const existing = await prisma.smartRoutingCallSession.findFirst({
    where: { callControlId: input.callSid },
    select: { id: true },
  });
  if (existing) {
    return { started: true as const, sessionId: existing.id, duplicate: true as const };
  }

  const { session, twiml } = await startTwilioFlowForInbound({
    workspaceId: input.workspaceId,
    flowId: flow.id,
    flowVersionId: flow.publishedVersionId,
    callerNumber: input.fromE164,
    calledNumber: input.toE164,
    callSid: input.callSid,
    forwardedFrom: input.forwardedFrom,
  });

  return { started: true as const, sessionId: session.id, twiml };
}

export async function processTwilioSmartRoutingCallback(input: {
  sessionId: string;
  event: string;
  digits?: string;
  dialCallStatus?: string;
  recordingUrl?: string;
  callSid?: string;
}) {
  const session = await loadCallSession(input.sessionId);
  if (!session) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
  }

  const state = (session.stateJson as SessionState) ?? {};

  if (input.event === "whisper_agent") {
    if (input.callSid) {
      const prisma = getPrisma();
      await prisma.smartRoutingCallSession.update({
        where: { id: input.sessionId },
        data: {
          stateJson: {
            ...state,
            whisperAgentCallSid: input.callSid,
          } as object,
        },
      });
    }
    return buildWhisperAgentTwiml({
      sessionId: input.sessionId,
      whisperText:
        state.whisperText ?? "Incoming business call. Press 1 to accept.",
      acceptDigit: state.acceptDigit ?? "1",
    });
  }

  if (input.event === "whisper_accept") {
    const digit = (input.digits ?? "").trim();
    const acceptDigit = state.acceptDigit ?? "1";
    if (digit === acceptDigit) {
      await finalizeSession(input.sessionId, "connected");
      return buildWhisperAcceptTwiml(input.sessionId, digit, acceptDigit);
    }
    await cancelTwilioWhisperAgent(input.sessionId, session.workspaceId);
    return handleTwilioTransferCallback(input.sessionId, "no-answer");
  }

  switch (input.event) {
    case "gather":
      return handleTwilioGatherCallback(input.sessionId, input.digits ?? "");
    case "transfer":
      return handleTwilioTransferCallback(input.sessionId, input.dialCallStatus ?? "no-answer");
    case "recording":
      return handleTwilioRecordingCallback(input.sessionId, input.recordingUrl ?? "");
    default:
      return `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`;
  }
}
