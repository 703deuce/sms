import "server-only";

import { ensureBusinessWorkspaceForMctb } from "@/lib/mctb/ensure-business-workspace-for-mctb";
import { grantMctbProductFeatureActive } from "@/lib/mctb/ensure-mctb-product-feature";
import { ensureMctbWorkspaceSeeded } from "@/lib/mctb/provisioning/seed-workspace";
import {
  ensureMctbWorkspaceIngressReady,
  type EnsureMctbWorkspaceIngressResult,
} from "@/lib/mctb/provisioning/ensure-workspace-ingress";

export type MctbWorkspaceBootstrapResult = EnsureMctbWorkspaceIngressResult & {
  seeded: boolean;
};

/** Signup / product-open / OAuth: onboarding state + ws_1-style toll-free ingress. */
export async function ensureMctbWorkspaceBootstrap(
  workspaceId: string,
): Promise<MctbWorkspaceBootstrapResult> {
  await ensureBusinessWorkspaceForMctb(workspaceId);
  await ensureMctbWorkspaceSeeded(workspaceId);
  await grantMctbProductFeatureActive(workspaceId);
  const ingress = await ensureMctbWorkspaceIngressReady(workspaceId);
  return { seeded: true, ...ingress };
}
