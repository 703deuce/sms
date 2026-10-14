/** Scan statuses where the rank grid map can render from saved cell results. */
export const MAP_RENDERABLE_STATUSES = new Set([
  "rank_ready",
  "enriching",
  "scoring",
  "ai_planning",
  "ready",
  "partial",
]);

/**
 * Terminal (or near-terminal) scans usable as competitor/metrics sources.
 * Review Velocity no longer auto-selects grid scans; kept for API compatibility.
 */
export const USABLE_SCAN_STATUSES = ["ready", "partial", "rank_ready"] as const;

export type UsableScanStatus = (typeof USABLE_SCAN_STATUSES)[number];
