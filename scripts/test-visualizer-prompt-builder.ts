import assert from "node:assert/strict";
import {
  buildCoverageInstruction,
  buildVisualizerPrompt,
  buildVisualizerPromptForTests,
  coverageModeFromShowerWallHeight,
  normalizeVisualizerTransformation,
  type VisualizerTransformation,
} from "../src/lib/visualizer/generation/prompt-builder";

const TO_CEILING = "extend the wall panels all the way to the ceiling";
const PARTIAL = "keep painted wall above the panel line";
const DECK_UPPER =
  "do not continue that material up the tub-side upper walls above the deck";

const WET_TRANSFORMATIONS: VisualizerTransformation[] = [
  "TUB_TO_SHOWER",
  "SHOWER_TO_SHOWER",
  "TUB_TO_TUB",
  "SHOWER_TO_TUB",
];

for (const t of WET_TRANSFORMATIONS) {
  const full = buildVisualizerPromptForTests(t, "FULL_CEILING");
  assert.ok(full.toLowerCase().includes(TO_CEILING), `${t} full ceiling`);
  assert.ok(!full.toLowerCase().includes(PARTIAL), `${t} full must not ask partial`);

  const partial = buildVisualizerPromptForTests(t, "EIGHT_FT");
  assert.ok(partial.toLowerCase().includes(PARTIAL), `${t} partial height`);
  assert.ok(!partial.toLowerCase().includes(TO_CEILING), `${t} partial must not say to ceiling`);
}

const deckFull = buildVisualizerPromptForTests("SHOWER_AND_TUB_DECK_WRAP", "FULL_CEILING");
assert.ok(deckFull.toLowerCase().includes("shower wall panels all the way to the ceiling"));
assert.ok(deckFull.toLowerCase().includes(DECK_UPPER));

const deckPartial = buildVisualizerPromptForTests("SHOWER_AND_TUB_DECK_WRAP", "EIGHT_FT");
assert.ok(deckPartial.toLowerCase().includes("stop the shower wall panels"));
assert.ok(deckPartial.toLowerCase().includes(DECK_UPPER));

for (const t of [...WET_TRANSFORMATIONS, "SHOWER_AND_TUB_DECK_WRAP"] as VisualizerTransformation[]) {
  const p = buildVisualizerPromptForTests(t, "FULL_CEILING");
  const open = p.indexOf("Image 1");
  const cov = p.toLowerCase().indexOf("extend") >= 0 || p.toLowerCase().includes("apply the selected");
  assert.ok(open >= 0, `${t} mentions Image 1`);
  assert.ok(cov, `${t} has coverage before material ref`);
  const matIdx = p.indexOf("Image 2");
  const covIdx = p.toLowerCase().indexOf("wall panel");
  assert.ok(covIdx < matIdx, `${t} coverage should precede Image 2 material line`);
}

const noMaterialProse = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  materialName: "Sierra Sand",
  materialDescription: "warm beige marble with veining",
  showerWallHeight: "FULL_CEILING",
});
assert.ok(!noMaterialProse.includes("Sierra Sand"));
assert.ok(!noMaterialProse.includes("veining"));
assert.ok(!noMaterialProse.includes("Material notes"));
assert.ok(
  noMaterialProse.includes("do not darken the base color"),
  "material fidelity anti-darkening line",
);
assert.ok(noMaterialProse.includes("lightness, and hue"), "material lightness and hue");

const etched = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  showerWallHeight: "FULL_CEILING",
  hasSurfacePatternReference: true,
  surfacePatternKind: "pioneer_block",
});
assert.ok(etched.includes("Image 3"));
assert.ok(etched.includes("stone-block"));
assert.ok(!etched.includes("Image 4"));

const twoRef = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  hasSurfacePatternReference: false,
});
assert.ok(!twoRef.includes("Image 3"));
assert.ok(twoRef.includes("no tile grout lines"));

const travertineStyle = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  showerWallHeight: "FULL_CEILING",
});
assert.ok(!travertineStyle.includes("Image 3"));
assert.ok(travertineStyle.includes("seamless shower wall panels"));

assert.equal(coverageModeFromShowerWallHeight("FULL_CEILING"), "TO_CEILING");
assert.equal(coverageModeFromShowerWallHeight("EIGHT_FT"), "SURROUND_HEIGHT");

assert.equal(normalizeVisualizerTransformation("SHOWER_REPLACEMENT"), "SHOWER_TO_SHOWER");

const revision = buildVisualizerPrompt({
  transformation: "TUB_TO_SHOWER",
  isRevision: true,
  showerWallHeight: "FULL_CEILING",
});
assert.ok(revision.startsWith("Refine the previous remodel preview"));

assert.ok(
  buildCoverageInstruction("TUB_TO_SHOWER", "TO_CEILING").toLowerCase().includes(TO_CEILING),
);

console.log("test-visualizer-prompt-builder: PASS");

// Character counts for audit (stdout only in CI if needed)
for (const t of [...WET_TRANSFORMATIONS, "SHOWER_AND_TUB_DECK_WRAP"] as VisualizerTransformation[]) {
  const len = buildVisualizerPromptForTests(t, "FULL_CEILING").length;
  assert.ok(len < 900, `${t} prompt length ${len}`);
}
