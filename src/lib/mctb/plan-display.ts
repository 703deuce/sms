/** Customer-facing MCTB plan labels — keep in sync with docs/MCTB-COMMERCIAL-PACKAGES.md */

export type MctbCommercialPlanKey = "free" | "text_back" | "ai_recovery";

export type MctbPlanUsagePresentation = {
  planKey: MctbCommercialPlanKey;
  planLabel: string;
  monthlyRecoveriesUsed: number;
  monthlyRecoveryLimit: number;
  atLimit: boolean;
  periodKey: string;
  /** Short header copy, e.g. "3 / 10 missed calls texted" */
  usageShortLabel: string;
  /** Accessible description of plan + usage */
  usageAriaLabel: string;
};

export function resolveMctbCommercialPlanKey(input: {
  recoveryPaid: boolean;
  aiRecoveryEntitled: boolean;
}): MctbCommercialPlanKey {
  if (input.aiRecoveryEntitled) return "ai_recovery";
  if (input.recoveryPaid) return "text_back";
  return "free";
}

export function mctbCommercialPlanLabel(planKey: MctbCommercialPlanKey): string {
  switch (planKey) {
    case "free":
      return "Free";
    case "text_back":
      return "Text Back";
    case "ai_recovery":
      return "AI Recovery";
    default:
      return "Free";
  }
}

export function buildMctbPlanUsagePresentation(input: {
  recoveryPaid: boolean;
  aiRecoveryEntitled: boolean;
  monthlyRecoveriesUsed: number;
  monthlyRecoveryLimit: number;
  atLimit: boolean;
  periodKey: string;
}): MctbPlanUsagePresentation {
  const planKey = resolveMctbCommercialPlanKey({
    recoveryPaid: input.recoveryPaid,
    aiRecoveryEntitled: input.aiRecoveryEntitled,
  });
  const planLabel = mctbCommercialPlanLabel(planKey);
  const used = Math.max(0, input.monthlyRecoveriesUsed);
  const limit = Math.max(0, input.monthlyRecoveryLimit);
  const usageShortLabel =
    limit > 0 ? `${used} / ${limit} missed calls texted` : `${used} missed calls texted`;
  const usageAriaLabel = `${planLabel} plan. ${used} of ${limit} missed calls texted back this month. Replies are not counted.`;

  return {
    planKey,
    planLabel,
    monthlyRecoveriesUsed: used,
    monthlyRecoveryLimit: limit,
    atLimit: input.atLimit,
    periodKey: input.periodKey,
    usageShortLabel,
    usageAriaLabel,
  };
}
