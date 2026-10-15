/** Reputation entitlements — business workspaces include review campaigns with MCTB. */

export type AddonEntitlement =
  | "review_campaigns"
  | "review_campaigns_managed"
  | "dedicated_messaging_number"
  | string;

export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly entitlement: string,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

export async function hasEntitlement(
  _organizationId: string,
  entitlement: AddonEntitlement,
): Promise<boolean> {
  if (
    entitlement === "review_campaigns" ||
    entitlement === "review_campaigns_managed" ||
    entitlement === "dedicated_messaging_number"
  ) {
    return true;
  }
  return true;
}

export async function requireEntitlement(organizationId: string, entitlement: AddonEntitlement) {
  if (!(await hasEntitlement(organizationId, entitlement))) {
    throw new EntitlementError(`Missing entitlement: ${entitlement}`, entitlement);
  }
}

export async function isOutboundPaused(_organizationId: string): Promise<boolean> {
  return false;
}

export async function isBillingHealthy(_organizationId: string): Promise<boolean> {
  return true;
}

export async function getOrgBillingStatus(_organizationId: string): Promise<string> {
  return "active";
}

/** Gate review / campaign one-off sends (SMS + email). */
export async function requireCampaignSendAccess(organizationId: string): Promise<void> {
  await requireEntitlement(organizationId, "review_campaigns");
  if (await isOutboundPaused(organizationId)) {
    throw new EntitlementError("Outbound messaging is paused", "outbound_paused");
  }
  if (!(await isBillingHealthy(organizationId))) {
    throw new EntitlementError("Billing is not active for this workspace", "billing");
  }
  const { checkCreditBalance } = await import("@/lib/billing/entitlements");
  const credit = await checkCreditBalance(organizationId);
  if (!credit.ok) {
    throw new EntitlementError(credit.error, "credits");
  }
}
