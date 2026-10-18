import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";
import {
  catalogMaterialNeedsSurfacePatternReference,
  surfacePatternKindForMaterial,
} from "@/lib/visualizer/catalog-pattern-reference-rules";

export { catalogMaterialNeedsSurfacePatternReference, surfacePatternKindForMaterial };

const PATTERN_DIR = path.join(process.cwd(), "public/visualizer/materials/pattern-references");

const PATTERN_FILES: Partial<Record<VisualizerPanelLine, string>> = {
  PIONEER_PLUS: "pioneer-plus-block-geometry.jpg",
};

const MONTEREY_TILE_FILE = "monterey-tile-etch-geometry.jpg";

function patternFileFor(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  materialSlug?: string;
}): string | null {
  if (!catalogMaterialNeedsSurfacePatternReference(input)) return null;
  if (input.panelLine === "PIONEER_PLUS") return PATTERN_FILES.PIONEER_PLUS ?? null;
  if (input.panelLine === "MONTEREY" && input.surfaceStyle === "tile_etch") return MONTEREY_TILE_FILE;
  return null;
}

export async function readCatalogSurfacePatternReference(input: {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  materialSlug?: string;
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
