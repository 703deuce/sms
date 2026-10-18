import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";

export type CatalogPromptMaterialMeta = {
  panelLine: VisualizerPanelLine;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
  description?: string;
  name?: string;
  slug?: string;
};

/** Per-SKU color anchors — reduces room relighting darkening the installed panels. */
const CATALOG_COLOR_APPEARANCE_HINTS: Record<string, string> = {
  travertine:
    "Appearance anchor: warm light beige-gray travertine wall panel, soft cloudy stone variation, matte satin finish, medium-light overall value. Keep panels this light and warm — do not render charcoal, muddy brown, or significantly darker than the product swatch.",
  "tundra-grey":
    "Appearance anchor: cool medium blue-gray Pioneer Plus panel with soft white veining, matte finish, mid-tone value (not near-black). Match swatch brightness — do not dramatize to dark charcoal or black-gray.",
  "frost-white":
    "Appearance anchor: bright warm white panel with subtle stone movement, matte finish, high lightness. Do not gray-down or yellow-darken versus the swatch.",
  "awaken-gold":
    "Appearance anchor: warm golden-tan stone panel, medium-light value, soft veining. Do not cool to gray or darken below the swatch.",
  "sparkling-quartz":
    "Appearance anchor: light neutral quartz speckle, bright overall value, matte finish — preserve swatch lightness.",
  "warm-crystal":
    "Appearance anchor: warm light crystal tone with gentle sparkle, medium-light value — do not oversaturate or darken.",
};

const CATALOG_COLOR_FIDELITY =
  "Strict color fidelity: the product swatch (second reference image) is the literal color authority. Match hue, brightness, saturation, and undertone from that swatch. Do not relight, darken, lighten, cool, or warm the panel color to harmonize with bathroom shadows. Ignore concrete, outdoor shade, or background cast in the swatch photo — use only the panel face color. Prioritize accurate product color over dramatic room mood.";

/** Injected into KIE prompts whenever a built-in catalog wall panel is selected. */
const WET_ZONE_COVERAGE =
  "Cover every interior shower and tub-surround wet wall from the pan or deck up to the ceiling with this panel material only. Do not leave wallpaper, wallpaper borders, floral patterns, salmon or pink paint strips, or any prior wall finish visible in the wet zone.";

const PIONEER_PLUS_GEOMETRY =
  "Surface geometry (required): Samuel Mueller Pioneer Plus large stone-block wall panels — each block approximately 24 inches wide by 8 inches tall in a staggered running-bond layout, with clearly visible recessed grout joints between blocks. Scale this block-and-grout pattern across the full shower wall height and width. The finish must read as etched stone blocks, not a flat smooth painted wall.";

const MONTEREY_TILE_GEOMETRY =
  "Surface geometry (required): Samuel Mueller Monterey tile-etch wall panels — standard bathroom subway tile scale with laser-etched grout lines in a running-bond (offset brick) layout. Continue the same etched tile grid seamlessly on all shower walls at full scale. The finish must read as etched tile paneling, not a flat smooth painted wall.";

const GEOMETRY_FROM_THIRD_REFERENCE =
  "The third reference image shows the required etched grout / block layout only — copy its tile or block scale and pattern, but apply color and veining from the second reference image (the product swatch), not from the third image.";

const MONTEREY_SMOOTH_GEOMETRY =
  "Surface geometry: Samuel Mueller Monterey smooth wall panels without etched grout lines — continuous color and subtle texture only; no tile grid.";

const LUXURA_GEOMETRY =
  "Surface geometry: Samuel Mueller Luxura engineered-stone wall panels — smooth continuous slab look with natural veining or speckle; no large block grout layout and no small tile grid.";

const BCI_GEOMETRY =
  "Surface geometry: Long Baths BCI marble-look wall panels — continuous slab-style veining typical of acrylic/composite bath panels; not individual ceramic tile on the wall.";

export function buildCatalogMaterialPromptDescription(
  meta: CatalogPromptMaterialMeta,
  options?: { hasSurfacePatternReference?: boolean },
): string {
  const parts: string[] = [];
  if (meta.description?.trim()) parts.push(meta.description.trim());

  if (options?.hasSurfacePatternReference) {
    parts.push(GEOMETRY_FROM_THIRD_REFERENCE);
  }

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

  parts.push(CATALOG_COLOR_FIDELITY);

  const colorKey = meta.slug?.trim().toLowerCase();
  if (colorKey && CATALOG_COLOR_APPEARANCE_HINTS[colorKey]) {
    parts.push(CATALOG_COLOR_APPEARANCE_HINTS[colorKey]);
  }

  parts.push(WET_ZONE_COVERAGE);
  return parts.join(" ");
}
