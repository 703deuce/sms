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

export const TRANSFORMATION_LABELS: Record<string, string> = {
  TUB_TO_SHOWER: "Tub-to-Shower",
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
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
  "SHOWER_AND_TUB_DECK_WRAP",
] as const;

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
