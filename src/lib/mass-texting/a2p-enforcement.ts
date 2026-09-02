import "server-only";

import {
  assertWorkspaceMessagingSendAllowed,
  type UnifiedMessagingSendGate,
} from "@/lib/messaging/unified-send-gate";
import { getMessagingProductRegistration } from "@/lib/mass-texting/messaging-registration";

export type MassTextA2pSendGate = UnifiedMessagingSendGate;

/**
 * Mass Texting uses the same workspace A2P registration as MCTB (low-volume mixed).
 * Prefer cached product registration from DB; live Telnyx sync only when needed.
 */
export async function assertMassTextMarketingSendAllowed(
  workspaceId: string,
): Promise<MassTextA2pSendGate> {
  const productReg = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  if (
    productReg?.phoneE164 &&
    productReg.messagingEnabled &&
    (productReg.overallStatus === "approved" ||
      productReg.overallStatus === "ready" ||
      productReg.phoneAttached)
  ) {
    return {
      allowed: true,
      reason: null,
      registrationStatus: productReg.overallStatus,
      useCase: "MIXED",
      phoneE164: productReg.phoneE164,
    };
  }

  return assertWorkspaceMessagingSendAllowed(workspaceId);
}
