import { createServiceClient } from "@/lib/db/client";
import type { BusinessRow } from "@/lib/db/types";
import { rankHex, rankTextColor } from "@/lib/maps/colors";
import {
  buildEntityGridCells,
  buildYouEntity,
} from "@/lib/maps/grid-entity";
import { loadScanGridData } from "@/lib/maps/scan-queries";
import { deltaMetric, kpisFromRanks } from "@/lib/reporting/metrics";
import type {
  HeatmapCell,
  ReportComparisonSection,
} from "@/lib/reporting/types";

async function heatmapForScan(
  supabase: ReturnType<typeof createServiceClient>,
  scanId: string,
  keywordId: string | null | undefined,
  business: BusinessRow
): Promise<{
  gridSize: number;
  cells: HeatmapCell[];
  arp: number | null;
  atrp: number | null;
  solv: number | null;
  keyword: string | null;
  scannedAt: string | null;
} | null> {
  const gridData = await loadScanGridData(supabase, scanId, keywordId ?? undefined);
  if (!gridData) return null;
  const you = buildYouEntity((gridData.business ?? business) as BusinessRow);
  const cellsRaw = buildEntityGridCells(gridData.points, gridData.results, you);
  const ranks = cellsRaw.map((c) => (c.pending ? null : c.notInResults ? null : c.rank));
  const kpis = kpisFromRanks(ranks);
  const cells: HeatmapCell[] = [...cellsRaw]
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
  return {
    gridSize: gridData.batch.grid_size,
    cells,
    arp: kpis.arp,
    atrp: kpis.atrp,
    solv: kpis.solv,
    keyword: gridData.activeKeyword?.keyword ?? null,
    scannedAt: gridData.batch.finished_at ?? gridData.batch.created_at,
  };
}

/**
 * Build a before/after comparison section from two scan batch IDs.
 */
export async function buildComparisonSection(params: {
  businessId: string;
  baselineScanId: string;
  currentScanId: string;
  mode?: "baseline" | "prior_period";
  baselineLabel?: string;
  currentLabel?: string;
  keywordId?: string | null;
}): Promise<ReportComparisonSection | null> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", params.businessId)
    .maybeSingle();
  if (!business) return null;

  const [baseline, current] = await Promise.all([
    heatmapForScan(
      supabase,
      params.baselineScanId,
      params.keywordId,
      business as BusinessRow
    ),
    heatmapForScan(
      supabase,
      params.currentScanId,
      params.keywordId,
      business as BusinessRow
    ),
  ]);

  if (!baseline && !current) return null;

  const keyword = current?.keyword ?? baseline?.keyword ?? null;
  const mode = params.mode ?? "prior_period";

  return {
    mode,
    baselineLabel:
      params.baselineLabel ??
      (mode === "baseline" ? "Baseline" : "Prior period") +
        (baseline?.scannedAt
          ? ` · ${new Date(baseline.scannedAt).toLocaleDateString()}`
          : ""),
    currentLabel:
      params.currentLabel ??
      ("Current" +
        (current?.scannedAt
          ? ` · ${new Date(current.scannedAt).toLocaleDateString()}`
          : "")),
    baselineScanId: params.baselineScanId,
    currentScanId: params.currentScanId,
    keyword,
    baselineHeatmap: baseline
      ? { gridSize: baseline.gridSize, cells: baseline.cells }
      : null,
    currentHeatmap: current
      ? { gridSize: current.gridSize, cells: current.cells }
      : null,
    kpiDelta: {
      arp: deltaMetric(baseline?.arp ?? null, current?.arp ?? null),
      atrp: deltaMetric(baseline?.atrp ?? null, current?.atrp ?? null),
      solv: deltaMetric(current?.solv ?? null, baseline?.solv ?? null),
    },
  };
}
