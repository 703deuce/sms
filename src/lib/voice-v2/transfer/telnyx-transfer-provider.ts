import "server-only";

import * as ai from "@/lib/voice/telnyx/ai-client";
import type { VoiceV2TransferProvider, VoiceV2TransferProviderRequest } from "./transfer-provider";

/** BASIC transfer via Telnyx Call Control; WARM uses consultation path when configured. */
export class VoiceV2TelnyxCallControlTransferProvider implements VoiceV2TransferProvider {
  async initiateTransfer(req: VoiceV2TransferProviderRequest) {
    if (req.mode === "WARM") {
      return { result: "PROVIDER_ERROR" as const };
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
