import { hasEntitlement } from "@/lib/auth/entitlements";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import { createServiceClient } from "@/lib/db/client";
import { getOrganizationPlan } from "@/lib/plans";

export type PaymentQrEntitlements = {
  enabled: boolean;
  maxPages: number;
  reviewLinks: boolean;
  customBranding: boolean;
  removePlatformBranding: boolean;
  customSlug: boolean;
  suggestedAmounts: boolean;
  detailedAnalytics: boolean;
  socialLinks: boolean;
  csvExport: boolean;
  logoInQr: boolean;
  multiplePosterTemplates: boolean;
  stripePayments: boolean;
};

const FREE_MAX_PAGES = 1;
const PAID_MAX_PAGES = 10;

async function orgPlanContext(organizationId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organizations")
    .select("plan, billing_status, addons")
    .eq("id", organizationId)
    .maybeSingle();
  const plan = await getOrganizationPlan(organizationId);
  const isTrial = organizationLooksLikeTrial({
    plan: data?.plan as string | undefined,
    billing_status: data?.billing_status as string | undefined,
  });
  const hasReviewCampaigns = await hasEntitlement(organizationId, "review_campaigns");
  const hasPaymentQrAddon = Boolean(
    (data?.addons as Record<string, boolean> | null)?.payment_qr
  );
  const isPaid = hasReviewCampaigns || hasPaymentQrAddon || (!isTrial && plan.id !== "starter");
  return { isTrial, isPaid, plan };
}

export async function getPaymentQrEntitlements(
  organizationId: string
): Promise<PaymentQrEntitlements> {
  const { isTrial, isPaid } = await orgPlanContext(organizationId);
  const paid = isPaid && !isTrial;

  return {
    enabled: true,
    maxPages: paid ? PAID_MAX_PAGES : FREE_MAX_PAGES,
    reviewLinks: paid,
    customBranding: paid,
    removePlatformBranding: paid,
    customSlug: paid,
    suggestedAmounts: paid,
    detailedAnalytics: paid,
    socialLinks: paid,
    csvExport: paid,
    logoInQr: paid,
    multiplePosterTemplates: paid,
    stripePayments: false,
  };
}

export async function assertPaymentQrFeature(
  organizationId: string,
  feature: keyof Omit<PaymentQrEntitlements, "enabled" | "maxPages" | "stripePayments">
): Promise<void> {
  const ent = await getPaymentQrEntitlements(organizationId);
  if (!ent[feature]) {
    throw new Error(`Upgrade required for payment QR feature: ${feature}`);
  }
}
