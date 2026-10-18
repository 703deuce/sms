import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { detectMaterialCropBox } from "../src/lib/visualizer/catalog-material-crop";

async function main() {
  const dir = path.join(process.cwd(), "public/visualizer/materials/sam-mueller-pioneer-plus");
  const source = path.join(dir, "source/tundra-grey.jpg");
  let tundra = path.join(dir, "tundra-grey.jpg");
  try {
    await access(source);
    tundra = source;
  } catch {
    /* use active catalog file */
  }

  const box = await detectMaterialCropBox(tundra);
  assert.ok(box.width > 200 && box.height > 200, "crop has reasonable size");
  assert.ok(box.left >= 0 && box.top >= 0, "crop origin non-negative");

  const meta = await sharp(tundra).metadata();
  const origArea = (meta.width ?? 1) * (meta.height ?? 1);
  const cropArea = box.width * box.height;
  assert.ok(cropArea < origArea * 0.91, "expected meaningful border removed for tundra-grey");

  console.log("test-visualizer-catalog-material-crop: PASS", box);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
