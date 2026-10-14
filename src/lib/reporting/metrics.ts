import { normalizeRankForCalc } from "@/lib/maps/grid-entity";
import { computeSolv } from "@/lib/maps/grid-metrics";
import type { ReportKpis, WhiteLabelConfig } from "@/lib/reporting/types";

export function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 10000) / 100;
}

export function kpisFromRanks(ranks: Array<number | null>): ReportKpis {
  const totalCells = ranks.length;
  const found = ranks.filter((r): r is number => r != null && r <= 20);
  const foundCells = found.length;
  const arp =
    foundCells > 0
      ? Math.round((found.reduce((a, b) => a + b, 0) / foundCells) * 10) / 10
      : null;
  let atrpSum = 0;
  for (const r of ranks) atrpSum += normalizeRankForCalc(r);
  const atrp = totalCells > 0 ? Math.round((atrpSum / totalCells) * 10) / 10 : null;
  const top3Cells = found.filter((r) => r <= 3).length;
  const top10Cells = found.filter((r) => r <= 10).length;
  const notFoundCells = totalCells - foundCells;
  const solv = computeSolv(top3Cells, totalCells);
  const top3Pct = pct(top3Cells, totalCells);
  const top10Pct = pct(top10Cells, totalCells);
  const notFoundPct = pct(notFoundCells, totalCells);
  const visibilityScore = Math.round(top10Pct);
  const bestRank = foundCells > 0 ? Math.min(...found) : null;
  const worstRank = foundCells > 0 ? Math.max(...found) : null;

  return {
    arp,
    atrp,
    solv,
    top3Pct,
    top10Pct,
    notFoundPct,
    visibilityScore,
    bestRank,
    worstRank,
    totalCells,
    foundCells,
  };
}

export function mapsUrlFromPlaceId(placeId: string | null | undefined): string | null {
  if (!placeId?.trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=place_id:${encodeURIComponent(placeId.trim())}`;
}

export function defaultWhiteLabel(companyName: string): WhiteLabelConfig {
  return {
    companyName: companyName.trim() || "Maps Report",
    logoUrl: null,
    accentColor: "#059669",
    footerText: null,
    hidePlatformBranding: false,
    contactLine: null,
  };
}

export function mergeWhiteLabel(
  companyName: string,
  partial?: Partial<WhiteLabelConfig> | null
): WhiteLabelConfig {
  const base = defaultWhiteLabel(companyName);
  if (!partial) return base;
  return {
    ...base,
    ...partial,
    companyName: partial.companyName?.trim() || base.companyName,
    accentColor: partial.accentColor?.trim() || base.accentColor,
  };
}

export function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  let s = String(value);
  // Neutralize spreadsheet formula injection (=, +, -, @, tab/CR).
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function round1(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}

export function deltaMetric(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
}
