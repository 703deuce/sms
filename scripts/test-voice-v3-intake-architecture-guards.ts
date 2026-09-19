/**
 * Intake Objective architecture guards (static).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const INTAKE_ROOT = join(process.cwd(), "src/lib/voice-v3/intake-objective");

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walkTsFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const forbiddenIdentifiers = [
  "getNextIntakeQuestion",
  "nextQuestion",
  "shouldSpeak",
  "speechText",
  "plannerDirective",
  "GoalManager",
  "planAgentState",
  "applyCallerMeaning",
  "response.create",
];

for (const file of walkTsFiles(INTAKE_ROOT)) {
  const rel = relative(process.cwd(), file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8");
  for (const id of forbiddenIdentifiers) {
    assert.ok(!content.includes(id), `${rel} must not reference ${id}`);
  }
}

const updateTool = readFileSync(
  join(process.cwd(), "src/lib/voice-v3/tools/update-intake-tool.ts"),
  "utf8",
);
assert.ok(!updateTool.includes("active_goal"), "update_intake must not accept active_goal");
assert.ok(!updateTool.includes("find_availability"), "update_intake must not dispatch FIND");

console.log("PASS voice-v3 intake architecture guards");
