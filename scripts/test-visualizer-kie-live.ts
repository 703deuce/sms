/**
 * Live KIE (Nano Banana) generation smoke test — real API, real images.
 *
 * Usage:
 *   KIE_API_KEY=... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/test-visualizer-kie-live.ts \
 *     --room /path/to/bathroom.jpg \
 *     --material /path/to/wall-sample.jpg \
 *     --out /opt/cursor/artifacts/kie-live-result.jpg
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildVisualizerPrompt } from "../src/lib/visualizer/generation/prompt-builder";
import { runKieBathroomGeneration } from "../src/lib/visualizer/generation/provider-kie";
import {
  resolveVisualizerKieModel,
  resolveVisualizerKieResolution,
} from "../src/lib/visualizer/generation/kie-config";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i >= process.argv.length - 1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  if (process.env.VISUALIZER_KIE_MOCK === "1") {
    throw new Error("Unset VISUALIZER_KIE_MOCK for live KIE test.");
  }

  const roomPath = arg("--room");
  const materialPath = arg("--material");
  const outPath = arg("--out") || path.join(process.cwd(), "kie-live-result.jpg");

  if (!roomPath || !materialPath) {
    throw new Error("Required: --room <bathroom.jpg> --material <wall-sample.jpg> [--out result.jpg]");
  }

  const roomBytes = await readFile(roomPath);
  const materialBytes = await readFile(materialPath);

  const prompt = buildVisualizerPrompt({
    transformation: "TUB_TO_SHOWER",
    materialName: "Versailles",
    materialDescription: "Long Baths wall panel sample — light marble look",
    preserveVanity: true,
    preserveWindow: true,
    preserveDoor: true,
  });

  console.log("[kie-live] model", resolveVisualizerKieModel());
  console.log("[kie-live] resolution", resolveVisualizerKieResolution());
  console.log("[kie-live] room bytes", roomBytes.length);
  console.log("[kie-live] material bytes", materialBytes.length);
  console.log("[kie-live] prompt length", prompt.length);

  const started = Date.now();
  const result = await runKieBathroomGeneration({
    workspaceId: "kie_live_smoke",
    prompt,
    roomImage: roomBytes,
    roomMime: "image/jpeg",
    referenceImages: [{ bytes: materialBytes, mime: "image/jpeg", label: "versailles-panel" }],
  });

  const ext = result.mimeType.includes("png") ? "png" : "jpg";
  const finalOut = outPath.endsWith(".png") || outPath.endsWith(".jpg") ? outPath : `${outPath}.${ext}`;
  await writeFile(finalOut, result.imageBytes);

  const elapsedSec = Math.round((Date.now() - started) / 1000);
  console.log("[kie-live] PASS");
  console.log("[kie-live] taskId", result.taskId);
  console.log("[kie-live] model", result.model);
  console.log("[kie-live] output bytes", result.imageBytes.length);
  console.log("[kie-live] elapsedSec", elapsedSec);
  console.log("[kie-live] wrote", finalOut);
}

main().catch((e) => {
  console.error("[kie-live] FAIL", e instanceof Error ? e.message : e);
  process.exit(1);
});
