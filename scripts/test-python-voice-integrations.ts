/**
 * Python voice runtime integration bridge regression (static + import smoke).
 * Run: npx tsx scripts/test-python-voice-integrations.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const route = read("src/app/api/internal/voice-runtime/route.ts");
assert.ok(!route.includes("loadHandlers"), "voice-runtime route must not use loadHandlers");
assert.ok(route.includes("cancel_booking"), "route exposes cancel_booking");
assert.ok(route.includes("reschedule_booking"), "route exposes reschedule_booking");
assert.ok(route.includes("find_appointments"), "route exposes find_appointments");
assert.ok(route.includes("syncFrontDeskBookingToCrm") === false, "route should not import CRM directly");

const commit = read("src/lib/voice/python-runtime-bridge/commit-booking-for-python.ts");
assert.ok(commit.includes("syncFrontDeskBookingToCrm"), "commit booking syncs CRM (Zoho/SF/Pipedrive bus)");
assert.ok(commit.includes("get-availability-for-python"), "commit uses lightweight availability module");

const cancel = read("src/lib/voice/python-runtime-bridge/cancel-booking-for-python.ts");
assert.ok(cancel.includes("syncFrontDeskCancelToCrm"), "cancel syncs CRM appointment.cancelled event");
assert.ok(cancel.includes("cancelCalendlyEventResilient"), "cancel uses Calendly adapter path");

const pythonTools = read("voice-runtime-python/transovo_voice/agent/tools.py");
assert.ok(pythonTools.includes("cancel_booking"), "python worker calls cancel_booking bridge");
assert.ok(pythonTools.includes("reschedule_booking"), "python worker calls reschedule_booking bridge");
assert.ok(pythonTools.includes("find_appointments"), "python worker calls find_appointments bridge");
assert.ok(pythonTools.includes("has_tool"), "python gates calendar tools via enabled builtin tools");
const inbound = read("voice-runtime-python/transovo_voice/session/inbound.py");
assert.ok(inbound.includes("enabledBuiltinTools"), "bootstrap parses enabledBuiltinTools");

async function main() {
  const { getAvailabilityForPython } = await import(
    "../src/lib/voice/python-runtime-bridge/get-availability-for-python.ts"
  );
  const { cancelBookingForPython } = await import(
    "../src/lib/voice/python-runtime-bridge/cancel-booking-for-python.ts"
  );
  assert.equal(typeof getAvailabilityForPython, "function");
  assert.equal(typeof cancelBookingForPython, "function");

  console.log("test-python-voice-integrations: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
