import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";

/**
 * Team-facing urgent SMS alerts (business recipients) — not consumer MCTB recovery SMS.
 *
 * **Authoritative:** `resolveMctbCapabilities(workspaceId).urgentBusinessSms` — true on **Recovery paid**
 * tier only (not Free, not AI Recovery alone). Urgent classification/email/SMS are Recovery features;
 * conversational AI Recovery is a separate SKU (`aiRecoveryEntitled`).
 */
export async function canSendMctbUrgentBusinessTeamSms(workspaceId: string): Promise<boolean> {
  const caps = await resolveMctbCapabilities(workspaceId);
  return caps.urgentBusinessSms;
}

export type MctbUrgentBusinessSmsEntitlementAudit = {
  mechanism: "resolveMctbCapabilities.urgentBusinessSms";
  granularCapabilityFlag: null;
  note: string;
};

export function describeMctbUrgentBusinessSmsEntitlement(): MctbUrgentBusinessSmsEntitlementAudit {
  return {
    mechanism: "resolveMctbCapabilities.urgentBusinessSms",
    granularCapabilityFlag: null,
    note: "Recovery-paid tier via resolveMctbCapabilities().urgentBusinessSms (not hasActiveMctbPaidEntitlement alone).",
  };
}
