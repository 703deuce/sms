import { MCTB_LAUNCH_TRY_IT_ENABLED } from "@/lib/mctb/launch-flags";

const PAID_MCTB_PLANS = new Set([
  "growth",
  "pro",
  "enterprise",
  "starter",
  "business",
  "scale",
]);

/** Show standalone Try It nav for trial/onboarding workspaces — hide for paid production. */
export function shouldShowTryItNav(
  billingPlan: string | null | undefined,
  options?: { isPlatformAdmin?: boolean; adminTestAccount?: boolean },
): boolean {
  if (!MCTB_LAUNCH_TRY_IT_ENABLED) {
    return Boolean(options?.isPlatformAdmin || options?.adminTestAccount);
  }
  if (options?.isPlatformAdmin || options?.adminTestAccount) return true;
  const plan = String(billingPlan || "").toLowerCase();
  if (!plan || plan === "onboarding") return true;
  if (plan === "trial" || plan === "trial_pending_card") return true;
  if (PAID_MCTB_PLANS.has(plan)) return false;
  if (plan === "expired" || plan === "canceled" || plan === "suspended" || plan === "past_due") {
    return true;
  }
  return true;
}
