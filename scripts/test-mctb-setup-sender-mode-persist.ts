/**
 * Static: Opus Setup → Phone can persist senderMode via existing MissedCallTextConfig patch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const setupRoute = readFileSync(
  path.join(import.meta.dirname, "../src/app/api/mctb/setup/route.ts"),
  "utf8",
);

assert.match(setupRoute, /senderMode\?:\s*"PLATFORM"\s*\|\s*"WORKSPACE"/);
assert.match(setupRoute, /sender_mode:\s*body\.senderMode/);
assert.match(setupRoute, /resolveMctbCapabilities/);

const wiring = readFileSync(
  path.join(
    import.meta.dirname,
    "../src/newui-transplant/connected/mctb/mctb-setup-phone-wiring.ts",
  ),
  "utf8",
);
assert.match(wiring, /saveMctbSetup\(\{\s*senderMode:\s*"PLATFORM"/);
assert.match(wiring, /messaging\?\.senderMode/);

console.log("PASS test-mctb-setup-sender-mode-persist");
