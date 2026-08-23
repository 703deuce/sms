import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { QrCampaignEditor } from "@/components/reputation/qr-campaigns/qr-campaign-editor";
import { ReviewRequestsUpgrade } from "@/components/reputation/review-requests-upgrade";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

export default async function QrCampaignEditorPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const businessId = await getReputationWorkspaceId();
  const { campaignId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessPage(businessId);
  const allowed =
    isPreview ||
    (await hasEntitlement(auth.organizationId, "review_requests")) ||
    (await hasEntitlement(auth.organizationId, "review_campaigns"));

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
      <QrCampaignEditor businessId={businessId} campaignId={campaignId} />
    </Suspense>
  );
}