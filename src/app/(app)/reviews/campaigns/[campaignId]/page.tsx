import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { CampaignDetailClient } from "@/components/reputation/campaign-detail-client";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationCampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const businessId = await getReputationWorkspaceId();
  const { campaignId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      }
    >
      <CampaignDetailClient businessId={businessId} campaignId={campaignId} />
    </Suspense>
  );
}