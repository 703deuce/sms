/**
 * Architecture guards — scheduling must not reintroduce English NLP in FIND path.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toolsMayRunInParallel } from "../src/lib/voice-v3/tools/concurrency-policy";

const findTool = readFileSync(
  join(process.cwd(), "src/lib/voice-v3/tools/find-availability-tool.ts"),
  "utf8",
);
assert.ok(
  !findTool.includes("parse-scheduling-expressions"),
  "find_availability must not import parse-scheduling-expressions",
);
assert.ok(
  !findTool.includes("mergeSchedulingNaturalLanguage"),
  "find_availability must not merge natural-language scheduling",
);
assert.ok(
  findTool.includes("SCHEDULING_PREFERENCE_REQUIRED"),
  "find_availability must guard on normalized scheduling preference",
);

assert.equal(
  toolsMayRunInParallel("find_availability", "set_scheduling_preference"),
  false,
  "FIND must not run in parallel with set_scheduling_preference",
);
assert.equal(
  toolsMayRunInParallel("update_intake", "set_scheduling_preference"),
  true,
  "intake and scheduling preference may run in parallel",
);

try {
  readFileSync(join(process.cwd(), "src/lib/voice-v3/time/parse-scheduling-expressions.ts"));
  assert.fail("parse-scheduling-expressions.ts NLP layer must be removed");
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  assert.equal(code, "ENOENT");
}

console.log("PASS voice-v3 scheduling architecture guards");
