import assert from "node:assert/strict";
import {
  buildVisualizerPrompt,
  normalizeVisualizerTransformation,
  type VisualizerTransformation,
} from "../src/lib/visualizer/generation/prompt-builder";

const SAMPLE = {
  materialName: "Long Baths Versailles",
  materialDescription: "Marble-look wall panel",
  enclosureStyle: "frameless glass",
  baseStyle: "low-threshold shower pan",
  fixtureFinish: "brushed nickel",
};

const ALL: VisualizerTransformation[] = [
  "TUB_TO_SHOWER",
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
  "SHOWER_AND_TUB_DECK_WRAP",
];

for (const transformation of ALL) {
  const prompt = buildVisualizerPrompt({ transformation, ...SAMPLE });
  assert.ok(prompt.includes("The first reference image is the original bathroom"), transformation);
  assert.ok(prompt.includes("Ignore any printed text, labels, logos"), transformation);
  assert.ok(prompt.includes("Do not change the camera angle"), transformation);
}

const tubToShower = buildVisualizerPrompt({ transformation: "TUB_TO_SHOWER", ...SAMPLE });
assert.ok(tubToShower.includes("Convert the existing bathtub area into a shower"));
assert.ok(tubToShower.includes("shower walls only"));

const tubToTub = buildVisualizerPrompt({ transformation: "TUB_TO_TUB", ...SAMPLE });
assert.ok(tubToTub.includes("Keep this as a bathtub layout"));
assert.ok(tubToTub.includes("around the tub area only"));

const showerToTub = buildVisualizerPrompt({ transformation: "SHOWER_TO_TUB", ...SAMPLE });
assert.ok(showerToTub.includes("Convert the existing shower area into a bathtub"));

const deckWrap = buildVisualizerPrompt({ transformation: "SHOWER_AND_TUB_DECK_WRAP", ...SAMPLE });
assert.ok(deckWrap.includes("both a shower and a separate bathtub"));
assert.ok(deckWrap.includes("Very important: do not continue that material upward"));
assert.ok(deckWrap.includes("not climb the entire wall around the tub"));

assert.equal(normalizeVisualizerTransformation("SHOWER_REPLACEMENT"), "TUB_TO_SHOWER");
assert.equal(normalizeVisualizerTransformation("SHOWER_AND_TUB_DECK_WRAP"), "SHOWER_AND_TUB_DECK_WRAP");

const revision = buildVisualizerPrompt({ transformation: "TUB_TO_SHOWER", isRevision: true, ...SAMPLE });
assert.ok(revision.startsWith("Revise the previous remodel concept"));

console.log("test-visualizer-prompt-builder: PASS");
