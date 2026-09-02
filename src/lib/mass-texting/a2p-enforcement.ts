import "server-only";

import { isMessagingSendAuthorized } from "@/lib/messaging/messaging-authority";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import type { UnifiedMessagingSendGate } from "@/lib/messaging/unified-send-gate";
import {
  getMessagingProductRegistration,
  resolveMassTextSendingNumber,
} from "@/lib/mass-texting/messaging-registration";

export type MassTextA2pSendGate = UnifiedMessagingSendGate;

/**
 * Mass Texting uses the same workspace A2P registration as MCTB (low-volume mixed).
 * Launch/send hot path uses cached DB state only — no live Telnyx sync (that blocks requests).
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

  const reg = await getRegistrationByWorkspace(workspaceId);
  const sender = await resolveMassTextSendingNumber(workspaceId);
  const phoneE164 = reg?.phoneE164 ?? sender?.phoneE164 ?? null;

  if (!reg) {
    return {
      allowed: false,
      reason: "Messaging registration not started — complete compliance setup",
      registrationStatus: null,
      useCase: "MIXED",
      phoneE164,
    };
  }

  if (reg.paused) {
    return {
      allowed: false,
      reason: "Messaging is paused",
      registrationStatus: reg.overallStatus,
      useCase: String(reg.useCase || "MIXED"),
      phoneE164: reg.phoneE164 ?? phoneE164,
    };
  }

  if (isMessagingSendAuthorized(reg)) {
    return {
      allowed: true,
      reason: null,
      registrationStatus: reg.overallStatus,
      useCase: String(reg.useCase || "MIXED"),
      phoneE164: reg.phoneE164 ?? phoneE164,
    };
  }

  const pending =
    reg.overallStatus === "in_review" ||
    reg.brandStatus === "in_review" ||
    reg.campaignStatus === "in_review";

  return {
    allowed: false,
    reason: pending
      ? "A2P pending on Telnyx — assign an approved 10DLC campaign to this number"
      : "A2P campaign not approved or number not attached",
    registrationStatus: reg.overallStatus,
    useCase: String(reg.useCase || "MIXED"),
    phoneE164: reg.phoneE164 ?? phoneE164,
  };
}
