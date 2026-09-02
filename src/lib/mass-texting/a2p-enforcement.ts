import "server-only";

import {
  assertWorkspaceMessagingSendAllowed,
  type UnifiedMessagingSendGate,
} from "@/lib/messaging/unified-send-gate";

export type MassTextA2pSendGate = UnifiedMessagingSendGate;

/**
 * Mass Texting uses the same workspace A2P registration as MCTB (low-volume mixed).
 * Reads cached provider approval from messagingRegistration — no live Telnyx sync.
 */
export async function assertMassTextMarketingSendAllowed(
  workspaceId: string,
): Promise<MassTextA2pSendGate> {
  return assertWorkspaceMessagingSendAllowed(workspaceId);
}
