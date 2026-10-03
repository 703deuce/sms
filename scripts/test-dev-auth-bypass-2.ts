import assert from "node:assert/strict";
import {
  devAuthBypass2EmailHint,
  devAuthBypass2ForbiddenWorkspaceIds,
  isDevAuthBypass2Enabled,
  isDevAuthBypassAutoEnabled,
  isDevAuthBypassEnabled,
} from "../src/lib/auth/dev-auth-bypass";

const prev2 = process.env.DEV_AUTH_BYPASS_2;
const prevWs = process.env.MCTB_PROD_CERT_WORKSPACE_ID;
const prevBypass = process.env.DEV_AUTH_BYPASS;
const prevAuto = process.env.DEV_AUTH_BYPASS_AUTO;

process.env.DEV_AUTH_BYPASS = "1";
delete process.env.DEV_AUTH_BYPASS_AUTO;
assert.equal(isDevAuthBypassEnabled(), true);
assert.equal(isDevAuthBypassAutoEnabled(), false);
process.env.DEV_AUTH_BYPASS_AUTO = "1";
assert.equal(isDevAuthBypassAutoEnabled(), true);

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
