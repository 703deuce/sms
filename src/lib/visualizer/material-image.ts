import "server-only";

import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import {
  getCatalogMaterialById,
  isCatalogMaterialId,
  parseCatalogMaterialSlug,
  readCatalogMaterialBytes,
} from "@/lib/visualizer/catalog-materials";
import { downloadVisualizerObject } from "@/lib/visualizer/storage";

/** Workspace-uploaded material row (Supabase path). */
export type WorkspaceMaterialRow = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  finish?: string | null;
  imageStoragePath: string;
  imageMimeType: string;
};

export async function loadMaterialReferenceImage(input: {
  materialId: string;
  workspaceMaterials: WorkspaceMaterialRow[];
}): Promise<{ bytes: Buffer; mime: string; label: string; name: string; category: string; description?: string | null; finish?: string | null }> {
  if (isCatalogMaterialId(input.materialId)) {
    const slug = parseCatalogMaterialSlug(input.materialId);
    if (!slug) throw new Error("Invalid catalog material id");
    const meta = getCatalogMaterialById(input.materialId);
    const { bytes, mimeType } = await readCatalogMaterialBytes(slug);
    return {
      bytes,
      mime: mimeType,
      label: meta?.sku || slug,
      name: meta?.name || slug,
      category: meta?.category || "WALL_PANEL",
      description: null,
      finish: null,
    };
  }

  const row = input.workspaceMaterials.find((m) => m.id === input.materialId);
  if (!row) throw new Error(`Material not found: ${input.materialId}`);
  const bytes = await downloadVisualizerObject(VISUALIZER_BUCKET, row.imageStoragePath);
  return {
    bytes,
    mime: row.imageMimeType,
    label: row.name,
    name: row.name,
    category: row.category,
    description: row.description,
    finish: row.finish,
  };
}
