import "server-only";

import { loadMctbOnboardingState } from "@/lib/mctb/onboarding/state";
import { getWorkspaceTollFreeNumber } from "@/lib/mctb/workspace-toll-free";
import {
  assessWorkspaceDedicatedMctbIngress,
  type WorkspaceMctbIngressInvalidReason,
} from "@/lib/mctb/provisioning/workspace-ingress-validity";

export type WorkspaceIngressStatus = {
  /** True when a valid dedicated ingress exists (safe CFNA target). */
  provisioned: boolean;
  validIngress: boolean;
  provisioningRequired: boolean;
  phoneNumberId?: string;
  e164?: string;
  forwardTargetE164: string | null;
  invalidReason?: WorkspaceMctbIngressInvalidReason;
};

/** Read-only ingress status for onboarding/setup GET handlers. */
export async function getWorkspaceIngressStatus(workspaceId: string): Promise<WorkspaceIngressStatus> {
  const assessment = await assessWorkspaceDedicatedMctbIngress(workspaceId);
  let forwardTargetE164 = assessment.valid && assessment.e164 ? assessment.e164 : null;
  if (!forwardTargetE164) {
    const onboarding = await loadMctbOnboardingState(workspaceId);
    forwardTargetE164 = getWorkspaceTollFreeNumber(onboarding)?.e164?.trim() || null;
  }
  return {
    provisioned: assessment.valid,
    validIngress: assessment.valid,
    provisioningRequired: !assessment.valid,
    phoneNumberId: assessment.phoneNumberId,
    e164: assessment.e164,
    forwardTargetE164,
    invalidReason: assessment.reason,
  };
}
