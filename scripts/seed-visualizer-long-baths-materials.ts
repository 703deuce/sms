/**
 * Upload Long Baths wall-panel fixture photos into permanent Visualizer storage
 * and create/update VisualizerMaterial rows for a workspace.
 *
 * Usage:
 *   WORKSPACE_ID=<id> NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/seed-visualizer-long-baths-materials.ts
 *
 * Requires DATABASE_URL and Supabase credentials (same as app uploads).
 * Does not call KIE.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "../src/lib/db";
import { uploadVisualizerBytes } from "../src/lib/visualizer/storage";

type Manifest = {
  manufacturer: string;
  category: string;
  materials: Array<{ slug: string; name: string; file: string; sku: string }>;
};

const FIXTURE_DIR = path.join(process.cwd(), "fixtures/visualizer/long-baths-wall-panels");

async function main() {
  const workspaceId = process.env.WORKSPACE_ID?.trim();
  if (!workspaceId) {
    console.error("FAIL: set WORKSPACE_ID");
    process.exit(1);
  }

  const manifestRaw = await readFile(path.join(FIXTURE_DIR, "manifest.json"), "utf8");
  const manifest = JSON.parse(manifestRaw) as Manifest;
  const prisma = getPrisma();

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) {
    console.error(`FAIL: workspace not found: ${workspaceId}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;

  for (const row of manifest.materials) {
    const bytes = await readFile(path.join(FIXTURE_DIR, row.file));
    const uploaded = await uploadVisualizerBytes({
      workspaceId,
      bytes,
      mimeType: "image/jpeg",
      filename: row.file,
      folder: "materials",
    });

    const existing = await prisma.visualizerMaterial.findFirst({
      where: { workspaceId, sku: row.sku },
    });

    if (existing) {
      await prisma.visualizerMaterial.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          manufacturer: manifest.manufacturer,
          category: manifest.category,
          imageStoragePath: uploaded.path,
          imageMimeType: "image/jpeg",
          publicVisible: true,
          active: true,
        },
      });
      updated++;
      console.log(`updated  ${row.name} (${row.sku})`);
    } else {
      await prisma.visualizerMaterial.create({
        data: {
          workspaceId,
          name: row.name,
          manufacturer: manifest.manufacturer,
          category: manifest.category,
          sku: row.sku,
          imageStoragePath: uploaded.path,
          imageMimeType: "image/jpeg",
          publicVisible: true,
          active: true,
        },
      });
      created++;
      console.log(`created  ${row.name} (${row.sku})`);
    }
  }

  console.log(`seed-visualizer-long-baths-materials: done (created=${created}, updated=${updated})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
