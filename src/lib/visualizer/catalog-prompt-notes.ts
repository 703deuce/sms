import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";

export type CatalogPromptMaterialMeta = {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  description?: string;
};

/** Injected into KIE prompts whenever a built-in catalog wall panel is selected. */
const WET_ZONE_COVERAGE =
  "Cover every interior shower and tub-surround wet wall from the pan or deck up to the ceiling with this panel material only. Do not leave wallpaper, wallpaper borders, floral patterns, salmon or pink paint strips, or any prior wall finish visible in the wet zone.";

const PIONEER_PLUS_GEOMETRY =
  "Surface geometry (required): Samuel Mueller Pioneer Plus large stone-block wall panels — each block approximately 24 inches wide by 48 inches tall, with clearly visible recessed grout joints between blocks. The reference image may be a small sample; scale this block-and-grout pattern across the full shower wall height and width. The finish must read as etched stone blocks, not a flat smooth painted wall.";

const MONTEREY_TILE_GEOMETRY =
  "Surface geometry (required): Samuel Mueller Monterey tile-etch wall panels — standard bathroom tile scale approximately 4 inches wide by 8 inches tall (subway-tile proportion), with clearly visible laser-etched grout lines forming a rectangular grid on the panel face. Continue the same tile grid seamlessly on all shower walls at full scale. The finish must read as etched tile paneling, not a flat smooth painted wall.";

const MONTEREY_SMOOTH_GEOMETRY =
  "Surface geometry: Samuel Mueller Monterey smooth wall panels without etched grout lines — continuous color and subtle texture only; no tile grid.";

const LUXURA_GEOMETRY =
  "Surface geometry: Samuel Mueller Luxura engineered-stone wall panels — smooth continuous slab look with natural veining or speckle; no large block grout layout and no small tile grid.";

const BCI_GEOMETRY =
  "Surface geometry: Long Baths BCI marble-look wall panels — continuous slab-style veining typical of acrylic/composite bath panels; not individual ceramic tile on the wall.";

export function buildCatalogMaterialPromptDescription(meta: CatalogPromptMaterialMeta): string {
  const parts: string[] = [];
  if (meta.description?.trim()) parts.push(meta.description.trim());

  switch (meta.panelLine) {
    case "PIONEER_PLUS":
      parts.push(PIONEER_PLUS_GEOMETRY);
      break;
    case "MONTEREY":
      parts.push(meta.surfaceStyle === "tile_etch" ? MONTEREY_TILE_GEOMETRY : MONTEREY_SMOOTH_GEOMETRY);
      break;
    case "LUXURA":
      parts.push(LUXURA_GEOMETRY);
      break;
    case "BCI":
      parts.push(BCI_GEOMETRY);
      break;
    default:
      break;
  }

  parts.push(WET_ZONE_COVERAGE);
  return parts.join(" ");
}
