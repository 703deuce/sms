import sharp from "sharp";

export type CropBox = { left: number; top: number; width: number; height: number };

const ANALYSIS_WIDTH = 720;
/** Concrete / backdrop usually appears on the right and bottom of outdoor slab photos. */
const SIDE_STRIP_FRAC = 0.08;
const COLOR_DISTANCE_THRESHOLD = 26;
const INSET_FRAC = 0.015;
const MIN_MATERIAL_FRAC = 0.35;
const MIN_OUTPUT_EDGE = 256;

function rgbDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function medianChannel(samples: number[][], ch: number): number {
  const sorted = samples.map((s) => s[ch]).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Bounding box for the wall-panel sample vs outdoor concrete / backdrop.
 * Uses border pixel color as background reference (concrete edges).
 */
export async function detectMaterialCropBox(imagePath: string): Promise<CropBox> {
  const meta = await sharp(imagePath).metadata();
  const origW = meta.width ?? 0;
  const origH = meta.height ?? 0;
  if (!origW || !origH) throw new Error(`Invalid image dimensions: ${imagePath}`);

  const scale = ANALYSIS_WIDTH / origW;
  const analysisH = Math.max(1, Math.round(origH * scale));

  const { data, info } = await sharp(imagePath)
    .resize(ANALYSIS_WIDTH, analysisH, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const rightStrip = Math.max(2, Math.floor(width * SIDE_STRIP_FRAC));
  const bottomStrip = Math.max(2, Math.floor(height * SIDE_STRIP_FRAC));
  const backdropSamples: number[][] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const rgb = [data[i], data[i + 1], data[i + 2]];
      const onRight = x >= width - rightStrip;
      const onBottom = y >= height - bottomStrip;
      if (onRight || onBottom) backdropSamples.push(rgb);
    }
  }

  const cornerFrac = 0.12;
  const cornerW = Math.max(4, Math.floor(width * cornerFrac));
  const cornerH = Math.max(4, Math.floor(height * cornerFrac));
  const cornerSamples: number[][] = [];
  for (let y = height - cornerH; y < height; y++) {
    for (let x = width - cornerW; x < width; x++) {
      const i = (y * width + x) * channels;
      cornerSamples.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  const bgR = medianChannel(cornerSamples.length ? cornerSamples : backdropSamples, 0);
  const bgG = medianChannel(cornerSamples.length ? cornerSamples : backdropSamples, 1);
  const bgB = medianChannel(cornerSamples.length ? cornerSamples : backdropSamples, 2);

  const isBackdrop = (x: number, y: number) => {
    const i = (y * width + x) * channels;
    return rgbDistance(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB) <= COLOR_DISTANCE_THRESHOLD;
  };

  const columnBackdropRatio = (x: number) => {
    let backdrop = 0;
    for (let y = 0; y < height; y++) {
      if (isBackdrop(x, y)) backdrop++;
    }
    return backdrop / height;
  };

  const rowBackdropRatio = (y: number) => {
    let backdrop = 0;
    for (let x = 0; x < width; x++) {
      if (isBackdrop(x, y)) backdrop++;
    }
    return backdrop / width;
  };

  const BACKDROP_COL = 0.52;
  const MATERIAL_COL = 0.35;

  let minX = 0;
  for (let x = 0; x < width; x++) {
    if (columnBackdropRatio(x) < MATERIAL_COL) {
      minX = x;
      break;
    }
  }

  let maxX = width - 1;
  for (let x = width - 1; x >= 0; x--) {
    if (columnBackdropRatio(x) < BACKDROP_COL) {
      maxX = x;
      break;
    }
  }

  let minY = 0;
  for (let y = 0; y < height; y++) {
    if (rowBackdropRatio(y) < MATERIAL_COL) {
      minY = y;
      break;
    }
  }

  let maxY = height - 1;
  for (let y = height - 1; y >= 0; y--) {
    if (rowBackdropRatio(y) < BACKDROP_COL) {
      maxY = y;
      break;
    }
  }

  const inset = Math.floor(Math.min(width, height) * INSET_FRAC);
  minX = Math.min(width - 1, minX + inset);
  minY = Math.min(height - 1, minY + inset);
  maxX = Math.max(0, maxX - inset);
  maxY = Math.max(0, maxY - inset);

  const materialPixels = (maxX - minX + 1) * (maxY - minY + 1);
  const frac = materialPixels / (width * height);
  if (frac < MIN_MATERIAL_FRAC || maxX <= minX || maxY <= minY) {
    const insetFallback = Math.floor(Math.min(origW, origH) * 0.06);
    return {
      left: insetFallback,
      top: insetFallback,
      width: origW - insetFallback * 2,
      height: origH - insetFallback * 2,
    };
  }

  const sx = origW / width;
  const sy = origH / height;

  let left = Math.max(0, Math.floor(minX * sx));
  let top = Math.max(0, Math.floor(minY * sy));
  let cropW = Math.min(origW - left, Math.ceil((maxX - minX + 1) * sx));
  let cropH = Math.min(origH - top, Math.ceil((maxY - minY + 1) * sy));

  cropW = Math.max(MIN_OUTPUT_EDGE, Math.min(cropW, origW - left));
  cropH = Math.max(MIN_OUTPUT_EDGE, Math.min(cropH, origH - top));

  return { left, top, width: cropW, height: cropH };
}

export async function cropMaterialImageToBuffer(
  imagePath: string,
  box: CropBox,
): Promise<Buffer> {
  return sharp(imagePath)
    .extract(box)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
