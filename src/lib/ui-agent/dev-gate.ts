/** Development-only UI Studio / reference library routes. */
export function isUiStudioEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_UI_STUDIO === "1";
}
