/**
 * Smoke: ensureMctbWorkspaceIngressReady is exported and idempotent guard uses getTrialNumberStatus.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const src = readFileSync(
  join(root, "src/lib/mctb/provisioning/ensure-workspace-ingress.ts"),
  "utf8",
);

assert.match(src, /ensureMctbWorkspaceIngressReady/);
assert.match(src, /getTrialNumberStatus/);
assert.match(src, /provisionMctbWorkspaceTollFreeIngress/);
assert.match(src, /provisionMctbPhoneTexmlIngressModeForWorkspace/);

const tollFreeSrc = readFileSync(
  join(root, "src/lib/mctb/provisioning/provision-workspace-toll-free-ingress.ts"),
  "utf8",
);
assert.match(tollFreeSrc, /routePhoneToMctbCallHandlingIngress/);
assert.match(tollFreeSrc, /setActiveCallHandler/);
assert.match(tollFreeSrc, /ensureMctbPlatformSenderDefault/);

const intakeSrc = readFileSync(join(root, "src/lib/mctb/own-sender-a2p-intake.ts"), "utf8");
assert.match(intakeSrc, /listMctbOwnSenderA2pSubmissionsForAdmin/);

console.log("test-mctb-workspace-ingress-ensure: PASS");
