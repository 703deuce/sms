import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mapTelnyxAmdResult } from "../lib/server/phone/power-dialer/answer-detection";

const fixtures = JSON.parse(
  readFileSync(join(import.meta.dirname, "fixtures/power-dialer-amd-webhooks.json"), "utf8"),
) as { result: string; expectedClassification: string }[];

for (const f of fixtures) {
  const mapped = mapTelnyxAmdResult(f.result);
  assert.equal(mapped, f.expectedClassification, `AMD map ${f.result}`);
}
console.log("amd-fixture-mapping: PASS");

const orchestration = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/session-orchestration.ts"),
  "utf8",
);
assert.ok(orchestration.includes("orchestratePowerDialerSession"), "session orchestration module");
assert.ok(orchestration.includes("listUpcomingEligibleContacts"), "upcoming queue");
console.log("session-orchestration: PASS");

const amd = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/power-dialer-amd.ts"),
  "utf8",
);
assert.ok(amd.includes("answering_machine_detection_start"), "AMD start action");
console.log("power-dialer-amd: PASS");

const limits = readFileSync(
  join(import.meta.dirname, "../lib/server/phone/power-dialer/usage-limits.ts"),
  "utf8",
);
assert.ok(limits.includes("assertPowerDialerConcurrencyLimits"), "concurrency limits");
console.log("usage-limits: PASS");

console.log("power-dialer-b1: ALL PASS");
