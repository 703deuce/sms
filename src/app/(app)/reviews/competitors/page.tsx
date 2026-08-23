import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CompetitorIntelligenceDashboard } from "@/components/reviews/competitor-intelligence-dashboard";
import { ReputationEmptySyncState } from "@/components/reputation/reputation-sync-button";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadCompetitorIntelligenceData } from "@/lib/reviews/competitor-intelligence-data";
import { competitorIntelligencePreviewData } from "@/lib/reviews/competitor-intelligence-preview-data";
import { getReputationWorkspaceId } from "@/lib/reputation/workspace-context";

async function CompetitorIntelligenceLoaded({ businessId }: { businessId: string }) {
  if (isDevPreviewBusiness(businessId)) {
    return (
      <CompetitorIntelligenceDashboard
        businessId={businessId}
        data={{ ...competitorIntelligencePreviewData, businessId }}
      />
    );
  }

  try {
    const live = await loadCompetitorIntelligenceData(businessId);
    if (live.leaderboardRows.length === 0) {
      return (
        <ReputationEmptySyncState
          businessId={businessId}
          title="No competitor review data yet"
          description="Refresh reputation data once to pull your reviews and nearby competitor volumes into this leaderboard."
        />
      );
    }
    return <CompetitorIntelligenceDashboard businessId={businessId} data={live} />;
  } catch (err) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="Couldn’t load competitor intelligence"
        description={err instanceof Error ? err.message : "Refresh reputation data and try again."}
      />
    );
  }
}

export default async function ReputationCompetitorsPage({
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
      <CompetitorIntelligenceLoaded businessId={businessId} />
    </Suspense>
  );
}