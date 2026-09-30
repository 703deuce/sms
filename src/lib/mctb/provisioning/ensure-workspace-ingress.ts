import "server-only";

import { ensureMctbPlatformSenderDefault } from "@/lib/mctb/ensure-platform-sender-default";
import {
  getTrialNumberStatus,
  provisionTrialMctbNumber,
} from "@/lib/mctb/onboarding/trial-number";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";

export type EnsureMctbWorkspaceIngressResult = {
  ok: boolean;
  provisioned: boolean;
  phoneNumberId?: string;
  e164?: string;
  error?: string;
};

/**
 * Idempotent: every BUSINESS MCTB workspace gets a Telnyx ingress DID wired for the
 * frozen TeXML pipeline before setup completes.
 */
export async function ensureMctbWorkspaceIngressReady(
  workspaceId: string,
): Promise<EnsureMctbWorkspaceIngressResult> {
  const prior = await getTrialNumberStatus(workspaceId);
  let phoneNumberId = prior.trialNumber?.phoneNumberId;
  let e164 = prior.trialNumber?.e164;

  if (!prior.provisioned) {
    const result = await provisionTrialMctbNumber(workspaceId);
    if (!result.ok) {
      return {
        ok: false,
        provisioned: false,
        error: result.error || "trial_number_provision_failed",
      };
    }
    phoneNumberId = result.trialNumber?.phoneNumberId;
    e164 = result.trialNumber?.e164;
  }

  await ensureMctbPlatformSenderDefault(workspaceId).catch(() => undefined);

  const state = await loadMctbOnboardingState(workspaceId);
  const workspaceNumber = getWorkspaceTollFreeNumber(state);
  const pid = phoneNumberId || workspaceNumber?.phoneNumberId;
  if (pid) {
    const { provisionMctbPhoneTexmlIngressModeForWorkspace } = await import(
      "@/lib/mctb/texml-ingress/texml-mode-provision"
    );
    const { warmMctbInboundRoutingProfileForWorkspace } = await import(
      "@/lib/mctb/texml-ingress/routing-profile"
    );
    await provisionMctbPhoneTexmlIngressModeForWorkspace(workspaceId, pid).catch(() => undefined);
    await warmMctbInboundRoutingProfileForWorkspace(workspaceId).catch(() => undefined);
  }

  return {
    ok: true,
    provisioned: true,
    phoneNumberId: pid || undefined,
    e164: e164 || workspaceNumber?.e164,
  };
}
