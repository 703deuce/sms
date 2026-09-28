import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";

/**
 * Team-facing urgent SMS alerts (business recipients) — not consumer MCTB recovery SMS.
 *
 * **Authoritative packaging (audit 2026-09-28):** There is no separate `mctb.urgent_business_sms`
 * workspace-feature flag in the billing model today. Paid MCTB access is defined by
 * `hasActiveMctbPaidEntitlement` (`billingPlan` in `PAID_MCTB_PLANS` or active Stripe subscription).
 * Every paid MCTB plan is intentionally entitled to urgent business SMS until product introduces
 * a finer capability — then wire that existing entitlement mechanism here (do not invent a parallel system).
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
    note:
      "Recovery-paid tier via centralized capability resolver. No separate mctb.urgent_business_sms SKU yet.",
  };
}
