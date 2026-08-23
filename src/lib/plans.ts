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
