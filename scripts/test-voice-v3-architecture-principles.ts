/**
 * Static checks for drive-through architecture principles in prompts/contracts.
 */
import assert from "node:assert/strict";
import { buildAstraCrossToolInstructions } from "../src/lib/voice-v3/prompts/astra-cross-tool-instructions";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cross = buildAstraCrossToolInstructions();
assert.ok(cross.includes("One utterance, multiple tools"), "cross-tool must document multi-tool utterances");
assert.ok(cross.includes("Persistent vs temporary state"), "cross-tool must distinguish persistent intake vs temp scheduling");
assert.ok(cross.includes("Read before mutate"), "cross-tool must document read-before-mutate");

const lessons = readFileSync(
  join(process.cwd(), "docs/VOICE-V3-DRIVE-THROUGH-ARCHITECTURE-LESSONS.md"),
  "utf8",
);
assert.ok(lessons.includes("Ten architecture rules"), "drive-through lessons doc must exist");

console.log("PASS voice-v3 architecture principles (static)");
