import { createServiceClient } from "@/lib/db/client";
import { calcResponseRate, loadStoredReviews, reviewsInWindow } from "@/lib/reviews/review-store";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type { ReviewsReportPayload, WhiteLabelConfig } from "@/lib/reporting/types";

export async function buildReviewsReport(params: {
  businessId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<ReviewsReportPayload> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, organization_id")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const momentum = await loadLatestMomentumRun(params.businessId);
  const runStatus = String(momentum?.run?.status ?? "");
  if (!momentum?.run || !["ready", "partial"].includes(runStatus)) {
    throw new Error(
      "No completed review momentum audit found. Run a Reviews Momentum audit first."
    );
  }

  const targetEntity = momentum.entities.find((e) => e.entity_type === "target");
  const competitors = momentum.entities.filter((e) => e.entity_type === "competitor");

  const stored = await loadStoredReviews(supabase, {
    businessId: params.businessId,
    lookbackDays: 90,
    limit: 500,
  });
  const targetStored = stored.filter((r) => !r.competitor_id);
  const last90 = reviewsInWindow(targetStored, 90);
  const responseRate = calcResponseRate(last90);
  const unanswered90d = last90.filter((r) => !r.owner_response_text?.trim()).length;

  const tasks = (momentum.tasks ?? [])
    .slice(0, 12)
    .map((t) => ({
      title: String((t as { title?: string }).title ?? "Task"),
      description: ((t as { description?: string | null }).description as string | null) ?? null,
      priority: ((t as { priority?: string | null }).priority as string | null) ?? null,
    }));

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business,
    params.whiteLabel
  );

  return {
    reportType: "reviews",
    business: {
      id: business.id,
      name: business.name?.trim() || "Business",
    },
    parameters: {
      runId: momentum.run.id as string,
      runStatus: String(momentum.run.status ?? null),
      auditedAt: (momentum.run.created_at as string) ?? null,
      previousReviews30d: momentum.previousTarget30d,
    },
    target: {
      name:
        (targetEntity?.name as string | undefined)?.trim() ||
        business.name?.trim() ||
        "You",
      rating: (targetEntity?.rating_current as number | null | undefined) ?? null,
      totalReviews: Number(targetEntity?.total_reviews_current ?? 0),
      reviews7d: Number(targetEntity?.reviews_7d ?? 0),
      reviews30d: Number(targetEntity?.reviews_30d ?? 0),
      reviews90d: Number(targetEntity?.reviews_90d ?? 0),
      avgReviewsPerWeek:
        targetEntity?.avg_reviews_per_week != null
          ? Number(targetEntity.avg_reviews_per_week)
          : null,
      daysSinceLastReview:
        targetEntity?.days_since_last_review != null
          ? Number(targetEntity.days_since_last_review)
          : null,
      momentumScore:
        targetEntity?.momentum_score != null ? Number(targetEntity.momentum_score) : null,
      momentumLabel: (targetEntity?.momentum_label as string | null | undefined) ?? null,
      gapToTop3_30d:
        targetEntity?.gap_to_top3_30d != null ? Number(targetEntity.gap_to_top3_30d) : null,
      recommendedWeeklyTarget:
        targetEntity?.recommended_weekly_target != null
          ? Number(targetEntity.recommended_weekly_target)
          : null,
      responseRate,
      unanswered90d,
    },
    competitors: competitors.map((c) => ({
      name: String(c.name ?? "Competitor"),
      rating: (c.rating_current as number | null | undefined) ?? null,
      totalReviews: Number(c.total_reviews_current ?? 0),
      reviews30d: Number(c.reviews_30d ?? 0),
      avgReviewsPerWeek:
        c.avg_reviews_per_week != null ? Number(c.avg_reviews_per_week) : null,
      momentumScore: c.momentum_score != null ? Number(c.momentum_score) : null,
      momentumLabel: (c.momentum_label as string | null | undefined) ?? null,
    })),
    tasks,
    summary: ((momentum.run as { ai_summary?: string | null }).ai_summary as string | null) ?? null,
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}
