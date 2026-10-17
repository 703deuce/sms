import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";

const PATTERN_DIR = path.join(process.cwd(), "public/visualizer/materials/pattern-references");

/** Manufacturer geometry references — color comes from the catalog swatch (image 2). */
const PATTERN_FILES: Partial<Record<VisualizerPanelLine, string>> = {
  PIONEER_PLUS: "pioneer-plus-block-geometry.jpg",
};

const MONTEREY_TILE_FILE = "monterey-tile-etch-geometry.jpg";

export function catalogMaterialNeedsSurfacePatternReference(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
}): boolean {
  if (input.panelLine === "PIONEER_PLUS") return true;
  if (input.panelLine === "MONTEREY" && input.surfaceStyle === "tile_etch") return true;
  return false;
}

function patternFileFor(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
}): string | null {
  if (input.panelLine === "PIONEER_PLUS") return PATTERN_FILES.PIONEER_PLUS ?? null;
  if (input.panelLine === "MONTEREY" && input.surfaceStyle === "tile_etch") return MONTEREY_TILE_FILE;
  return null;
}

export async function readCatalogSurfacePatternReference(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
}): Promise<{ bytes: Buffer; mimeType: string; label: string } | null> {
  const file = patternFileFor(input);
  if (!file) return null;
  const filePath = path.join(PATTERN_DIR, file);
  const bytes = await readFile(filePath);
  const label =
    input.panelLine === "PIONEER_PLUS"
      ? "pioneer-plus-block-geometry"
      : "monterey-tile-geometry";
  return { bytes, mimeType: "image/jpeg", label };
}
