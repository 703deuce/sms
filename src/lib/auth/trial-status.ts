import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";

/**
 * Client-safe trial check from org billing fields (no DB imports).
 * Keep in sync with `isTrialOrganization` in `trial.ts`.
 *
 * Paid unlock requires billing_status === "active" (or a non-starter plan).
 * Starter orgs stay on the trial experience until they activate a paid subscription.
 */
export function organizationLooksLikeTrial(input: {
  plan?: string | null;
  billing_status?: string | null;
}): boolean {
  const billing = String(input.billing_status ?? "manual").toLowerCase();
  const plan = String(input.plan ?? "starter").toLowerCase();

  if (plan === "pro" || plan === "agency" || plan === "internal") return false;
  if (billing === "active") return false;
  if (billing === "trialing") return true;

  // SMB starter without an active subscription (manual/ok/canceled/etc.)
  if (isSmbLaunchNavEnabled() && plan === "starter") return true;

  return false;
}
