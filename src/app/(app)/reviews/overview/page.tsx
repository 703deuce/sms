import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewOverviewDashboard } from "@/components/reviews/review-overview-dashboard";
import { QrPerformanceCard } from "@/components/reputation/qr-campaigns/qr-performance-card";
import { ReviewGrowthCoach } from "@/components/reputation/qr-campaigns/review-growth-coach";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReviewOverviewData } from "@/lib/reviews/review-overview-data";
import { reviewOverviewPreviewData } from "@/lib/reviews/review-overview-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

async function ReviewOverviewLoaded({ businessId }: { businessId: string }) {
  const data = isDevPreviewBusiness(businessId)
    ? { ...reviewOverviewPreviewData, businessId }
    : await loadReviewOverviewData(businessId);
  return (
    <div className="space-y-4">
      <ReviewGrowthCoach businessId={businessId} data={data} />
      <ReviewOverviewDashboard businessId={businessId} data={data} />
      <QrPerformanceCard businessId={businessId} />
    </div>
  );
}

export default async function ReviewOverviewPage() {
  const businessId = await getReputationWorkspaceId();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewOverviewLoaded businessId={businessId} />
    </Suspense>
  );
}