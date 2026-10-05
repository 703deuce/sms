import "server-only";

import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";

/**
 * SMS alerts to business recipients when a missed-call customer replies (caller_replied).
 * Distinct from urgent-only SMS and from AI Recovery.
 *
 * Commercial default: entitled for active MCTB workspaces (override via capability resolver).
 */
export async function canSendMctbBusinessReplyTeamSms(workspaceId: string): Promise<boolean> {
  const caps = await resolveMctbCapabilities(workspaceId);
  return caps.businessReplySms;
}

export function describeMctbBusinessReplySmsEntitlement(): {
  mechanism: "resolveMctbCapabilities.businessReplySms";
  note: string;
} {
  return {
    mechanism: "resolveMctbCapabilities.businessReplySms",
    note:
      "Team SMS for caller_replied events; gated independently from urgentBusinessSms and AI Recovery.",
  };
}
