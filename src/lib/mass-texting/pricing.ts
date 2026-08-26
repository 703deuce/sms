/**
 * Canonical Mass Texting commercial pricing — version-controlled source of truth.
 * Secrets (Stripe keys, Telnyx credentials) belong in env; prices do not.
 */

export const MASS_TEXT_PRICING_VERSION = 1;

export type MassTextMonthlyTier =
  | "starter"
  | "growth"
  | "pro"
  | "business"
  | "scale";

export type MassTextPaygPackKey =
  | "pack_500"
  | "pack_1000"
  | "pack_2500"
  | "pack_5000"
  | "pack_10000";

export type MassTextBillingModel = "monthly" | "payg";

export type MassTextCheckoutKey =
  | `mass_texting_${MassTextMonthlyTier}`
  | "mass_texting_payg_line"
  | `mass_texting_${MassTextPaygPackKey}`
  | "mass_texting_a2p_registration"
  | "mass_texting_additional_number";

export type MassTextMonthlyPlan = {
  tier: MassTextMonthlyTier;
  displayName: string;
  monthlyPriceCents: number;
  includedSegments: number;
  includesLocalNumber: true;
  includesA2pRegistration: boolean;
  includesOngoingA2pMaintenance: true;
};

export type MassTextPaygPack = {
  key: MassTextPaygPackKey;
  displayName: string;
  priceCents: number;
  segments: number;
  includesA2pRegistration: boolean;
};

/** Internal provider-cost planning assumptions (not customer-facing). */
export const MASS_TEXT_INTERNAL_COSTS = {
  campaignMonthlyCostCents: 1000,
  localNumberMonthlyCostCents: 100,
  fixedActiveSenderMonthlyCostCents: 1100,
  /** Micro-cents per segment: 900 = $0.009 */
  outboundSmsMicrocentsPerSegment: 900,
  telnyxTrialBrandCostCents: 450,
  telnyxTrialCampaignCostCents: 0,
} as const;

export const MASS_TEXT_TRIAL = {
  durationDays: 14,
  includedSegments: 100,
  requiresCard: false,
  mmsEnabled: false,
} as const;

export const MASS_TEXT_A2P_REGISTRATION_FEE_CENTS = 2000;

export const MASS_TEXT_PAYG_LINE = {
  monthlyPriceCents: 1499,
  displayName: "PAYG Messaging Line",
  includesLocalNumber: true,
  includesOngoingA2pMaintenance: true,
} as const;

export const MASS_TEXT_ADDITIONAL_NUMBER = {
  monthlyPriceCents: 799,
  displayName: "Additional local number",
} as const;

export const MASS_TEXT_MONTHLY_PLANS: Record<MassTextMonthlyTier, MassTextMonthlyPlan> = {
  starter: {
    tier: "starter",
    displayName: "Starter",
    monthlyPriceCents: 2499,
    includedSegments: 500,
    includesLocalNumber: true,
    includesA2pRegistration: false,
    includesOngoingA2pMaintenance: true,
  },
  growth: {
    tier: "growth",
    displayName: "Growth",
    monthlyPriceCents: 3499,
    includedSegments: 1000,
    includesLocalNumber: true,
    includesA2pRegistration: false,
    includesOngoingA2pMaintenance: true,
  },
  pro: {
    tier: "pro",
    displayName: "Pro",
    monthlyPriceCents: 5499,
    includedSegments: 2500,
    includesLocalNumber: true,
    includesA2pRegistration: true,
    includesOngoingA2pMaintenance: true,
  },
  business: {
    tier: "business",
    displayName: "Business",
    monthlyPriceCents: 9499,
    includedSegments: 5000,
    includesLocalNumber: true,
    includesA2pRegistration: true,
    includesOngoingA2pMaintenance: true,
  },
  scale: {
    tier: "scale",
    displayName: "Scale",
    monthlyPriceCents: 16999,
    includedSegments: 10000,
    includesLocalNumber: true,
    includesA2pRegistration: true,
    includesOngoingA2pMaintenance: true,
  },
};

export const MASS_TEXT_PAYG_PACKS: Record<MassTextPaygPackKey, MassTextPaygPack> = {
  pack_500: {
    key: "pack_500",
    displayName: "500 segments",
    priceCents: 2999,
    segments: 500,
    includesA2pRegistration: false,
  },
  pack_1000: {
    key: "pack_1000",
    displayName: "1,000 segments",
    priceCents: 3999,
    segments: 1000,
    includesA2pRegistration: false,
  },
  pack_2500: {
    key: "pack_2500",
    displayName: "2,500 segments",
    priceCents: 6499,
    segments: 2500,
    includesA2pRegistration: true,
  },
  pack_5000: {
    key: "pack_5000",
    displayName: "5,000 segments",
    priceCents: 10999,
    segments: 5000,
    includesA2pRegistration: true,
  },
  pack_10000: {
    key: "pack_10000",
    displayName: "10,000 segments",
    priceCents: 18999,
    segments: 10000,
    includesA2pRegistration: true,
  },
};

export const MASS_TEXT_MONTHLY_TIERS = Object.keys(
  MASS_TEXT_MONTHLY_PLANS,
) as MassTextMonthlyTier[];

export const MASS_TEXT_PAYG_PACK_KEYS = Object.keys(
  MASS_TEXT_PAYG_PACKS,
) as MassTextPaygPackKey[];

export function massTextCheckoutKeyForMonthly(tier: MassTextMonthlyTier): MassTextCheckoutKey {
  return `mass_texting_${tier}`;
}

export function massTextCheckoutKeyForPaygPack(pack: MassTextPaygPackKey): MassTextCheckoutKey {
  return `mass_texting_${pack}`;
}

export function parseMassTextCheckoutKey(
  key: string,
):
  | { kind: "monthly"; tier: MassTextMonthlyTier }
  | { kind: "payg_line" }
  | { kind: "payg_pack"; pack: MassTextPaygPackKey }
  | { kind: "a2p_registration" }
  | { kind: "additional_number" }
  | null {
  if (key === "mass_texting_payg_line") return { kind: "payg_line" };
  if (key === "mass_texting_a2p_registration") return { kind: "a2p_registration" };
  if (key === "mass_texting_additional_number") return { kind: "additional_number" };
  const monthlyPrefix = "mass_texting_";
  if (!key.startsWith(monthlyPrefix)) return null;
  const rest = key.slice(monthlyPrefix.length);
  if (rest in MASS_TEXT_MONTHLY_PLANS) {
    return { kind: "monthly", tier: rest as MassTextMonthlyTier };
  }
  if (rest in MASS_TEXT_PAYG_PACKS) {
    return { kind: "payg_pack", pack: rest as MassTextPaygPackKey };
  }
  return null;
}

export function massTextA2pFeeRequired(input: {
  billingModel: MassTextBillingModel;
  monthlyTier?: MassTextMonthlyTier | null;
  paygPack?: MassTextPaygPackKey | null;
  a2pFeeStatus?: "PAID" | "WAIVED" | "NOT_REQUIRED" | "PENDING" | null;
}): boolean {
  if (
    input.a2pFeeStatus === "PAID" ||
    input.a2pFeeStatus === "WAIVED" ||
    input.a2pFeeStatus === "NOT_REQUIRED"
  ) {
    return false;
  }
  if (input.billingModel === "monthly" && input.monthlyTier) {
    return !MASS_TEXT_MONTHLY_PLANS[input.monthlyTier].includesA2pRegistration;
  }
  if (input.billingModel === "payg" && input.paygPack) {
    return !MASS_TEXT_PAYG_PACKS[input.paygPack].includesA2pRegistration;
  }
  return true;
}

export function formatUsdFromCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function estimatedProviderCostCentsForSegments(segments: number): number {
  const variableMicrocents =
    segments * MASS_TEXT_INTERNAL_COSTS.outboundSmsMicrocentsPerSegment;
  return (
    MASS_TEXT_INTERNAL_COSTS.fixedActiveSenderMonthlyCostCents +
    Math.ceil(variableMicrocents / 1000)
  );
}

export function listMassTextPricingCards() {
  return {
    version: MASS_TEXT_PRICING_VERSION,
    trial: MASS_TEXT_TRIAL,
    a2pRegistrationFeeCents: MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
    paygLine: MASS_TEXT_PAYG_LINE,
    monthly: MASS_TEXT_MONTHLY_TIERS.map((tier) => MASS_TEXT_MONTHLY_PLANS[tier]),
    paygPacks: MASS_TEXT_PAYG_PACK_KEYS.map((key) => MASS_TEXT_PAYG_PACKS[key]),
    additionalNumber: MASS_TEXT_ADDITIONAL_NUMBER,
  };
}
