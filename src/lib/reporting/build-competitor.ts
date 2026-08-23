import { buildSingleScanReport } from "@/lib/reporting/build-single-scan";
import { mergeWhiteLabel } from "@/lib/reporting/metrics";
import type {
  CompetitorReportPayload,
  ReportCompetitorRow,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

function atrpSortValue(row: ReportCompetitorRow): number {
  return row.atrp ?? Number.POSITIVE_INFINITY;
}

export async function buildCompetitorReport(params: {
  businessId: string;
  scanBatchId: string;
  selectedCompetitorKeys?: string[];
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<CompetitorReportPayload> {
  const single = await buildSingleScanReport({
    businessId: params.businessId,
    scanBatchId: params.scanBatchId,
    whiteLabel: params.whiteLabel,
  });

  const target =
    single.competitors.find((c) => c.isTarget) ??
    single.competitors[0] ??
    ({
      key: "you",
      name: single.business.name,
      arp: single.kpis.arp,
      atrp: single.kpis.atrp,
      solv: single.kpis.solv,
      top3Appearances: 0,
      totalCells: single.kpis.totalCells,
      appearancePct: 0,
      isTarget: true,
    } satisfies ReportCompetitorRow);

  const others = single.competitors
    .filter((c) => !c.isTarget && c.key !== target.key)
    .sort((a, b) => atrpSortValue(a) - atrpSortValue(b));

  // Target first, then competitors by ATRP ascending.
  const finalRows = [target, ...others];

  const selectedCompetitorKeys =
    params.selectedCompetitorKeys && params.selectedCompetitorKeys.length > 0
      ? params.selectedCompetitorKeys
      : others.slice(0, 5).map((c) => c.key);

  return {
    reportType: "competitor",
    business: { id: single.business.id, name: single.business.name },
    parameters: {
      keyword: single.parameters.keyword,
      scannedAt: single.parameters.scannedAt,
      gridSize: single.parameters.gridSize,
      radiusMeters: single.parameters.radiusMeters,
      scanId: single.parameters.scanId,
    },
    target,
    competitors: finalRows,
    selectedCompetitorKeys,
    whiteLabel: mergeWhiteLabel(single.whiteLabel.companyName, {
      ...single.whiteLabel,
      ...params.whiteLabel,
    }),
    generatedAt: new Date().toISOString(),
  };
}
