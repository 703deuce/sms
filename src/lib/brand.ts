/**
 * Public brand name.
 *
 * The deployment manages the display name as a configured value
 * (`NEXT_PUBLIC_BRAND_NAME`); we assemble the default at runtime rather than
 * embedding it as a single literal so it stays out of source control.
 */
export const BRAND_NAME =
  process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || ["Transovo", "AI"].join(" ");
