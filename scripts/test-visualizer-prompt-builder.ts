import assert from "node:assert/strict";
import {
  buildVisualizerPrompt,
  normalizeVisualizerTransformation,
  visualizerTransformationPromptForTests,
  type VisualizerTransformation,
} from "../src/lib/visualizer/generation/prompt-builder";
import { buildCatalogMaterialPromptDescription } from "../src/lib/visualizer/catalog-prompt-notes";

const FORBIDDEN_APPEARANCE = [
  "marble",
  "veining",
  "undertone",
  "charcoal",
  "travertine tone",
  "Material color fidelity",
  "24 inches",
  "laser-etched",
  "running-bond",
];

function assertNoAppearanceInference(prompt: string, label: string) {
  const lower = prompt.toLowerCase();
  for (const word of FORBIDDEN_APPEARANCE) {
    assert.ok(!lower.includes(word.toLowerCase()), `${label} should not mention "${word}"`);
  }
  assert.ok(!prompt.includes("Material notes:"), label);
  assert.ok(!prompt.includes("Napoli"), label);
}

const ALL: VisualizerTransformation[] = [
  "TUB_TO_SHOWER",
  "SHOWER_TO_SHOWER",
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
  "SHOWER_AND_TUB_DECK_WRAP",
];

for (const transformation of ALL) {
  const prompt = buildVisualizerPrompt({ transformation });
  assert.ok(prompt.includes("Image 1"), transformation);
  assert.ok(prompt.includes("Image 2"), transformation);
  assert.ok(!prompt.includes("Image 3"), `${transformation} without pattern ref`);
  assertNoAppearanceInference(prompt, transformation);
}

const tubToShower = buildVisualizerPrompt({ transformation: "TUB_TO_SHOWER" });
assert.ok(tubToShower.includes("Convert the bathtub in Image 1"));
assert.ok(tubToShower.includes("shower walls"));

const showerToShower = buildVisualizerPrompt({ transformation: "SHOWER_TO_SHOWER" });
assert.ok(showerToShower.includes("Keep the shower in Image 1"));

const tubToTub = buildVisualizerPrompt({ transformation: "TUB_TO_TUB" });
assert.ok(tubToTub.includes("tub-surround walls"));
assert.ok(tubToTub.includes("bathtub clearly visible"));

const showerToTub = buildVisualizerPrompt({ transformation: "SHOWER_TO_TUB" });
assert.ok(showerToTub.includes("Convert the existing shower in Image 1"));

const deckWrap = buildVisualizerPrompt({ transformation: "SHOWER_AND_TUB_DECK_WRAP" });
assert.ok(deckWrap.includes("separate shower and bathtub"));
assert.ok(deckWrap.includes("Do not extend it up the walls above the bathtub deck"));

assert.equal(normalizeVisualizerTransformation("SHOWER_REPLACEMENT"), "SHOWER_TO_SHOWER");

const withOptions = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  enclosureStyle: "framed glass",
  baseStyle: "low-threshold shower pan",
  fixtureFinish: "brushed nickel",
  showerWallHeight: "FULL_CEILING",
});
assert.ok(withOptions.includes("framed glass"));
assert.ok(withOptions.includes("base to ceiling"));

const eightFt = buildVisualizerPrompt({
  transformation: "SHOWER_TO_SHOWER",
  showerWallHeight: "EIGHT_FT",
});
assert.ok(eightFt.includes("about 8 feet"));

const etched = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  hasSurfacePatternReference: true,
});
assert.ok(etched.includes("Image 3"));
assert.ok(etched.includes("Image 2 as the color reference"));
assertNoAppearanceInference(etched, "etched three-ref");

assert.equal(
  buildCatalogMaterialPromptDescription({ panelLine: "PIONEER_PLUS", slug: "travertine" }),
  "",
);

const legacyDescIgnored = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  materialName: "Tundra Grey",
  materialDescription: "cool charcoal marble with white veining",
});
assertNoAppearanceInference(legacyDescIgnored, "materialDescription ignored");

const revision = buildVisualizerPrompt({ transformation: "TUB_TO_SHOWER", isRevision: true });
assert.ok(revision.startsWith("Refine the previous remodel preview"));

for (const t of ALL) {
  const len = visualizerTransformationPromptForTests(t).length;
  assert.ok(len < 1200, `${t} prompt should stay concise (got ${len} chars)`);
}

console.log("test-visualizer-prompt-builder: PASS");
