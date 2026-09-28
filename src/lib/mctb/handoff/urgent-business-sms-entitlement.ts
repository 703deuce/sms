import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";

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
  return hasActiveMctbPaidEntitlement(workspaceId);
}

export type MctbUrgentBusinessSmsEntitlementAudit = {
  mechanism: "hasActiveMctbPaidEntitlement";
  granularCapabilityFlag: null;
  note: string;
};

export function describeMctbUrgentBusinessSmsEntitlement(): MctbUrgentBusinessSmsEntitlementAudit {
  return {
    mechanism: "hasActiveMctbPaidEntitlement",
    granularCapabilityFlag: null,
    note:
      "Paid MCTB workspace = urgent business SMS entitled. No separate SKU at certification time.",
  };
}
