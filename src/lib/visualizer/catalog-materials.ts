import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VisualizerMontereySurfaceStyle, VisualizerPanelLine } from "@/lib/visualizer/constants";

/** Stable id prefix for built-in wall panels (not stored per workspace in Supabase). */
export const VISUALIZER_CATALOG_MATERIAL_PREFIX = "catalog:";

const PIONEER_PLUS_STONE_BLOCK_NOTES =
  "Samuel Mueller Pioneer Plus large stone-block wall panels with realistic grout joints; extend the block pattern at full wall scale (reference may be a small sample cutout).";

const LUXURA_SLAB_NOTES =
  "Samuel Mueller Luxura engineered stone wall panels; smooth continuous slab look with natural veining or speckle — not large block grout layout.";

const MONTEREY_TILE_NOTES =
  "Samuel Mueller Monterey wall panels with etched standard-size tile grout lines; continue the tile pattern across all shower walls at full scale.";

const MONTEREY_SMOOTH_NOTES =
  "Samuel Mueller Monterey smooth wall panels without etched grout lines; continuous color and texture across shower walls.";

export type CatalogMaterial = {
  slug: string;
  name: string;
  sku: string;
  /** Prisma / API material category (wall panel vs base, etc.). */
  category: string;
  manufacturer: string;
  /** Product line within wall panels (e.g. BCI). */
  panelLine: VisualizerPanelLine;
  /** Folder under public/visualizer/materials/ */
  publicDir: string;
  description?: string;
  /** Monterey: groups smooth + tile variants of the same color. */
  colorGroupKey?: string;
  surfaceStyle?: VisualizerMontereySurfaceStyle;
};

function montereyColor(
  colorGroupKey: string,
  colorName: string,
  skuBase: string,
  surfaceStyle: VisualizerMontereySurfaceStyle,
  slugSuffix: string,
): CatalogMaterial {
  const tile = surfaceStyle === "tile_etch";
  return {
    slug: `${colorGroupKey}-${slugSuffix}`,
    name: colorName,
    sku: tile ? `${skuBase}-T` : `${skuBase}-S`,
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "MONTEREY",
    publicDir: "sam-mueller-monterey",
    colorGroupKey,
    surfaceStyle,
    description: tile ? MONTEREY_TILE_NOTES : MONTEREY_SMOOTH_NOTES,
  };
}

const SAM_MUELLER_MONTEREY: CatalogMaterial[] = [
  montereyColor("grey-stone-27", "Grey Stone", "SM-MY-27", "tile_etch", "tile"),
  montereyColor("grey-stone-27", "Grey Stone", "SM-MY-27", "smooth", "smooth"),
  montereyColor("white-21v", "White", "SM-MY-21V", "tile_etch", "tile"),
  montereyColor("white-21v", "White", "SM-MY-21V", "smooth", "smooth"),
  montereyColor("butternut-28", "Butternut", "SM-MY-28", "tile_etch", "tile"),
  montereyColor("butternut-28", "Butternut", "SM-MY-28", "smooth", "smooth"),
  montereyColor("moonstone-50v", "Moonstone", "SM-MY-50V", "tile_etch", "tile"),
  montereyColor("moonstone-50v", "Moonstone", "SM-MY-50V", "smooth", "smooth"),
  montereyColor("butterscotch-48", "Butterscotch", "SM-MY-48", "tile_etch", "tile"),
  montereyColor("butterscotch-48", "Butterscotch", "SM-MY-48", "smooth", "smooth"),
];

const LONG_BATHS_BCI: CatalogMaterial[] = [
  { slug: "glacier-ice", name: "Glacier Ice", sku: "LB-GLACIER-ICE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "santorini-white-marble", name: "Santorini White Marble", sku: "LB-SANTORINI", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "metapeake", name: "Metapeake", sku: "LB-METAPEAKE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "arctic-ice", name: "Arctic Ice", sku: "LB-ARCTIC-ICE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "evo", name: "Evo", sku: "LB-EVO", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "linen", name: "Linen", sku: "LB-LINEN", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "napoli-marble", name: "Napoli Marble", sku: "LB-NAPOLI", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "carbon-ash", name: "Carbon Ash", sku: "LB-CARBON-ASH", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "tuscany", name: "Tuscany", sku: "LB-TUSCANY", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "sierra-sand", name: "Sierra Sand", sku: "LB-SIERRA-SAND", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "canyon-rock", name: "Canyon Rock", sku: "LB-CANYON-ROCK", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
  { slug: "sandbar", name: "Sandbar", sku: "LB-SANDBAR", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI", publicDir: "long-baths" },
];

const SAM_MUELLER_PIONEER_PLUS: CatalogMaterial[] = [
  {
    slug: "frost-white",
    name: "Frost White",
    sku: "SM-PP-57",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "PIONEER_PLUS",
    publicDir: "sam-mueller-pioneer-plus",
    description: PIONEER_PLUS_STONE_BLOCK_NOTES,
  },
  {
    slug: "travertine",
    name: "Travertine",
    sku: "SM-PP-58",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "PIONEER_PLUS",
    publicDir: "sam-mueller-pioneer-plus",
    description: PIONEER_PLUS_STONE_BLOCK_NOTES,
  },
  {
    slug: "tundra-grey",
    name: "Tundra Grey",
    sku: "SM-PP-59",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "PIONEER_PLUS",
    publicDir: "sam-mueller-pioneer-plus",
    description: PIONEER_PLUS_STONE_BLOCK_NOTES,
  },
  {
    slug: "awaken-gold",
    name: "Awaken Gold",
    sku: "SM-PP-63",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "PIONEER_PLUS",
    publicDir: "sam-mueller-pioneer-plus",
    description: PIONEER_PLUS_STONE_BLOCK_NOTES,
  },
];

/** Placeholder display names until official Luxura color names are confirmed. */
const SAM_MUELLER_LUXURA: CatalogMaterial[] = [
  {
    slug: "sparkling-quartz",
    name: "Sparkling Quartz",
    sku: "SM-LX-01",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "LUXURA",
    publicDir: "sam-mueller-luxura",
    description: LUXURA_SLAB_NOTES,
  },
  {
    slug: "warm-crystal",
    name: "Warm Crystal",
    sku: "SM-LX-02",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "LUXURA",
    publicDir: "sam-mueller-luxura",
    description: LUXURA_SLAB_NOTES,
  },
  {
    slug: "ribbon-onyx",
    name: "Ribbon Onyx",
    sku: "SM-LX-03",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "LUXURA",
    publicDir: "sam-mueller-luxura",
    description: LUXURA_SLAB_NOTES,
  },
  {
    slug: "veined-marble",
    name: "Veined Marble",
    sku: "SM-LX-04",
    category: "WALL_PANEL",
    manufacturer: "Samuel Mueller",
    panelLine: "LUXURA",
    publicDir: "sam-mueller-luxura",
    description: LUXURA_SLAB_NOTES,
  },
];

/** Long Baths wall panels — served from /public/visualizer/materials/long-baths/ */
export const LONG_BATHS_WALL_PANEL_CATALOG: CatalogMaterial[] = LONG_BATHS_BCI;

export const VISUALIZER_WALL_PANEL_CATALOG: CatalogMaterial[] = [
  ...LONG_BATHS_BCI,
  ...SAM_MUELLER_PIONEER_PLUS,
  ...SAM_MUELLER_LUXURA,
  ...SAM_MUELLER_MONTEREY,
];

export function isCatalogMaterialId(materialId: string | undefined | null): boolean {
  return Boolean(materialId?.startsWith(VISUALIZER_CATALOG_MATERIAL_PREFIX));
}

export function catalogMaterialId(slug: string): string {
  return `${VISUALIZER_CATALOG_MATERIAL_PREFIX}${slug}`;
}

export function parseCatalogMaterialSlug(materialId: string): string | null {
  if (!isCatalogMaterialId(materialId)) return null;
  return materialId.slice(VISUALIZER_CATALOG_MATERIAL_PREFIX.length);
}

export function getCatalogMaterialBySlug(slug: string): CatalogMaterial | undefined {
  return VISUALIZER_WALL_PANEL_CATALOG.find((m) => m.slug === slug);
}

export function getCatalogMaterialById(materialId: string): CatalogMaterial | undefined {
  const slug = parseCatalogMaterialSlug(materialId);
  return slug ? getCatalogMaterialBySlug(slug) : undefined;
}

export function catalogMaterialPublicUrl(entry: CatalogMaterial): string {
  return `/visualizer/materials/${entry.publicDir}/${entry.slug}.jpg`;
}

export function listCatalogMaterialsForApi(category?: string, panelLine?: VisualizerPanelLine) {
  return VISUALIZER_WALL_PANEL_CATALOG
    .filter((m) => (!category || m.category === category) && (!panelLine || m.panelLine === panelLine))
    .map((m) => ({
      id: catalogMaterialId(m.slug),
      name: m.name,
      category: m.category,
      panelLine: m.panelLine,
      manufacturer: m.manufacturer,
      sku: m.sku,
      colorGroupKey: m.colorGroupKey ?? null,
      surfaceStyle: m.surfaceStyle ?? null,
      finish: null as string | null,
      active: true,
      publicVisible: true,
      source: "catalog" as const,
      imageUrl: catalogMaterialPublicUrl(m),
      updatedAt: null as string | null,
    }));
}

export async function readCatalogMaterialBytes(slug: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const entry = getCatalogMaterialBySlug(slug);
  if (!entry) throw new Error(`Unknown catalog material: ${slug}`);
  const filePath = path.join(process.cwd(), "public/visualizer/materials", entry.publicDir, `${entry.slug}.jpg`);
  const bytes = await readFile(filePath);
  return { bytes, mimeType: "image/jpeg" };
}
