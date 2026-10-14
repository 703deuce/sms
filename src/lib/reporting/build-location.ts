import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow, ScanBatchRow } from "@/lib/db/types";
import {
  buildEntityGridCells,
  buildYouEntity,
} from "@/lib/maps/grid-entity";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  kpisFromRanks,
  pct,
  round1,
} from "@/lib/reporting/metrics";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  LocationReportPayload,
  ReportKpis,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

type KeywordMetric = LocationReportPayload["keywords"][number];

type ScanEntry = {
  scanId: string;
  scannedAt: string;
  keywordId: string | null;
  keyword: string;
  locationId: string | null;
  metrics: {
    averageRank?: number | null;
    top3Cells?: number;
    totalCells?: number;
    visibilityScore?: number;
  };
};

function emptyKpis(): ReportKpis {
  return {
    arp: null,
    atrp: null,
    solv: 0,
    top3Pct: 0,
    top10Pct: 0,
    notFoundPct: 0,
    visibilityScore: 0,
    bestRank: null,
    worstRank: null,
    totalCells: 0,
    foundCells: 0,
  };
}

function aggregateKeywordKpis(rows: KeywordMetric[]): ReportKpis {
  const withArp = rows.filter((r) => r.arp != null);
  const withAtrp = rows.filter((r) => r.atrp != null);
  const withSolv = rows.filter((r) => r.solv != null);
  const arp =
    withArp.length > 0
      ? round1(withArp.reduce((s, r) => s + (r.arp as number), 0) / withArp.length)
      : null;
  const atrp =
    withAtrp.length > 0
      ? round1(withAtrp.reduce((s, r) => s + (r.atrp as number), 0) / withAtrp.length)
      : null;
  const solv =
    withSolv.length > 0
      ? Math.round(
          (withSolv.reduce((s, r) => s + (r.solv as number), 0) / withSolv.length) * 100
        ) / 100
      : 0;

  return {
    ...emptyKpis(),
    arp,
    atrp,
    solv,
    top3Pct: solv,
    totalCells: rows.length,
    foundCells: withArp.length,
  };
}

async function metricsForBatch(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  keywordId: string | null,
  business: BusinessRow
): Promise<{ arp: number | null; atrp: number | null; solv: number | null }> {
  const gridData = await loadScanGridData(supabase, scanId, keywordId);
  if (!gridData) {
    return { arp: null, atrp: null, solv: null };
  }
  const you = buildYouEntity((gridData.business ?? business) as BusinessRow);
  const cells = buildEntityGridCells(gridData.points, gridData.results, you);
  const ranks = cells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
  const kpis = kpisFromRanks(ranks);
  return { arp: kpis.arp, atrp: kpis.atrp, solv: kpis.solv };
}

function fallbackMetrics(entry: ScanEntry): {
  arp: number | null;
  atrp: number | null;
  solv: number | null;
} {
  const arp = round1(entry.metrics.averageRank ?? null);
  return {
    arp,
    atrp: null,
    solv:
      entry.metrics.top3Cells != null && entry.metrics.totalCells
        ? pct(entry.metrics.top3Cells, entry.metrics.totalCells)
        : null,
  };
}

/**
 * Prefer business-location scans (location_id null).
 * If every scan is tied to a rank location, pin to one location (newest) —
 * never mix centers for latest vs previous Δ ARP.
 */
function preferBusinessLocationScans(scans: ScanEntry[]): ScanEntry[] {
  const primary = scans.filter((s) => s.locationId == null);
  if (primary.length > 0) return primary;
  const anchorId = scans[0]?.locationId ?? null;
  return scans.filter((s) => s.locationId === anchorId);
}

function inRange(iso: string, fromMs: number | null, toMs: number | null): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (fromMs != null && t < fromMs) return false;
  if (toMs != null && t > toMs) return false;
  return true;
}

export async function buildLocationReport(params: {
  businessId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
  /** Inclusive period start (ISO). When set with dateTo, latest scans are taken from this window. */
  dateFrom?: string | null;
  dateTo?: string | null;
  /**
   * When set, keyword Δ uses this scan as the prior when it matches the keyword
   * (campaign baseline), otherwise falls back to previous scan in series.
   */
  baselineScanBatchId?: string | null;
}): Promise<LocationReportPayload> {
  const supabase = createServiceClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const fromMs = params.dateFrom ? new Date(params.dateFrom).getTime() : null;
  const toMs = params.dateTo ? new Date(params.dateTo).getTime() : null;
  const hasPeriod =
    fromMs != null &&
    toMs != null &&
    Number.isFinite(fromMs) &&
    Number.isFinite(toMs);

  const { data: batches } = await supabase
    .from("scan_batches")
    .select(
      "id, created_at, finished_at, status, aggregate_metrics, confidence_summary, grid_size, radius_meters, location_id"
    )
    .eq("business_id", params.businessId)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: false })
    .limit(200);

  const byKeyword = new Map<string, ScanEntry[]>();

  for (const batch of (batches ?? []) as ScanBatchRow[]) {
    const conf = (batch.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    const keywordId = conf.keyword_ids?.[0] ?? null;
    const keyword = conf.keyword_label?.trim() || "Historical scan";
    const key = keywordId ?? keyword.toLowerCase();
    const list = byKeyword.get(key) ?? [];
    list.push({
      scanId: batch.id,
      scannedAt: batch.finished_at ?? batch.created_at,
      keywordId,
      keyword,
      locationId: batch.location_id ?? null,
      metrics: (batch.aggregate_metrics ?? {}) as {
        averageRank?: number | null;
        top3Cells?: number;
        totalCells?: number;
        visibilityScore?: number;
      },
    });
    byKeyword.set(key, list);
  }

  const keywords: KeywordMetric[] = [];
  const baselineId = params.baselineScanBatchId?.trim() || null;

  for (const [, allScans] of byKeyword) {
    const scans = preferBusinessLocationScans(allScans);
    // Newest first already from batch query; keep that order.
    const ordered = [...scans].sort(
      (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
    );

    let latest: ScanEntry | undefined;
    if (hasPeriod) {
      latest = ordered.find((s) => inRange(s.scannedAt, fromMs, toMs));
    } else {
      latest = ordered[0];
    }
    if (!latest) continue;

    let previous: ScanEntry | undefined;
    if (baselineId) {
      previous = ordered.find((s) => s.scanId === baselineId);
    }
    if (!previous) {
      previous = ordered.find((s) => s.scanId !== latest!.scanId);
    }

    let latestMetrics = fallbackMetrics(latest);
    const recomputed = await metricsForBatch(
      supabase,
      latest.scanId,
      latest.keywordId,
      business as BusinessRow
    );
    if (recomputed.arp != null || recomputed.solv != null) {
      latestMetrics = recomputed;
    }

    let changeArp: number | null = null;
    if (previous) {
      const prevRecomputed = await metricsForBatch(
        supabase,
        previous.scanId,
        previous.keywordId,
        business as BusinessRow
      );
      const prevFallback = fallbackMetrics(previous);
      const prevArp = prevRecomputed.arp ?? prevFallback.arp;
      if (latestMetrics.arp != null && prevArp != null) {
        changeArp = Math.round((prevArp - latestMetrics.arp) * 10) / 10;
      }
    }

    keywords.push({
      keyword: latest.keyword,
      keywordId: latest.keywordId,
      scanId: latest.scanId,
      scannedAt: latest.scannedAt,
      priorScanId: previous?.scanId ?? null,
      priorScannedAt: previous?.scannedAt ?? null,
      arp: latestMetrics.arp,
      atrp: latestMetrics.atrp,
      solv: latestMetrics.solv,
      changeArp,
    });
  }

  if (keywords.length === 0) {
    throw new Error(
      hasPeriod
        ? "No completed scans in the selected period. Widen the dates or run a grid scan."
        : "No completed scans to include. Run a grid scan first."
    );
  }

  keywords.sort((a, b) => (a.arp ?? 99) - (b.arp ?? 99));

  const rising = keywords
    .filter((k) => k.changeArp != null && k.changeArp > 0)
    .sort((a, b) => (b.changeArp ?? 0) - (a.changeArp ?? 0))
    .map((k) => k.keyword);
  const falling = keywords
    .filter((k) => k.changeArp != null && k.changeArp < 0)
    .sort((a, b) => (a.changeArp ?? 0) - (b.changeArp ?? 0))
    .map((k) => k.keyword);

  const dates = keywords
    .map((k) => k.scannedAt)
    .filter((d): d is string => !!d)
    .sort();

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business as BusinessRow,
    params.whiteLabel
  );

  const periodFrom = params.dateFrom ?? dates[0] ?? new Date().toISOString();
  const periodTo = params.dateTo ?? dates[dates.length - 1] ?? new Date().toISOString();

  const { buildComparisonSection } = await import(
    "@/lib/reporting/comparison-heatmaps"
  );
  let comparison = null;
  const compareKeyword = keywords.find((k) => k.scanId && k.priorScanId) ?? null;
  if (compareKeyword?.scanId && compareKeyword.priorScanId) {
    try {
      comparison = await buildComparisonSection({
        businessId: params.businessId,
        baselineScanId: compareKeyword.priorScanId,
        currentScanId: compareKeyword.scanId,
        mode: baselineId ? "baseline" : "prior_period",
        keywordId: compareKeyword.keywordId,
      });
    } catch {
      comparison = null;
    }
  }

  return {
    reportType: "location",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
      dateFrom: periodFrom,
      dateTo: periodTo,
      keywordCount: keywords.length,
    },
    aggregate: aggregateKeywordKpis(keywords),
    keywords,
    rising,
    falling,
    whiteLabel,
    generatedAt: new Date().toISOString(),
    periodLabel: `${new Date(periodFrom).toLocaleDateString()} – ${new Date(periodTo).toLocaleDateString()}`,
    comparison,
  };
}
