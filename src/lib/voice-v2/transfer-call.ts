import "server-only";

import { getVoiceV2CallContext, setVoiceV2CallContext } from "./intake/session-store";
import { resolveSessionKey } from "./intake/load-call-context";
import type { VoiceV2PublishedAfterHoursHandlingConfig } from "./after-hours-handling-types";
import { executeVoiceV2TransferPlan, rejectArbitraryTransferDestination } from "./transfer/transfer-executor";
import type { VoiceV2TransferProvider } from "./transfer/transfer-provider";

export type TransferCallInput = {
  workspaceId: string;
  agentId: string;
  callControlId?: string | null;
  conversationId?: string | null;
  invocationId: string;
  transferPlanId?: string;
  callerRequested?: boolean;
  destinationPhone?: string;
  config: VoiceV2PublishedAfterHoursHandlingConfig;
  provider: VoiceV2TransferProvider;
};

export async function executeVoiceV2TransferCall(input: TransferCallInput) {
  if (input.destinationPhone && rejectArbitraryTransferDestination(input.config, input.destinationPhone)) {
    return {
      ok: false,
      status: "TRANSFER_REJECTED",
      speak: "I can only connect you to our configured team numbers.",
      voice_v2_status: "TRANSFER_REJECTED",
    };
  }

  const sessionKey = resolveSessionKey({
    callControlId: input.callControlId,
    conversationId: input.conversationId,
  });
  if (!sessionKey) {
    return {
      ok: false,
      status: "SESSION_UNAVAILABLE",
      speak: "Transfer could not be started.",
      voice_v2_status: "SESSION_UNAVAILABLE",
    };
  }
  const ctx = getVoiceV2CallContext(sessionKey);
  if (!ctx) {
    return {
      ok: false,
      status: "SESSION_UNAVAILABLE",
      speak: "Transfer could not be started.",
      voice_v2_status: "SESSION_UNAVAILABLE",
    };
  }

  const result = await executeVoiceV2TransferPlan({
    ctx,
    config: input.config,
    provider: input.provider,
    callControlId: input.callControlId || sessionKey.replace(/^cc:/, ""),
    planId: input.transferPlanId,
    invocationId: input.invocationId,
    callerRequested: input.callerRequested,
  });

  setVoiceV2CallContext({
    ...ctx,
    afterHours: {
      ...ctx.afterHours,
      transfer: result.transfer,
      pendingHandlingAction: result.ok ? undefined : "CALLBACK",
    },
  });

  const initiating = result.ok && result.status === "INITIATING";
  return {
    ok: result.ok,
    status: initiating ? "TRANSFER_INITIATING" : result.ok ? "TRANSFERRED" : result.status,
    speak: result.speak,
    voice_v2_status: initiating
      ? "TRANSFER_INITIATING"
      : result.ok
        ? "TRANSFERRED"
        : "TRANSFER_FAILED",
    transfer: result.transfer,
  };
}
