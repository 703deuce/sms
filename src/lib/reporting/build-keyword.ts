import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow } from "@/lib/db/types";
import {
  buildEntityGridCells,
  buildYouEntity,
} from "@/lib/maps/grid-entity";
import { loadLocationScanSummaries, loadScanGridData } from "@/lib/maps/scan-queries";
import {
  kpisFromRanks,
  round1,
} from "@/lib/reporting/metrics";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  KeywordReportPayload,
  ReportKpis,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

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

function aggregateLocationKpis(
  rows: KeywordReportPayload["locations"]
): ReportKpis {
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

  // Rollup aggregate across locations — ARP/ATRP/SoLV only (no fake visibility).
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
  if (!gridData) return { arp: null, atrp: null, solv: null };
  const you = buildYouEntity((gridData.business ?? business) as BusinessRow);
  const cells = buildEntityGridCells(gridData.points, gridData.results, you);
  const ranks = cells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
  const kpis = kpisFromRanks(ranks);
  return { arp: kpis.arp, atrp: kpis.atrp, solv: kpis.solv };
}

export async function buildKeywordReport(params: {
  businessId: string;
  keywordId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<KeywordReportPayload> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  let keywordId = params.keywordId ?? null;
  let keywordLabel = "Keyword";

  if (keywordId) {
    const { data: kw } = await supabase
      .from("business_keywords")
      .select("id, keyword")
      .eq("id", keywordId)
      .eq("business_id", params.businessId)
      .maybeSingle();
    if (!kw) throw new Error("Keyword not found");
    keywordLabel = String(kw.keyword);
  } else {
    const { data: primary } = await supabase
      .from("business_keywords")
      .select("id, keyword")
      .eq("business_id", params.businessId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!primary) throw new Error("Add a keyword before generating a Keyword report");
    keywordId = primary.id as string;
    keywordLabel = String(primary.keyword);
  }

  const gridSize = params.gridSize && params.gridSize > 0 ? params.gridSize : 7;
  const radiusMeters =
    params.radiusMeters && params.radiusMeters > 0 ? params.radiusMeters : 8047;

  const summaries = await loadLocationScanSummaries(
    supabase,
    params.businessId,
    keywordId,
    gridSize,
    radiusMeters
  );

  const locations: KeywordReportPayload["locations"] = [];
  for (const s of summaries) {
    let arp = round1(s.latestRank);
    let atrp: number | null = null;
    let solv = s.solv != null ? Number(s.solv) : null;

    if (s.latestScanId) {
      const recomputed = await metricsForBatch(
        supabase,
        s.latestScanId,
        keywordId,
        business as BusinessRow
      );
      if (recomputed.arp != null || recomputed.solv != null) {
        arp = recomputed.arp;
        atrp = recomputed.atrp;
        solv = recomputed.solv;
      }
    }

    locations.push({
      locationId: s.id,
      name: s.name,
      address: s.address,
      isBusinessLocation: Boolean(s.isBusinessLocation),
      scanId: s.latestScanId,
      scannedAt: s.lastScannedAt,
      arp,
      atrp,
      solv,
    });
  }

  const scannedLocations = locations.filter((l) => l.scanId != null);
  if (scannedLocations.length === 0) {
    throw new Error(
      "No completed scans to include for this keyword. Run a grid scan first."
    );
  }

  scannedLocations.sort((a, b) => (a.arp ?? 99) - (b.arp ?? 99));

  const dates = scannedLocations
    .map((l) => l.scannedAt)
    .filter((d): d is string => !!d)
    .sort();

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business as BusinessRow,
    params.whiteLabel
  );

  return {
    reportType: "keyword",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
      keyword: keywordLabel,
      keywordId,
      gridSize,
      radiusMeters,
      locationCount: scannedLocations.length,
      dateFrom: dates[0] ?? new Date().toISOString(),
      dateTo: dates[dates.length - 1] ?? new Date().toISOString(),
    },
    aggregate: aggregateLocationKpis(scannedLocations),
    locations: scannedLocations,
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}
