import "server-only";

import type { MctbInboundTenant } from "@/lib/mctb/tenant/resolve-inbound";
import { resolveMctbInboundTenant } from "@/lib/mctb/tenant/resolve-inbound";

export type { MctbInboundTenant as MctbInboundWorkspaceTarget };

/**
 * Resolve workspace + demoMode from called Transovo DID.
 * Adapter preserves legacy `businessE164` call-site parameter name.
 */
export async function resolveMctbTargetWorkspaceForInboundCall(input: {
  callerE164: string;
  businessE164: string;
  forwardedFrom?: string | null;
}): Promise<MctbInboundTenant> {
  return resolveMctbInboundTenant({
    callerE164: input.callerE164,
    transovoE164: input.businessE164,
    forwardedFrom: input.forwardedFrom,
  });
}
