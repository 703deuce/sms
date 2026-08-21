/**
 * Platform-owned pre-approved messaging number for onboarding demos.
 * Same for every user — NOT their assigned trial toll-free number.
 * Per-user workspaces are matched by verified caller phone during the demo.
 */
export const MCTB_PLATFORM_DEMO_E164 = "+18663464256";

/** Human-readable display for onboarding UI. */
export const MCTB_PLATFORM_DEMO_DISPLAY = "1-866-346-4256";

/** Label shown in onboarding — not "demo TFN", it's the approved Transovo demo line. */
export const MCTB_PLATFORM_DEMO_LABEL = "Approved Transovo Demo Number";

/** Toll-free area codes used when auto-provisioning trial numbers. */
export const MCTB_TRIAL_TOLL_FREE_AREA_CODES = [
  "888",
  "877",
  "866",
  "855",
  "844",
  "833",
  "800",
] as const;
