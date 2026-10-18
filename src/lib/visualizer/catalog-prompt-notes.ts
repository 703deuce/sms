/**
 * Catalog materials no longer inject appearance text into KIE prompts.
 * Reference photographs (Image 2 / optional Image 3) are the visual authority.
 * Pattern role text lives in prompt-builder.ts when a third image is uploaded.
 */

export type CatalogPromptMaterialMeta = {
  panelLine?: string;
  surfaceStyle?: string;
  description?: string;
  name?: string;
  slug?: string;
};

/** @deprecated Returns empty string — kept so callers can be removed gradually. */
export function buildCatalogMaterialPromptDescription(
  _meta: CatalogPromptMaterialMeta,
  _options?: { hasSurfacePatternReference?: boolean },
): string {
  return "";
}
