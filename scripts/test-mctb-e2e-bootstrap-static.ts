/**
 * Static E2E wiring checks for MCTB signup → ingress → platform SMS separation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

assert.match(read("src/lib/mctb/provisioning/workspace-bootstrap.ts"), /ensureMctbWorkspaceIngressReady/);
assert.match(read("src/app/api/auth/signup/route.ts"), /ensureMctbWorkspaceBootstrap/);
assert.match(read("src/app/api/auth/google/callback/route.ts"), /ensureMctbWorkspaceBootstrap/);
assert.match(read("src/app/api/products/open/route.ts"), /ensureMctbWorkspaceBootstrap/);
assert.match(read("src/lib/products/entitlements.ts"), /ensureMctbWorkspaceBootstrap/);
assert.match(read("src/app/api/mctb/setup/route.ts"), /getWorkspaceIngressStatus/);
assert.match(read("src/app/api/mctb/onboarding/route.ts"), /ensureMctbWorkspaceIngressReady/);
assert.match(read("src/app/api/mctb/onboarding/route.ts"), /getWorkspaceIngressStatus/);
assert.match(read("src/lib/mctb/runtime-sms-phone-id.ts"), /reconcileMctbSmsPhoneNumberId/);
assert.doesNotMatch(
  read("src/app/api/mctb/setup/route.ts"),
  /sms_phone_number_id: sanitizedSmsPhoneNumberId \|\| sanitizedPhoneNumberId/,
);
assert.match(read("src/app/api/mctb/numbers/route.ts"), /ensureMctbWorkspaceIngressReady/);
assert.doesNotMatch(read("src/app/api/mctb/numbers/route.ts"), /provisionTrialMctbNumber/);

console.log("test-mctb-e2e-bootstrap-static: PASS");
