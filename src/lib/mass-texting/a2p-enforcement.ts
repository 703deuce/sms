import "server-only";

import {
  ensureMessagingProductRegistration,
  getMessagingProductRegistration,
  syncMassTextRegistrationFromTelnyx,
} from "@/lib/mass-texting/messaging-registration";

export type MassTextA2pSendGate = {
  allowed: boolean;
  reason: string | null;
  registrationStatus: string | null;
  useCase: "MASS_TEXT_MARKETING";
};

/**
 * Mass Text promotional sends require MASS_TEXT_MARKETING A2P — never MCTB press-1 consent.
 * Provider approval is synced from Telnyx before this gate runs.
 */
export async function assertMassTextMarketingSendAllowed(
  workspaceId: string,
): Promise<MassTextA2pSendGate> {
  await ensureMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  await syncMassTextRegistrationFromTelnyx(workspaceId);
  const reg = await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");

  if (!reg) {
    return {
      allowed: false,
      reason: "Mass Texting A2P registration not started",
      registrationStatus: null,
      useCase: "MASS_TEXT_MARKETING",
    };
  }

  if (reg.paused) {
    return {
      allowed: false,
      reason: "Mass Texting messaging is paused",
      registrationStatus: reg.overallStatus,
      useCase: "MASS_TEXT_MARKETING",
    };
  }

  const approved =
    reg.overallStatus === "approved" ||
    reg.overallStatus === "certified" ||
    reg.overallStatus === "ready";

  if (!approved || !reg.messagingEnabled || !reg.phoneAttached) {
    return {
      allowed: false,
      reason:
        reg.overallStatus === "in_review"
          ? "Mass Texting A2P pending on Telnyx — assign an approved 10DLC campaign to this number"
          : "Mass Texting A2P campaign not approved or number not attached",
      registrationStatus: reg.overallStatus,
      useCase: "MASS_TEXT_MARKETING",
    };
  }

  return {
    allowed: true,
    reason: null,
    registrationStatus: reg.overallStatus,
    useCase: "MASS_TEXT_MARKETING",
  };
}
