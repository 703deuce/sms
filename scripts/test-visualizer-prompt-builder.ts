import assert from "node:assert/strict";
import { buildVisualizerEditPrompt } from "../src/lib/visualizer/generation/prompt-builder";

const prompt = buildVisualizerEditPrompt({
  transformation: "TUB_TO_SHOWER",
  selectedMaterials: [{ category: "WALL_PANEL", name: "White Marble" }],
  additionalInstructions: "Brushed nickel fixtures",
});

assert.ok(prompt.includes("bathtub"), "prompt mentions tub conversion");
assert.ok(prompt.includes("White Marble"), "prompt includes material name");
assert.ok(prompt.includes("Brushed nickel"), "prompt includes extra instructions");
assert.ok(prompt.includes("Preserve"), "prompt includes preservation language");

console.log("test-visualizer-prompt-builder: PASS");
