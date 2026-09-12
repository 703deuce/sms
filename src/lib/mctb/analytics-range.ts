import type { MctbAnalyticsRange } from "@/lib/mctb/analytics";
import type { MissedCallsDateFilter } from "@/lib/mctb/missed-calls-list-filters";

export function analyticsRangeLabel(range: MctbAnalyticsRange): string {
  if (range === "7d") return "7 days";
  if (range === "30d") return "30 days";
  return "90 days";
}

export function analyticsRangeShort(range: MctbAnalyticsRange): string {
  if (range === "7d") return "7d";
  if (range === "30d") return "30d";
  return "90d";
}

/** Map analytics window to closest supported Missed Calls list date filter. */
export function missedCallsDateFromAnalyticsRange(range: MctbAnalyticsRange): MissedCallsDateFilter {
  if (range === "7d") return "7d";
  if (range === "30d") return "30d";
  return "all";
}

export function chartAxisLabelIndices(pointCount: number, range: MctbAnalyticsRange): number[] {
  if (pointCount <= 0) return [];
  if (range === "7d") {
    return Array.from({ length: pointCount }, (_, i) => i);
  }
  if (range === "30d") {
    const step = Math.max(1, Math.floor(pointCount / 6));
    const indices: number[] = [];
    for (let i = 0; i < pointCount; i += step) indices.push(i);
    if (indices[indices.length - 1] !== pointCount - 1) indices.push(pointCount - 1);
    return indices;
  }
  const step = Math.max(1, Math.floor(pointCount / 8));
  const indices: number[] = [];
  for (let i = 0; i < pointCount; i += step) indices.push(i);
  if (indices[indices.length - 1] !== pointCount - 1) indices.push(pointCount - 1);
  return indices;
}

export function formatChartAxisDate(iso: string, range: MctbAnalyticsRange): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (range === "7d") {
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
