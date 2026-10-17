export const VISUALIZER_BUCKET =
  process.env.SUPABASE_VISUALIZER_BUCKET?.trim() || "visualizer-media";

export const VISUALIZER_MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export const VISUALIZER_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const VISUALIZER_DEFAULT_MONTHLY_CREDITS = 100;

/** Wall-panel product lines (catalog grouping). More lines added per manufacturer rollout. */
export type VisualizerPanelLine = "BCI" | "PIONEER_PLUS";

export const VISUALIZER_PANEL_LINE_LABELS: Record<VisualizerPanelLine, string> = {
  BCI: "BCI",
  PIONEER_PLUS: "Sam Mueller · Pioneer Plus",
};

/** Display order in material pickers. */
export const VISUALIZER_PANEL_LINE_ORDER: VisualizerPanelLine[] = ["BCI", "PIONEER_PLUS"];

export const TRANSFORMATION_LABELS: Record<string, string> = {
  TUB_TO_SHOWER: "Tub-to-Shower",
  SHOWER_TO_SHOWER: "Shower-to-Shower",
  TUB_TO_TUB: "Tub-to-Tub",
  SHOWER_TO_TUB: "Shower-to-Tub",
  SHOWER_AND_TUB_DECK_WRAP: "Shower + tub deck wrap",
  SHOWER_REPLACEMENT: "Shower Replacement",
  WALL_PANEL_UPGRADE: "Wall Panel Upgrade",
  BATHROOM_REFRESH: "Bathroom Refresh",
  CUSTOM: "Custom",
};

/** Launch remodel types shown in the wizard (backend prompt templates are 1:1). */
export const VISUALIZER_LAUNCH_TRANSFORMATIONS = [
  "TUB_TO_SHOWER",
  "SHOWER_TO_SHOWER",
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
  "SHOWER_AND_TUB_DECK_WRAP",
] as const;

/** How high shower / tub-surround wall panels run in the wet area. */
export type VisualizerShowerWallHeight = "FULL_CEILING" | "EIGHT_FT";

export const VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT: VisualizerShowerWallHeight = "FULL_CEILING";

export const SHOWER_WALL_HEIGHT_LABELS: Record<VisualizerShowerWallHeight, string> = {
  FULL_CEILING: "Panels to the ceiling",
  EIGHT_FT: "Panels up to 8 ft (top wall painted above)",
};

/** Remodel types where shower/tub-surround panel height applies. */
export function transformationSupportsShowerWallHeight(transformation: string): boolean {
  return (VISUALIZER_LAUNCH_TRANSFORMATIONS as readonly string[]).includes(transformation);
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  DESIGN_READY: "Design ready",
  SHARED: "Shared",
  INTERESTED: "Interested",
  ESTIMATE_REQUESTED: "Estimate requested",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  WON: "Won",
  LOST: "Lost",
  ARCHIVED: "Archived",
};
