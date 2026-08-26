import "server-only";

import {
  isMassTextA2pApprovedStatus,
  syncMassTextA2pFromWorkspaceRegistration,
} from "@/lib/mass-texting/a2p-status";
import {
  ensureMessagingProductRegistration,
  getMessagingProductRegistration,
} from "@/lib/mass-texting/messaging-registration";

export type MassTextA2pSendGate = {
  allowed: boolean;
  reason: string | null;
  registrationStatus: string | null;
  useCase: "MASS_TEXT_MARKETING";
};

/**
 * Mass Text promotional sends require MASS_TEXT_MARKETING A2P — never MCTB press-1 consent.
 */
export async function assertMassTextMarketingSendAllowed(
  workspaceId: string,
): Promise<MassTextA2pSendGate> {
  await ensureMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING");
  const reg =
    (await syncMassTextA2pFromWorkspaceRegistration(workspaceId)) ??
    (await getMessagingProductRegistration(workspaceId, "MASS_TEXT_MARKETING"));

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

  const approved = isMassTextA2pApprovedStatus(reg.overallStatus);

  if (!approved || !reg.messagingEnabled || !reg.phoneAttached) {
    return {
      allowed: false,
      reason: "Mass Texting A2P campaign not approved or number not attached",
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
