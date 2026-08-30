import "server-only";

import { isPlatformDemoNumber } from "@/lib/mctb/onboarding/demo";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import type { MctbTexmlIngressConfig } from "./config-cache";

/**
 * Resolve the tenant workspace for a TeXML MCTB leg.
 * Production DIDs: ingress config workspace (phone row / assignment).
 * Platform demo 571: demo session or production forward binding.
 */
export async function resolveMctbTexmlTenantWorkspace(input: {
  ingressConfig: MctbTexmlIngressConfig;
  callerE164: string;
  forwardedFrom?: string | null;
}): Promise<{ workspaceId: string; demoMode: boolean; isPlatformDemo: boolean }> {
  const transovoE164 = input.ingressConfig.e164;

  if (isPlatformDemoNumber(transovoE164)) {
    const target = await resolveMctbTargetWorkspaceForInboundCall({
      callerE164: input.callerE164,
      businessE164: transovoE164,
      forwardedFrom: input.forwardedFrom,
    });
    if (target.workspaceId) {
      return {
        workspaceId: target.workspaceId,
        demoMode: target.demoMode,
        isPlatformDemo: true,
      };
    }
  }

  return {
    workspaceId: input.ingressConfig.workspaceId,
    demoMode: false,
    isPlatformDemo: false,
  };
}
