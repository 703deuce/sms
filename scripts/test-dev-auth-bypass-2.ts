import assert from "node:assert/strict";
import {
  devAuthBypass2EmailHint,
  devAuthBypass2ForbiddenWorkspaceIds,
  isDevAuthBypass2Enabled,
} from "../src/lib/auth/dev-auth-bypass";

const prev2 = process.env.DEV_AUTH_BYPASS_2;
const prevWs = process.env.MCTB_PROD_CERT_WORKSPACE_ID;

process.env.DEV_AUTH_BYPASS_2 = "1";
process.env.MCTB_PROD_CERT_WORKSPACE_ID = "ws_1";
assert.equal(isDevAuthBypass2Enabled(), true);
assert.ok(devAuthBypass2EmailHint().includes("@"));
assert.deepEqual(devAuthBypass2ForbiddenWorkspaceIds(), ["ws_1"]);

process.env.DEV_AUTH_BYPASS_2 = "0";
assert.equal(isDevAuthBypass2Enabled(), false);

if (prev2 !== undefined) process.env.DEV_AUTH_BYPASS_2 = prev2;
else delete process.env.DEV_AUTH_BYPASS_2;
if (prevWs !== undefined) process.env.MCTB_PROD_CERT_WORKSPACE_ID = prevWs;
else delete process.env.MCTB_PROD_CERT_WORKSPACE_ID;

console.log("test-dev-auth-bypass-2: ok");
