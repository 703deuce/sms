import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow } from "@/lib/db/types";
import {
  buildEntityGridCells,
  buildYouEntity,
} from "@/lib/maps/grid-entity";
import { loadScanHistory } from "@/lib/maps/scan-history";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  deltaMetric,
  kpisFromRanks,
  pct,
  round1,
} from "@/lib/reporting/metrics";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type { TrendReportPayload, WhiteLabelConfig } from "@/lib/reporting/types";

const RECOMPUTE_GRID_THRESHOLD = 12;

export async function buildTrendReport(params: {
  businessId: string;
  keywordId?: string | null;
  locationId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  whiteLabel?: Partial<WhiteLabelConfig>;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<TrendReportPayload> {
  const supabase = createServiceClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, organization_id")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  let keywordId = params.keywordId ?? null;
  if (!keywordId) {
    throw new Error("keywordId is required for trend reports");
  }

  // Default to business location when omitted — never mix all locations into one series.
  const locationId = params.locationId !== undefined ? params.locationId : null;

  const history = await loadScanHistory(supabase, {
    businessId: params.businessId,
    keywordId,
    locationId,
    gridSize: params.gridSize,
    radiusMeters: params.radiusMeters,
    mode: "target",
  });

  if (history.length < 2) {
    throw new Error("Need at least 2 scans to build a trend report");
  }

  const fromMs = params.dateFrom ? new Date(params.dateFrom).getTime() : null;
  const toMs = params.dateTo ? new Date(params.dateTo).getTime() : null;
  const filteredHistory =
    fromMs != null && toMs != null && Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? history.filter((entry) => {
          const t = new Date(entry.completed_at).getTime();
          return Number.isFinite(t) && t >= fromMs && t <= toMs;
        })
      : history;

  // Need prior point for deltas — if period filter leaves <2, keep last 2 overall.
  const workingHistory =
    filteredHistory.length >= 2
      ? filteredHistory
      : history.slice(-2);

  if (workingHistory.length < 2) {
    throw new Error("Need at least 2 scans to build a trend report");
  }

  const recompute = workingHistory.length <= RECOMPUTE_GRID_THRESHOLD;
  const series: TrendReportPayload["series"] = [];

  for (const entry of workingHistory) {
    if (recompute) {
      const gridData = await loadScanGridData(supabase, entry.scan_id, entry.keyword_id);
      if (gridData) {
        const you = buildYouEntity((gridData.business ?? business) as BusinessRow);
        const cells = buildEntityGridCells(gridData.points, gridData.results, you);
        const ranks = cells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
        const kpis = kpisFromRanks(ranks);
        series.push({
          scanId: entry.scan_id,
          date: entry.completed_at,
          arp: kpis.arp,
          atrp: kpis.atrp,
          solv: kpis.solv,
          top3Pct: kpis.top3Pct,
          top10Pct: kpis.top10Pct,
          visibilityScore: kpis.visibilityScore,
        });
        continue;
      }
    }

    const totalCells =
      entry.grid_size > 0 ? entry.grid_size * entry.grid_size : null;
    const top3Pct =
      totalCells != null && entry.top3_count != null
        ? pct(entry.top3_count, totalCells)
        : entry.solv;
    const arp = round1(entry.avg_rank);
    series.push({
      scanId: entry.scan_id,
      date: entry.completed_at,
      arp,
      // aggregate avg_rank is ARP — leave ATRP null when grid is not recomputed
      atrp: null,
      solv: entry.solv,
      top3Pct,
      top10Pct: entry.visibility_score,
      visibilityScore: entry.visibility_score,
    });
  }

  const previousPoint = series[series.length - 2]!;
  const currentPoint = series[series.length - 1]!;
  const first = workingHistory[0]!;
  const last = workingHistory[workingHistory.length - 1]!;

  const whiteLabel = await resolveOrgWhiteLabel(supabase, business, params.whiteLabel);

  let keywordLabel = last.keyword ?? first.keyword ?? "—";
  if (params.keywordId) {
    const { data: kw } = await supabase
      .from("business_keywords")
      .select("keyword")
      .eq("id", params.keywordId)
      .maybeSingle();
    if (kw?.keyword) keywordLabel = String(kw.keyword);
  }

  const { buildComparisonSection } = await import(
    "@/lib/reporting/comparison-heatmaps"
  );
  let comparison = null;
  try {
    comparison = await buildComparisonSection({
      businessId: params.businessId,
      baselineScanId: previousPoint.scanId,
      currentScanId: currentPoint.scanId,
      mode: "prior_period",
      keywordId: params.keywordId,
    });
  } catch {
    comparison = null;
  }

  const dateFrom = params.dateFrom ?? first.completed_at;
  const dateTo = params.dateTo ?? last.completed_at;

  return {
    reportType: "trend",
    business: { id: business.id, name: business.name },
    parameters: {
      keyword: keywordLabel,
      gridSize: last.grid_size,
      radiusMeters: last.radius_meters,
      locationId,
      dateFrom,
      dateTo,
      scanCount: series.length,
    },
    series,
    current: {
      arp: currentPoint.arp,
      atrp: currentPoint.atrp,
      solv: currentPoint.solv,
    },
    previous: {
      arp: previousPoint.arp,
      atrp: previousPoint.atrp,
      solv: previousPoint.solv,
    },
    deltas: {
      // Positive ARP/ATRP = improved (rank went down). Positive SoLV = improved (share up).
      // Matches Location / Maps Campaign Δ ARP convention (previous − current for ranks).
      arp: deltaMetric(previousPoint.arp, currentPoint.arp),
      atrp: deltaMetric(previousPoint.atrp, currentPoint.atrp),
      solv: deltaMetric(currentPoint.solv, previousPoint.solv),
    },
    whiteLabel,
    generatedAt: new Date().toISOString(),
    comparison,
    periodLabel: `${new Date(dateFrom).toLocaleDateString()} – ${new Date(dateTo).toLocaleDateString()}`,
  };
}
