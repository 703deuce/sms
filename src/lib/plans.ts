export type PlanFeatures = Record<string, boolean>;

export async function getOrganizationPlan(_organizationId: string) {
  return { name: "growth", features: {} as PlanFeatures };
}

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

const DEFAULT_REVIEW_FEATURES = new Set([
  "review_momentum",
  "review_requests",
  "reputation_audit",
  "qr_campaigns",
]);

export async function hasFeature(organizationId: string, feature: string): Promise<boolean> {
  if (!organizationId) return false;
  if (DEFAULT_REVIEW_FEATURES.has(feature)) return true;
  const plan = await getOrganizationPlan(organizationId);
  return Boolean(plan.features?.[feature]);
}

export type UsageKey = string;

export async function reserveUsageOrThrow(_organizationId: string, _key: UsageKey, _units = 1) {
  return { reservationId: `noop:${Date.now()}` };
}

export async function releaseUsage(_organizationId: string, _reservationId: string) {
  return;
}
