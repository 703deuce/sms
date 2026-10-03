import "server-only";

import { provisionTrialMctbNumber } from "@/lib/mctb/onboarding/trial-number";
import { resolveMctbWorkspaceIngressMode } from "@/lib/mctb/provisioning/workspace-ingress-mode";
import { provisionMctbWorkspaceTollFreeIngress } from "@/lib/mctb/provisioning/provision-workspace-toll-free-ingress";
import { assessWorkspaceDedicatedMctbIngress } from "@/lib/mctb/provisioning/workspace-ingress-validity";

export type EnsureMctbWorkspaceIngressResult = {
  ok: boolean;
  provisioned: boolean;
  phoneNumberId?: string;
  e164?: string;
  error?: string;
};

/**
 * Idempotent provisioning: assign/configure dedicated MCTB ingress when missing or invalid.
 * Does not perform TeXML repair when ingress is already valid — use explicit repair tooling for that.
 */
export async function ensureMctbWorkspaceIngressReady(
  workspaceId: string,
): Promise<EnsureMctbWorkspaceIngressResult> {
  const existing = await assessWorkspaceDedicatedMctbIngress(workspaceId);
  if (existing.valid && existing.phoneNumberId && existing.e164) {
    return {
      ok: true,
      provisioned: true,
      phoneNumberId: existing.phoneNumberId,
      e164: existing.e164,
    };
  }

  const ingressMode = resolveMctbWorkspaceIngressMode();

  if (ingressMode === "toll_free_texml") {
    const result = await provisionMctbWorkspaceTollFreeIngress(workspaceId);
    if (!result.ok) {
      return {
        ok: false,
        provisioned: false,
        error: result.error || "toll_free_ingress_provision_failed",
      };
    }
    return {
      ok: true,
      provisioned: true,
      phoneNumberId: result.phoneNumberId,
      e164: result.e164,
    };
  }

  const result = await provisionTrialMctbNumber(workspaceId);
  if (!result.ok) {
    return {
      ok: false,
      provisioned: false,
      error: result.error || "trial_number_provision_failed",
    };
  }
  return {
    ok: true,
    provisioned: true,
    phoneNumberId: result.trialNumber?.phoneNumberId,
    e164: result.trialNumber?.e164,
  };
}
