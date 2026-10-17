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
  SHOWER_REPLACEMENT: "Shower Replacement",
  WALL_PANEL_UPGRADE: "Wall Panel Upgrade",
  BATHROOM_REFRESH: "Bathroom Refresh",
  CUSTOM: "Custom",
};

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
