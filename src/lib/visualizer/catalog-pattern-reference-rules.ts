import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";

/** Pioneer Plus etched block panels only — not smooth slab colors (e.g. Travertine). */
export const PIONEER_PLUS_ETCHED_BLOCK_SLUGS = new Set(["tundra-grey", "frost-white"]);

export function catalogMaterialNeedsSurfacePatternReference(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  materialSlug?: string;
}): boolean {
  if (input.panelLine === "PIONEER_PLUS") {
    return Boolean(input.materialSlug && PIONEER_PLUS_ETCHED_BLOCK_SLUGS.has(input.materialSlug));
  }
  if (input.panelLine === "MONTEREY" && input.surfaceStyle === "tile_etch") return true;
  return false;
}

export type SurfacePatternKind = "pioneer_block" | "monterey_tile";

export function surfacePatternKindForMaterial(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  materialSlug?: string;
}): SurfacePatternKind | null {
  if (!catalogMaterialNeedsSurfacePatternReference(input)) return null;
  if (input.panelLine === "PIONEER_PLUS") return "pioneer_block";
  if (input.panelLine === "MONTEREY") return "monterey_tile";
  return null;
}
