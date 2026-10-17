/**
 * Prints full backend prompts for inspection (sample material: Long Baths Versailles).
 * Run: npx tsx scripts/print-visualizer-prompts.ts
 */
import { buildVisualizerPrompt } from "../src/lib/visualizer/generation/prompt-builder";

const SAMPLE = {
  materialName: "Long Baths Versailles",
  materialDescription: "Marble-look acrylic wall panel sample",
  bathroomPhotoDescription: "Pink-wall bathroom with existing tub, window, and vanity",
  enclosureStyle: null as string | null,
  baseStyle: null as string | null,
  fixtureFinish: "brushed nickel",
};

const types = [
  "TUB_TO_SHOWER",
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
  "SHOWER_AND_TUB_DECK_WRAP",
] as const;

for (const transformation of types) {
  console.log("\n" + "=".repeat(72));
  console.log(`TRANSFORMATION: ${transformation}`);
  console.log("=".repeat(72));
  console.log(buildVisualizerPrompt({ transformation, ...SAMPLE }));
}
