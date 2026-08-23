import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow, ScanResultRow } from "@/lib/db/types";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import { rankHex, rankTextColor } from "@/lib/maps/colors";
import {
  buildEntityGridCells,
  buildYouEntity,
  entitiesFromTopCompetitors,
  entityKeyFromParts,
  type GridEntityRef,
} from "@/lib/maps/grid-entity";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import {
  kpisFromRanks,
  mapsUrlFromPlaceId,
  pct,
  round1,
} from "@/lib/reporting/metrics";
import {
  resolveOrgWhiteLabel,
  resolveWhiteLabelCompanyName,
} from "@/lib/reporting/white-label";
import type {
  HeatmapCell,
  ReportCompetitorRow,
  SingleScanReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

function competitorRowFromEntity(
  entity: GridEntityRef,
  ranks: Array<number | null>,
  meta?: {
    rating?: number | null;
    reviewCount?: number | null;
    category?: string | null;
    address?: string | null;
    top3AppearancesHint?: number;
  }
): ReportCompetitorRow {
  const kpis = kpisFromRanks(ranks);
  const appearances = ranks.filter((r) => r != null && r <= 20).length;
  const top3Appearances =
    meta?.top3AppearancesHint ?? ranks.filter((r) => r != null && r <= 3).length;
  const placeId = entity.place_id ?? null;
  const cid = entity.cid ?? null;

  return {
    key: entity.key,
    name: entity.label || entity.name || "Competitor",
    arp: kpis.arp,
    atrp: kpis.atrp,
    solv: kpis.solv,
    top3Appearances,
    totalCells: kpis.totalCells,
    appearancePct: pct(appearances, kpis.totalCells),
    rating: meta?.rating ?? null,
    reviewCount: meta?.reviewCount ?? null,
    category: meta?.category ?? null,
    address: meta?.address ?? null,
    placeId,
    cid,
    mapsUrl: mapsUrlFromPlaceId(placeId) ?? (cid ? `https://www.google.com/maps?cid=${encodeURIComponent(cid)}` : null),
    isTarget: entity.isTarget ?? false,
  };
}

function rankDistribution(ranks: Array<number | null>): { label: string; count: number }[] {
  let top3 = 0;
  let fourTo10 = 0;
  let elevenTo20 = 0;
  let notFound = 0;
  for (const r of ranks) {
    if (r == null || r > 20) notFound++;
    else if (r <= 3) top3++;
    else if (r <= 10) fourTo10++;
    else elevenTo20++;
  }
  return [
    { label: "1-3", count: top3 },
    { label: "4-10", count: fourTo10 },
    { label: "11-20", count: elevenTo20 },
    { label: "20+/Not found", count: notFound },
  ];
}

function extractBusinessRating(results: ScanResultRow[]): {
  rating: number | null;
  reviewCount: number | null;
} {
  for (const r of results) {
    const comps = (r.top_competitors_json ?? []) as Array<{
      rating?: number;
      review_count?: number;
      is_target?: boolean;
    }>;
    // Prefer target match fields when present on result row shape.
    const anyResult = r as ScanResultRow & {
      target_rating?: number | null;
      target_review_count?: number | null;
    };
    if (anyResult.target_rating != null) {
      return {
        rating: anyResult.target_rating,
        reviewCount: anyResult.target_review_count ?? null,
      };
    }
    void comps;
  }
  return { rating: null, reviewCount: null };
}

export async function buildSingleScanReport(params: {
  businessId: string;
  scanBatchId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<SingleScanReportPayload> {
  const supabase = createServiceClient();
  const gridData = await loadScanGridData(supabase, params.scanBatchId);
  if (!gridData) throw new Error("Scan not found");
  if (gridData.batch.business_id !== params.businessId) {
    throw new Error("Scan does not belong to business");
  }

  const business = (gridData.business ?? { id: params.businessId, name: "Business" }) as BusinessRow & {
    id?: string;
  };
  const businessId = params.businessId;
  const you = buildYouEntity(business);
  const results = gridData.results as ScanResultRow[];
  const youCells = buildEntityGridCells(gridData.points, results, you);
  const ranks = youCells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
  const kpis = kpisFromRanks(ranks);

  const heatmapCells: HeatmapCell[] = [...youCells]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((c) => {
      const rank = c.pending ? null : c.notInResults ? null : c.rank;
      const color = rankHex(rank);
      return {
        label: c.label,
        row: c.row,
        col: c.col,
        rank,
        color,
        textColor: rankTextColor(color),
      };
    });

  const locationTokens = [gridData.activeKeyword?.city, gridData.activeKeyword?.state].filter(
    (t): t is string => !!t?.trim()
  );

  const topCompetitors = buildGridTopCompetitors(results, {
    excludeCid: business.cid,
    excludePlaceId: business.place_id,
    excludeName: business.name,
    targetCategory: business.primary_category,
    keyword: gridData.activeKeyword?.keyword,
    locationTokens,
    limit: 20,
  });

  const competitorEntities = entitiesFromTopCompetitors(topCompetitors, 20);
  const detailEntities = competitorEntities.slice(0, 15);

  const metaByKey = new Map(
    topCompetitors.map((c) => [
      entityKeyFromParts(c),
      {
        rating: c.rating ?? null,
        reviewCount: c.review_count ?? null,
        category: c.category ?? null,
        address: null as string | null,
        top3AppearancesHint: c.top3Appearances,
      },
    ])
  );

  const targetRow = competitorRowFromEntity(you, ranks, {
    ...extractBusinessRating(results),
    category: business.primary_category ?? null,
    address: business.address_text ?? null,
  });
  targetRow.isTarget = true;
  targetRow.key = "you";

  const competitorRows: ReportCompetitorRow[] = detailEntities.map((entity) => {
    const cells = buildEntityGridCells(gridData.points, results, entity);
    const entityRanks = cells.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
    return competitorRowFromEntity(entity, entityRanks, metaByKey.get(entity.key));
  });

  // Include remaining top competitors (15–20) with pack-level metrics only.
  for (const entity of competitorEntities.slice(15)) {
    const meta = metaByKey.get(entity.key);
    const agg = topCompetitors.find((c) => entityKeyFromParts(c) === entity.key);
    const totalCells = agg?.totalCells ?? kpis.totalCells;
    const appearances = agg?.appearances ?? 0;
    const arp = agg?.avgRank ?? null;
    // Approximate ATRP for pack-only rows: treat non-appearances as rank 21.
    const atrp =
      arp != null && totalCells > 0
        ? round1((arp * appearances + 21 * (totalCells - appearances)) / totalCells)
        : arp;
    competitorRows.push({
      key: entity.key,
      name: entity.label,
      arp,
      atrp,
      solv: pct(agg?.top3Appearances ?? 0, totalCells),
      top3Appearances: agg?.top3Appearances ?? 0,
      totalCells,
      appearancePct: pct(appearances, totalCells),
      rating: meta?.rating ?? null,
      reviewCount: meta?.reviewCount ?? null,
      category: meta?.category ?? null,
      address: null,
      placeId: entity.place_id ?? null,
      cid: entity.cid ?? null,
      mapsUrl: mapsUrlFromPlaceId(entity.place_id) ?? null,
      isTarget: false,
    });
  }

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    {
      id: businessId,
      name: business.name,
      organization_id: (business as BusinessRow).organization_id,
    },
    params.whiteLabel
  );
  const ratingInfo = extractBusinessRating(results);
  const placeId = business.place_id ?? null;
  const batch = gridData.batch;
  const keyword = gridData.activeKeyword?.keyword?.trim() || "—";

  return {
    reportType: "single_scan",
    business: {
      id: businessId,
      name: business.name?.trim() || "Business",
      address: business.address_text ?? null,
      category: business.primary_category ?? null,
      rating: ratingInfo.rating,
      reviewCount: ratingInfo.reviewCount,
      placeId,
      mapsUrl: mapsUrlFromPlaceId(placeId),
    },
    parameters: {
      keyword,
      scannedAt: batch.finished_at ?? batch.created_at,
      gridSize: batch.grid_size,
      radiusMeters: batch.radius_meters,
      pointCount: gridData.points.length,
      // Never expose provider names (Bright Data, etc.) in client-facing reports.
      platform: "maps",
      centerLabel: batch.center_label ?? null,
      scanId: batch.id,
    },
    kpis,
    heatmap: { gridSize: batch.grid_size, cells: heatmapCells },
    competitors: [targetRow, ...competitorRows],
    rankDistribution: rankDistribution(ranks),
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}

export { resolveWhiteLabelCompanyName, competitorRowFromEntity };
