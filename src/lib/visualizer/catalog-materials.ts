import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VisualizerPanelLine } from "@/lib/visualizer/constants";

/** Stable id prefix for built-in wall panels (not stored per workspace in Supabase). */
export const VISUALIZER_CATALOG_MATERIAL_PREFIX = "catalog:";

export type CatalogMaterial = {
  slug: string;
  name: string;
  sku: string;
  /** Prisma / API material category (wall panel vs base, etc.). */
  category: string;
  manufacturer: string;
  /** Product line within wall panels (e.g. BCI). */
  panelLine: VisualizerPanelLine;
  description?: string;
};

/** Long Baths wall panels — served from /public/visualizer/materials/long-baths/ */
export const LONG_BATHS_WALL_PANEL_CATALOG: CatalogMaterial[] = [
  { slug: "glacier-ice", name: "Glacier Ice", sku: "LB-GLACIER-ICE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "santorini-white-marble", name: "Santorini White Marble", sku: "LB-SANTORINI", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "metapeake", name: "Metapeake", sku: "LB-METAPEAKE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "arctic-ice", name: "Arctic Ice", sku: "LB-ARCTIC-ICE", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "evo", name: "Evo", sku: "LB-EVO", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "linen", name: "Linen", sku: "LB-LINEN", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "napoli-marble", name: "Napoli Marble", sku: "LB-NAPOLI", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "carbon-ash", name: "Carbon Ash", sku: "LB-CARBON-ASH", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "tuscany", name: "Tuscany", sku: "LB-TUSCANY", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "sierra-sand", name: "Sierra Sand", sku: "LB-SIERRA-SAND", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "canyon-rock", name: "Canyon Rock", sku: "LB-CANYON-ROCK", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
  { slug: "sandbar", name: "Sandbar", sku: "LB-SANDBAR", category: "WALL_PANEL", manufacturer: "Long Baths", panelLine: "BCI" },
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
  return LONG_BATHS_WALL_PANEL_CATALOG.find((m) => m.slug === slug);
}

export function getCatalogMaterialById(materialId: string): CatalogMaterial | undefined {
  const slug = parseCatalogMaterialSlug(materialId);
  return slug ? getCatalogMaterialBySlug(slug) : undefined;
}

export function catalogMaterialPublicUrl(slug: string): string {
  return `/visualizer/materials/long-baths/${slug}.jpg`;
}

export function listCatalogMaterialsForApi(category?: string, panelLine?: VisualizerPanelLine) {
  return LONG_BATHS_WALL_PANEL_CATALOG
    .filter((m) => (!category || m.category === category) && (!panelLine || m.panelLine === panelLine))
    .map((m) => ({
      id: catalogMaterialId(m.slug),
      name: m.name,
      category: m.category,
      panelLine: m.panelLine,
      manufacturer: m.manufacturer,
      sku: m.sku,
      finish: null as string | null,
      active: true,
      publicVisible: true,
      source: "catalog" as const,
      imageUrl: catalogMaterialPublicUrl(m.slug),
      updatedAt: null as string | null,
    }));
}

export async function readCatalogMaterialBytes(slug: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const entry = getCatalogMaterialBySlug(slug);
  if (!entry) throw new Error(`Unknown catalog material: ${slug}`);
  const filePath = path.join(process.cwd(), "public/visualizer/materials/long-baths", `${slug}.jpg`);
  const bytes = await readFile(filePath);
  return { bytes, mimeType: "image/jpeg" };
}
