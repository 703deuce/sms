import "server-only";

import { deriveRequiredActions } from "@/lib/compliance-helpers";
import { loadMctbSetupPhoneOptionsWithTelnyxSync } from "@/lib/mctb/setup-telnyx-messaging-sync";
import { loadComplianceOverview, loadPhoneNumbers } from "@/lib/workspace-data";
import { loadAdminMctbTestFlags } from "@/lib/mctb/admin-test-workspace";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { isMctbSetupMessagingReady } from "@/lib/mctb/setup-messaging-ready";
import { isExistingConsentModeEligible } from "@/lib/mctb/setup-consent-eligibility";

/** Same eligibility gate as MCTB setup/onboarding when selecting existing_consent. */
export async function isWorkspaceExistingConsentModeEligible(
  workspaceId: string,
): Promise<boolean> {
  const [phoneNumbers, compliance, reg, adminFlags, caps] = await Promise.all([
    loadMctbSetupPhoneOptionsWithTelnyxSync(workspaceId),
    loadComplianceOverview(workspaceId),
    loadPhoneNumbers(workspaceId, { includeLinked: true }),
    loadAdminMctbTestFlags(workspaceId),
    resolveMctbCapabilities(workspaceId),
  ]);
  const requiredActions = deriveRequiredActions(compliance.registration, reg);
  return isExistingConsentModeEligible({
    messagingReady: isMctbSetupMessagingReady({
      phoneNumbers,
      requiredActions,
      adminFlags,
    }),
    platformSenderActive: caps.platformSenderActive,
    mctbProductActive: caps.pressOneConsent,
  });
}
