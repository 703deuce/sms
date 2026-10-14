import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewVelocityDashboard } from "@/components/reviews/review-velocity-dashboard";
import { ReputationEmptySyncState } from "@/components/reputation/reputation-sync-button";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReviewAnalyticsData } from "@/lib/reviews/review-analytics-data";
import { reviewAnalyticsPreviewData } from "@/lib/reviews/review-analytics-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

async function ReviewVelocityLoaded({ businessId }: { businessId: string }) {
  if (isDevPreviewBusiness(businessId)) {
    return (
      <ReviewVelocityDashboard
        businessId={businessId}
        data={{ ...reviewAnalyticsPreviewData, businessId } as typeof reviewAnalyticsPreviewData}
      />
    );
  }

  let live: Awaited<ReturnType<typeof loadReviewAnalyticsData>>;
  try {
    live = await loadReviewAnalyticsData(businessId);
  } catch (err) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="Couldn’t load review velocity"
        description={err instanceof Error ? err.message : "Refresh reputation data and try again."}
      />
    );
  }

  const hasTimeline = live.timelinePoints.some((point) => point.you > 0 || point.competitorAvg > 0);
  if (!hasTimeline) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="No review velocity data yet"
        description="Run one reputation sync to fetch your Google reviews and competitor velocity. Review Velocity, Feed, Competitors, and Insights all fill from that same run."
      />
    );
  }
  return <ReviewVelocityDashboard businessId={businessId} data={live} />;
}

export default async function ReputationAnalyticsPage() {
  const businessId = await getReputationWorkspaceId();

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ReviewVelocityLoaded businessId={businessId} />
    </Suspense>
  );
}