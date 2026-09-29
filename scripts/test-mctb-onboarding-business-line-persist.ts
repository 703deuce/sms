/**
 * Contract: onboarding business line writes workspace customFieldsConfig.mctb.businessLineE164
 * without auto-marking forwarding verified.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const route = readFileSync(
  join(process.cwd(), "src/app/api/mctb/onboarding/route.ts"),
  "utf8",
);
const binding = readFileSync(
  join(process.cwd(), "src/lib/mctb/tenant-production-binding.ts"),
  "utf8",
);

assert.match(route, /persistMctbWorkspaceBusinessLineE164/);
assert.match(binding, /export async function persistMctbWorkspaceBusinessLineE164/);
assert.doesNotMatch(binding, /forwardingConnectedAt.*persistMctbWorkspaceBusinessLineE164/s);

const connect = route.slice(route.indexOf('body.action === "complete_connect_phone"'));
assert.match(connect, /startForwardingVerificationTest/);
assert.match(connect, /startLiveTestSession/);

console.log("test-mctb-onboarding-business-line-persist: PASS");
