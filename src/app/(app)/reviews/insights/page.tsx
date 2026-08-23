import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewInsightsDashboard } from "@/components/reviews/review-insights-dashboard";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReviewInsightsData } from "@/lib/reviews/review-insights-data";
import { reviewInsightsPreviewData } from "@/lib/reviews/review-insights-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

async function ReviewInsightsLoaded({ businessId }: { businessId: string }) {
  const data = isDevPreviewBusiness(businessId)
    ? { ...reviewInsightsPreviewData, businessId }
    : await loadReviewInsightsData(businessId);
  return <ReviewInsightsDashboard businessId={businessId} data={data} />;
}

export default async function ReputationInsightsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewInsightsLoaded businessId={businessId} />
    </Suspense>
  );
}