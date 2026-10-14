import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { redirectIfTrialLockedFeature } from "@/lib/auth/redirect-if-trial-locked";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewCampaignsHub } from "@/components/reputation/review-campaigns-hub";
import {
  reviewCampaignsPreviewActivity,
  reviewCampaignsPreviewCampaigns,
  reviewCampaignsPreviewStats,
} from "@/lib/reputation/review-campaigns-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationCampaignsPage() {
  const businessId = await getReputationWorkspaceId();
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  await redirectIfTrialLockedFeature(auth.organizationId, "campaigns");
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));

  if (!allowed) {
    return <ReviewCampaignsUpgrade businessId={businessId} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewCampaignsHub
        businessId={businessId}
        previewData={
          isPreview
            ? {
                campaigns: reviewCampaignsPreviewCampaigns,
                stats: reviewCampaignsPreviewStats,
                activity: reviewCampaignsPreviewActivity,
              }
            : undefined
        }
      />
    </Suspense>
  );
}