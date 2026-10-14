import { createServiceClient } from "@/lib/db/client";
import { loadReputationAlertsData } from "@/lib/reputation/alerts-data";
import { loadCompetitorIntelligenceData } from "@/lib/reviews/competitor-intelligence-data";
import { loadReviewAnalyticsData } from "@/lib/reviews/review-analytics-data";
import { loadReviewInsightsData } from "@/lib/reviews/review-insights-data";

export type ReputationModulesAuditData = {
  businessId: string;
  businessName: string;
  generatedAt: string;
  analytics: Awaited<ReturnType<typeof loadReviewAnalyticsData>>;
  competitors: Awaited<ReturnType<typeof loadCompetitorIntelligenceData>>;
  insights: Awaited<ReturnType<typeof loadReviewInsightsData>>;
  alerts: Awaited<ReturnType<typeof loadReputationAlertsData>>;
  mapsVisibility: {
    latestScanId: string | null;
    latestFinishedAt: string | null;
    latestStatus: string | null;
    scanCount30d: number;
    gridSize: number | null;
    summary: string;
    aggregateMetrics: Record<string, unknown> | null;
  };
  campaignCohorts: Array<{
    campaignId: string;
    name: string;
    status: string;
    startedAt: string | null;
    createdAt: string | null;
    sentCount: number;
    failedCount: number;
    attributedCount: number;
    confirmedCount: number;
    likelyCount: number;
  }>;
  recommendedActions: {
    days30: string[];
    days60: string[];
    days90: string[];
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function loadMapsVisibilitySummary(businessId: string): Promise<ReputationModulesAuditData["mapsVisibility"]> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("scan_batches")
    .select("id, status, grid_size, finished_at, created_at, aggregate_metrics")
    .eq("business_id", businessId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data?.length) {
    return {
      latestScanId: null,
      latestFinishedAt: null,
      latestStatus: null,
      scanCount30d: 0,
      gridSize: null,
      summary: "No Maps visibility scans finished in the last 30 days.",
      aggregateMetrics: null,
    };
  }

  const latest = data[0]!;
  const aggregateMetrics = asRecord(latest.aggregate_metrics);
  return {
    latestScanId: latest.id,
    latestFinishedAt: latest.finished_at ?? null,
    latestStatus: String(latest.status ?? "unknown"),
    scanCount30d: data.length,
    gridSize: latest.grid_size != null ? Number(latest.grid_size) : null,
    summary: `${data.length} scan${data.length === 1 ? "" : "s"} in 30 days; latest status ${String(latest.status ?? "unknown")}.`,
    aggregateMetrics,
  };
}

async function loadCampaignCohorts(businessId: string): Promise<ReputationModulesAuditData["campaignCohorts"]> {
  const supabase = createServiceClient();
  const { data: campaigns, error } = await supabase
    .from("review_request_campaigns")
    .select("id, name, status, started_at, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !campaigns?.length) return [];

  const campaignIds = campaigns.map((campaign) => campaign.id as string);
  const [messagesResult, attributionResult] = await Promise.all([
    supabase
      .from("review_request_messages")
      .select("campaign_id, status")
      .in("campaign_id", campaignIds)
      .limit(5000),
    supabase
      .from("review_campaign_attributions")
      .select("campaign_id, attribution_level")
      .in("campaign_id", campaignIds)
      .limit(5000),
  ]);

  const sentStatuses = new Set(["sent", "delivered", "clicked"]);
  return campaigns.map((campaign) => {
    const messages = (messagesResult.data ?? []).filter((message) => message.campaign_id === campaign.id);
    const attributions = (attributionResult.data ?? []).filter((attr) => attr.campaign_id === campaign.id);
    return {
      campaignId: campaign.id,
      name: String(campaign.name ?? "Campaign"),
      status: String(campaign.status ?? "unknown"),
      startedAt: campaign.started_at ?? null,
      createdAt: campaign.created_at ?? null,
      sentCount: messages.filter((message) => sentStatuses.has(String(message.status))).length,
      failedCount: messages.filter((message) => String(message.status) === "failed").length,
      attributedCount: attributions.length,
      confirmedCount: attributions.filter((attr) => attr.attribution_level === "confirmed").length,
      likelyCount: attributions.filter((attr) => attr.attribution_level === "likely").length,
    };
  });
}

function recommendedActions(params: {
  analytics: ReputationModulesAuditData["analytics"];
  competitors: ReputationModulesAuditData["competitors"];
  insights: ReputationModulesAuditData["insights"];
  alerts: ReputationModulesAuditData["alerts"];
}): ReputationModulesAuditData["recommendedActions"] {
  const days30: string[] = [];
  const days60: string[] = [];
  const days90: string[] = [];

  if (params.insights.responsePerformance.unansweredNegative > 0) {
    days30.push(`Respond to ${params.insights.responsePerformance.unansweredNegative} unanswered negative review(s).`);
  }
  if (params.alerts.activeAlerts.length > 0) {
    days30.push(`Clear or resolve ${params.alerts.activeAlerts.length} active reputation alert(s).`);
  }
  if (params.analytics.rolling30d <= params.analytics.priorPeriod.rolling30d) {
    days30.push("Launch a short review request cohort to restore 30-day velocity.");
  }
  if (!days30.length) {
    days30.push("Maintain weekly review requests and monitor alerts for new low-rating reviews.");
  }

  const wideningGap = params.competitors.gapRows.find((row) => row.gapExpanding);
  if (wideningGap) {
    days60.push(`Close the widening review gap vs ${wideningGap.competitorName} with a weekly target above their monthly velocity.`);
  }
  if (params.competitors.positioningOpportunities.length > 0) {
    days60.push(`Use competitor complaint themes in positioning: ${params.competitors.positioningOpportunities[0]!.sourceTheme}.`);
  }
  if (params.insights.responseQuality.qualitySummary.genericPct > 25) {
    days60.push("Rewrite owner response templates to include reviewer-specific details and resolution language.");
  }
  if (!days60.length) {
    days60.push("Build a repeatable review request cadence and measure campaign attribution by cohort.");
  }

  if (params.analytics.momentumStatus === "Slowing" || params.analytics.momentumStatus === "Stalled") {
    days90.push("Re-run momentum analysis monthly until status returns to Stable or Accelerating.");
  }
  if (params.competitors.gapRows.some((row) => row.estimatedCatchUpMonths == null && row.totalGap > 0)) {
    days90.push("Create a 90-day review-gap plan because at least one competitor cannot be caught at the current pace.");
  }
  days90.push("Refresh Maps visibility scans and compare scan outcomes against review velocity gains.");

  return { days30, days60, days90 };
}

export async function loadReputationModulesAudit(businessId: string): Promise<ReputationModulesAuditData> {
  const [analytics, competitors, insights, alerts, mapsVisibility, campaignCohorts] = await Promise.all([
    loadReviewAnalyticsData(businessId),
    loadCompetitorIntelligenceData(businessId),
    loadReviewInsightsData(businessId),
    loadReputationAlertsData(businessId),
    loadMapsVisibilitySummary(businessId),
    loadCampaignCohorts(businessId),
  ]);

  return {
    businessId,
    businessName: analytics.businessName,
    generatedAt: new Date().toISOString(),
    analytics,
    competitors,
    insights,
    alerts,
    mapsVisibility,
    campaignCohorts,
    recommendedActions: recommendedActions({ analytics, competitors, insights, alerts }),
  };
}
