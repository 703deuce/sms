import type { EntityMomentumMetrics } from "@/lib/reviews/metrics";
import type { ResponseAudit } from "@/lib/reputation/response-audit";
import type { KeywordGapRow } from "@/lib/reputation/keywords";

export function computeReputationHealthScore(params: {
  rating: number | null;
  totalReviews: number;
  competitorAvgReviews: number;
  targetMetrics: EntityMomentumMetrics;
  responseAudit: ResponseAudit;
  keywordGaps: KeywordGapRow[];
  daysSinceLastReview: number | null;
}): number {
  const ratingScore = params.rating != null ? Math.min(100, (params.rating / 5) * 100) * 0.2 : 0;

  const volDenom = Math.max(params.competitorAvgReviews, 1);
  const volumeScore = Math.min(100, (params.totalReviews / volDenom) * 100) * 0.2;

  const momentumScore = (params.targetMetrics.momentumScore / 100) * 25;

  const responseScore = (params.responseAudit.responseRate / 100) * 15;

  const highGaps = params.keywordGaps.filter((g) => g.priority === "high" && g.gap > 0).length;
  const keywordCoverage = Math.max(0, 100 - highGaps * 15);
  const keywordScore = (keywordCoverage / 100) * 15;

  let recencyScore = 0;
  if (params.daysSinceLastReview != null) {
    if (params.daysSinceLastReview <= 7) recencyScore = 5;
    else if (params.daysSinceLastReview <= 14) recencyScore = 3;
    else if (params.daysSinceLastReview <= 30) recencyScore = 1;
  }

  return Math.round(
    Math.min(100, Math.max(0, ratingScore + volumeScore + momentumScore + responseScore + keywordScore + recencyScore))
  );
}
