/**
 * Customer-facing MCTB monthly totals — base plan + optional Own Local Number add-on.
 * @see docs/MCTB-COMMERCIAL-PACKAGES.md
 */

export const MCTB_TEXT_BACK_MONTHLY_CENTS = 999;
export const MCTB_AI_RECOVERY_MONTHLY_CENTS = 1999;
export const MCTB_OWN_SENDER_MONTHLY_CENTS = 1000;
export const MCTB_OWN_SENDER_A2P_ONE_TIME_CENTS = 1950;

export type MctbBasePlanKey = "free" | "text_back" | "ai_recovery";

/** Base plan monthly charge (not including add-ons). AI Recovery is not stacked on Text Back. */
export function mctbBasePlanMonthlyCents(plan: MctbBasePlanKey): number {
  switch (plan) {
    case "free":
      return 0;
    case "text_back":
      return MCTB_TEXT_BACK_MONTHLY_CENTS;
    case "ai_recovery":
      return MCTB_AI_RECOVERY_MONTHLY_CENTS;
    default:
      return 0;
  }
}

/** Total recurring MCTB bill when Own Local Number add-on is active. */
export function mctbEstimatedMonthlyTotalCents(input: {
  basePlan: MctbBasePlanKey;
  ownSenderAddOn: boolean;
}): number {
  return mctbBasePlanMonthlyCents(input.basePlan) + (input.ownSenderAddOn ? MCTB_OWN_SENDER_MONTHLY_CENTS : 0);
}

export const MCTB_OWN_NUMBER_STACKING_SUMMARY =
  "Own Local Number is $10/month on top of your MCTB plan (Free, Text Back $9.99/mo, or AI Recovery $19.99/mo). " +
  "AI Recovery is the $19.99 plan — not an extra $19.99 on top of Text Back. " +
  "Checkout also includes a one-time $19.50 A2P registration fee for your own number.";
