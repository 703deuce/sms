import { hasEntitlement } from "@/lib/auth/entitlements";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import { getOrganizationPlan, PlanLimitError } from "@/lib/plans";
import { createServiceClient } from "@/lib/db/client";

/**
 * Active QR campaign caps by plan.
 * Free/starter: 1 active campaign (save + basic tracking).
 * Pro+: multiple placements. Agency/internal: effectively unlimited.
 */
export async function getMaxActiveQrCampaigns(organizationId: string): Promise<number> {
  const plan = await getOrganizationPlan(organizationId);
  if (plan.id === "internal") return 9999;
  if (plan.id === "agency") return 999;
  const multi = await hasEntitlement(organizationId, "review_campaigns");
  if (multi || plan.id === "pro") return 20;
  // Starter / free: one active tracked QR campaign
  return 1;
}

export async function countActiveQrCampaigns(
  organizationId: string,
  businessId?: string
): Promise<number> {
  const supabase = createServiceClient();
  let q = supabase
    .from("review_qr_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");
  if (businessId) q = q.eq("business_id", businessId);
  const { count, error } = await q;
  if (error) {
    // Table may not exist yet in local/preview — treat as zero.
    if (/does not exist|schema cache/i.test(error.message)) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function assertCanCreateQrCampaign(params: {
  organizationId: string;
  businessId: string;
  activating?: boolean;
}): Promise<void> {
  const max = await getMaxActiveQrCampaigns(params.organizationId);
  if (!params.activating) return;
  const current = await countActiveQrCampaigns(params.organizationId);
  if (current >= max) {
    throw new PlanLimitError(
      max <= 1
        ? "Free plans include 1 active QR campaign. Upgrade to create more placements (receipts, counters, vehicles, etc.)."
        : `Your plan allows ${max} active QR campaigns. Pause or archive one, or upgrade.`,
      "max_active_qr_campaigns"
    );
  }
}

export async function canUseAdvancedQrFormats(organizationId: string): Promise<boolean> {
  return hasEntitlement(organizationId, "review_campaigns");
}

/**
 * Premium poster templates (non-classic layouts) for paid / non-trial accounts.
 * Trial and free stay on the classic poster; paid unlocks the template gallery.
 */
export async function canUsePremiumPosterTemplates(organizationId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("plan, billing_status")
      .eq("id", organizationId)
      .maybeSingle();
    // Paid / non-trial only — never fall back to review_campaigns grandfather.
    return !organizationLooksLikeTrial({
      plan: data?.plan,
      billing_status: data?.billing_status,
    });
  } catch {
    return false;
  }
}
