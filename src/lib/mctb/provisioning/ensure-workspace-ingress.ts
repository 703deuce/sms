import "server-only";

import { ensureMctbPlatformSenderDefault } from "@/lib/mctb/ensure-platform-sender-default";
import { getTrialNumberStatus, provisionTrialMctbNumber } from "@/lib/mctb/onboarding/trial-number";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { resolveMctbWorkspaceIngressMode } from "@/lib/mctb/provisioning/workspace-ingress-mode";
import { provisionMctbWorkspaceTollFreeIngress } from "@/lib/mctb/provisioning/provision-workspace-toll-free-ingress";
import { isNorthAmericaTollFreeE164 } from "@/lib/mctb/provisioning/telnyx-toll-free-ingress-pool";

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
  const ingressMode = resolveMctbWorkspaceIngressMode();
  let phoneNumberId: string | undefined;
  let e164: string | undefined;

  if (ingressMode === "toll_free_texml") {
    const prior = await getTrialNumberStatus(workspaceId);
    const needsTollFree =
      !prior.provisioned ||
      !prior.trialNumber?.e164 ||
      !isNorthAmericaTollFreeE164(prior.trialNumber.e164);

    if (needsTollFree) {
      const result = await provisionMctbWorkspaceTollFreeIngress(workspaceId);
      if (!result.ok) {
        return {
          ok: false,
          provisioned: false,
          error: result.error || "toll_free_ingress_provision_failed",
        };
      }
      phoneNumberId = result.phoneNumberId;
      e164 = result.e164;
    } else {
      phoneNumberId = prior.trialNumber?.phoneNumberId;
      e164 = prior.trialNumber?.e164;
    }
  } else {
    const prior = await getTrialNumberStatus(workspaceId);
    phoneNumberId = prior.trialNumber?.phoneNumberId;
    e164 = prior.trialNumber?.e164;

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
