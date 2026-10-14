import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import { OverviewMomentumCard } from "@/components/overview/overview-momentum-card";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import type { MomentumChartPoint } from "@/components/overview/overview-momentum-card";

function buildChartData(
  metricsJson: Record<string, unknown> | undefined
): MomentumChartPoint[] {
  const dailyExact7d =
    (metricsJson?.dailyExact7d as Array<{ date: string; count: number }>) ?? [];
  const weeklyBuckets8to30 =
    (metricsJson?.weeklyBuckets8to30 as Array<{ label: string; count: number }>) ?? [];
  const dailyCounts30d =
    (metricsJson?.dailyCounts30d as Array<{ date: string; count: number }>) ?? [];

  if (dailyExact7d.length > 0 || weeklyBuckets8to30.length > 0) {
    return [
      ...dailyExact7d.map((d) => ({
        label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: d.count,
      })),
      ...weeklyBuckets8to30.map((w) => ({ label: w.label, value: w.count })),
    ].slice(-12);
  }

  if (dailyCounts30d.length > 0) {
    return dailyCounts30d.slice(-12).map((d) => ({
      label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: d.count,
    }));
  }

  const trend90 =
    (metricsJson?.trendBuckets90d as Array<{ label: string; count: number }>) ?? [];
  return trend90.map((b) => ({ label: b.label, value: b.count }));
}

function marketPotentialLabel(
  level: string | undefined,
  momentumLabel: MomentumLabel | null
): string | null {
  if (momentumLabel === "Accelerating" || momentumLabel === "Exploding") return "High";
  if (momentumLabel === "Healthy" || momentumLabel === "Stable") return "Medium";
  if (level === "very_competitive") return "High";
  if (level === "moderate") return "Medium";
  if (level === "low") return "Low";
  return null;
}

function momentumAlert(label: MomentumLabel | null): string | null {
  if (!label) return null;
  if (label === "Accelerating" || label === "Exploding") {
    return "Your momentum is accelerating. Keep building fresh reviews to outpace competitors.";
  }
  if (label === "Healthy") {
    return "Your review momentum is healthy. Stay consistent to maintain your edge.";
  }
  if (label === "Slowing" || label === "Dormant") {
    return "Review momentum is slowing. Focus on fresh reviews to regain competitive pace.";
  }
  return "Keep building fresh reviews to maintain visibility in your market.";
}

export async function ReviewMomentumOverviewSection({ businessId }: { businessId: string }) {
  const data = await loadLatestMomentumRun(businessId);
  const target = data?.entities.find((e) => e.entity_type === "target");
  const metricsJson = target?.metrics_json as Record<string, unknown> | undefined;
  const market =
    (metricsJson?.marketInsights as ReturnType<typeof buildMarketInsightsFromEntityRows>) ??
    (data?.entities ? buildMarketInsightsFromEntityRows(data.entities) : null);

  const velocityAvailable =
    (metricsJson?.velocityAvailable as boolean | undefined) ??
    metricsJson?.unavailable !== true;

  const momentumLabel = (target?.momentum_label as MomentumLabel) ?? null;

  return (
    <OverviewMomentumCard
      businessId={businessId}
      hasData={Boolean(target && velocityAvailable)}
      momentumScore={target?.momentum_score ?? null}
      momentumLabel={momentumLabel}
      weeklyPaceGap={market?.weeklyPaceGap ?? null}
      targetSharePct={market?.targetSharePct30d ?? null}
      reviews30d={target?.reviews_30d ?? null}
      marketPotential={marketPotentialLabel(market?.marketActivityLevel, momentumLabel)}
      chartData={buildChartData(metricsJson)}
      alertMessage={momentumAlert(momentumLabel)}
    />
  );
}
