import "server-only";

import * as ai from "@/lib/voice/telnyx/ai-client";
import type { VoiceV2TransferProvider, VoiceV2TransferProviderRequest } from "./transfer-provider";
import { startVoiceV2WarmTransfer } from "./warm-transfer-runtime";

/** BASIC transfer via Telnyx Call Control; WARM uses consultation + Press-1 bridge. */
export class VoiceV2TelnyxCallControlTransferProvider implements VoiceV2TransferProvider {
  async initiateTransfer(req: VoiceV2TransferProviderRequest) {
    if (req.mode === "WARM") {
      const briefing =
        req.briefingText?.trim() ||
        "You have an incoming caller. Press 1 to accept this call.";
      const warm = await startVoiceV2WarmTransfer({
        workspaceId: req.workspaceId,
        agentId: req.agentId,
        sessionKey: req.sessionKey,
        invocationId: req.invocationId,
        planId: req.planId,
        transferGeneration: req.transferGeneration,
        stepOrder: req.stepOrder,
        destinationId: req.destinationId,
        destinationE164: req.destinationE164,
        callerCallControlId: req.callControlId,
        briefingText: briefing,
        timeoutSeconds: req.timeoutSeconds,
      });
      if (warm.result === "INITIATING") {
        return { result: "INITIATING" as const, providerReference: warm.sessionId };
      }
      return { result: warm.result };
    }
    try {
      await ai.transferCall(req.callControlId, {
        to: req.destinationE164,
      });
      return { result: "SUCCESS" as const };
    } catch {
      return { result: "PROVIDER_ERROR" as const };
    }
  }
}
