/**
 * Customer-facing MCTB monthly totals — base plan + optional customer-owned A2P add-on.
 */

export const MCTB_PRO_MONTHLY_CENTS = 1999;
/** @deprecated Legacy key — same price as Pro */
export const MCTB_TEXT_BACK_MONTHLY_CENTS = MCTB_PRO_MONTHLY_CENTS;
export const MCTB_AI_RECOVERY_MONTHLY_CENTS = MCTB_PRO_MONTHLY_CENTS;
export const MCTB_OWN_SENDER_MONTHLY_CENTS = 1000;
export const MCTB_OWN_SENDER_A2P_ONE_TIME_CENTS = 1950;

export type MctbBasePlanKey = "free" | "pro" | "text_back" | "ai_recovery";

export function mctbBasePlanMonthlyCents(plan: MctbBasePlanKey): number {
  switch (plan) {
    case "free":
      return 0;
    case "pro":
    case "text_back":
    case "ai_recovery":
      return MCTB_PRO_MONTHLY_CENTS;
    default:
      return 0;
  }
}

export function mctbEstimatedMonthlyTotalCents(input: {
  basePlan: MctbBasePlanKey;
  ownSenderAddOn: boolean;
}): number {
  return mctbBasePlanMonthlyCents(input.basePlan) + (input.ownSenderAddOn ? MCTB_OWN_SENDER_MONTHLY_CENTS : 0);
}

export const MCTB_OWN_NUMBER_STACKING_SUMMARY =
  "Customer-owned A2P messaging is $10/month on top of your plan (Free or Pro $19.99/mo), plus a one-time $19.50 " +
  "carrier registration at checkout (pass-through fees). Pro + add-on = $29.99/mo before tax.";
