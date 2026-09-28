/**
 * Static proof: platform sender cannot persist custom recovery template via Setup API.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const setup = readFileSync(path.join(process.cwd(), "src/app/api/mctb/setup/route.ts"), "utf8");
assert.ok(setup.includes('priorRuntime.senderMode === "PLATFORM"'));
assert.ok(setup.includes("delete body.messageTemplate"));
assert.ok(setup.includes("resolveMctbRecoveryOpenerTemplate"));
assert.ok(setup.includes("resolveMctbCapabilities"));
assert.ok(setup.includes("capabilities.recoveryPaid") || setup.includes("paidEntitled = capabilities.recoveryPaid"));

const caps = readFileSync(path.join(process.cwd(), "src/lib/mctb/capabilities.ts"), "utf8");
assert.ok(caps.includes("urgentBusinessSms"));
assert.ok(caps.includes("recoveryPaid"));
assert.ok(caps.includes("aiRecoveryEntitled"));
assert.ok(caps.includes("ownSenderAddOnEntitled"));

const urgent = readFileSync(
  path.join(process.cwd(), "src/lib/mctb/handoff/urgent-business-sms-entitlement.ts"),
  "utf8",
);
assert.ok(urgent.includes("urgentBusinessSms"));
assert.ok(!urgent.includes("hasActiveMctbPaidEntitlement(workspaceId)"));

console.log("test-mctb-platform-template-enforcement: PASS");
