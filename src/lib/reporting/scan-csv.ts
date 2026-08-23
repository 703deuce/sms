import { escapeCsv } from "@/lib/reporting/metrics";
import type { SingleScanReportPayload } from "@/lib/reporting/types";

function row(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsv).join(",");
}

/** Compact scan summary CSV (KPIs + distribution + competitor rollup). */
export function singleScanSummaryCsv(payload: SingleScanReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["report_type", payload.reportType]));
  lines.push(row(["business", payload.business.name]));
  lines.push(row(["address", payload.business.address]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push(row(["scanned_at", payload.parameters.scannedAt]));
  lines.push(row(["scan_id", payload.parameters.scanId]));
  lines.push(row(["grid_size", payload.parameters.gridSize]));
  lines.push(row(["radius_meters", payload.parameters.radiusMeters]));
  lines.push("");
  lines.push(row(["kpi", "value"]));
  lines.push(row(["arp", payload.kpis.arp]));
  lines.push(row(["atrp", payload.kpis.atrp]));
  lines.push(row(["solv", payload.kpis.solv]));
  lines.push(row(["top3_pct", payload.kpis.top3Pct]));
  lines.push(row(["top10_pct", payload.kpis.top10Pct]));
  lines.push(row(["not_found_pct", payload.kpis.notFoundPct]));
  lines.push(row(["visibility_score", payload.kpis.visibilityScore]));
  lines.push(row(["best_rank", payload.kpis.bestRank]));
  lines.push(row(["worst_rank", payload.kpis.worstRank]));
  lines.push(row(["found_cells", payload.kpis.foundCells]));
  lines.push(row(["total_cells", payload.kpis.totalCells]));
  lines.push("");
  lines.push(row(["bucket", "count"]));
  for (const d of payload.rankDistribution) {
    lines.push(row([d.label, d.count]));
  }
  lines.push("");
  lines.push(
    row([
      "competitor",
      "is_target",
      "arp",
      "atrp",
      "solv",
      "appearance_pct",
      "top3_appearances",
      "rating",
      "reviews",
      "category",
    ])
  );
  for (const c of payload.competitors) {
    lines.push(
      row([
        c.name,
        c.isTarget ? "yes" : "no",
        c.arp,
        c.atrp,
        c.solv,
        c.appearancePct,
        c.top3Appearances,
        c.rating ?? null,
        c.reviewCount ?? null,
        c.category ?? null,
      ])
    );
  }
  return lines.join("\n");
}

/** Per-cell data points CSV. */
export function singleScanPointsCsv(payload: SingleScanReportPayload): string {
  const lines: string[] = [];
  lines.push(row(["scan_id", payload.parameters.scanId]));
  lines.push(row(["keyword", payload.parameters.keyword]));
  lines.push("");
  lines.push(row(["label", "row", "col", "rank", "color"]));
  for (const cell of payload.heatmap.cells) {
    lines.push(row([cell.label, cell.row, cell.col, cell.rank, cell.color]));
  }
  return lines.join("\n");
}
