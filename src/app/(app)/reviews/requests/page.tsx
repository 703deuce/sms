import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewRequestsDashboard } from "@/components/reputation/review-requests-dashboard";
import { ReviewRequestsUpgrade } from "@/components/reputation/review-requests-upgrade";
import {
  reviewRequestsPreviewCampaigns,
  reviewRequestsPreviewKit,
  reviewRequestsPreviewStats,
} from "@/lib/reputation/review-requests-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function ReputationRequestsPage() {
  const businessId = await getReputationWorkspaceId();
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));

  if (!allowed) {
    return <ReviewRequestsUpgrade businessId={businessId} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewRequestsDashboard
        businessId={businessId}
        previewData={
          isPreview
            ? {
                kit: reviewRequestsPreviewKit,
                stats: reviewRequestsPreviewStats,
                campaigns: reviewRequestsPreviewCampaigns.campaigns,
              }
            : undefined
        }
      />
    </Suspense>
  );
}