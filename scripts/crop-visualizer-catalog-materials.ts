/**
 * Crop catalog wall-panel reference photos to the material surface only.
 *
 * Backs up originals to `public/visualizer/materials/<dir>/source/<slug>.jpg`
 * and overwrites the catalog JPG used by KIE generation (`<slug>.jpg`).
 *
 * Usage:
 *   npx tsx scripts/crop-visualizer-catalog-materials.ts --dry-run
 *   npx tsx scripts/crop-visualizer-catalog-materials.ts --apply
 *   npx tsx scripts/crop-visualizer-catalog-materials.ts --apply --only tundra-grey
 */

import { mkdir, readdir, access, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  cropMaterialImageToBuffer,
  detectMaterialCropBox,
} from "../src/lib/visualizer/catalog-material-crop";

const MATERIALS_ROOT = path.join(process.cwd(), "public/visualizer/materials");

/** Product-line folders with per-slug catalog JPGs (not pattern-references). */
const CATALOG_DIRS = [
  "long-baths",
  "sam-mueller-luxura",
  "sam-mueller-monterey",
  "sam-mueller-pioneer-plus",
] as const;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function listCatalogJpgs(): Promise<Array<{ dir: string; slug: string; path: string }>> {
  const out: Array<{ dir: string; slug: string; path: string }> = [];
  for (const dir of CATALOG_DIRS) {
    const fullDir = path.join(MATERIALS_ROOT, dir);
    if (!(await fileExists(fullDir))) continue;
    const names = await readdir(fullDir);
    for (const name of names) {
      if (!name.endsWith(".jpg")) continue;
      const slug = name.replace(/\.jpg$/i, "");
      out.push({ dir, slug, path: path.join(fullDir, name) });
    }
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  const onlySlug = args.includes("--only")
    ? args[args.indexOf("--only") + 1]?.trim()
    : null;

  if (dryRun) {
    console.log("DRY RUN — pass --apply to write cropped JPGs and source backups.\n");
  }

  const files = (await listCatalogJpgs()).filter((f) => !onlySlug || f.slug === onlySlug);

  let ok = 0;
  let skip = 0;

  for (const file of files) {
    const meta = await sharp(file.path).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;
    if (!origW || !origH) {
      console.warn(`SKIP invalid: ${file.path}`);
      skip++;
      continue;
    }

    const box = await detectMaterialCropBox(file.path);
    const removed = 1 - (box.width * box.height) / Math.max(1, origW * origH);

    console.log(
      `${file.dir}/${file.slug}.jpg  ${origW}x${origH} → ${box.width}x${box.height} @ (${box.left},${box.top})  ~${(removed * 100).toFixed(1)}% trimmed`,
    );

    if (dryRun) {
      ok++;
      continue;
    }

    const backup = path.join(MATERIALS_ROOT, file.dir, "source", `${file.slug}.jpg`);
    await mkdir(path.dirname(backup), { recursive: true });
    if (!(await fileExists(backup))) {
      await copyFile(file.path, backup);
    }

    const cropped = await cropMaterialImageToBuffer(file.path, box);
    await writeFile(file.path, cropped);
    ok++;
  }

  console.log(`\nDone: ${ok} processed, ${skip} skipped.`);
  if (dryRun) {
    console.log("Re-run with --apply to backup originals under .../source/ and overwrite catalog JPGs.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
