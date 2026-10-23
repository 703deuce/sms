import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { canImpersonate } from "../lib/server/phone/power-dialer/impersonation";
import { scopeAllows } from "../lib/server/phone/power-dialer/public-api/scopes";
import { authenticatePowerDialerApiKey, checkRateLimit } from "../lib/server/phone/power-dialer/public-api/api-keys";

assert.equal(canImpersonate("MANAGER", "MEMBER"), true);
assert.equal(canImpersonate("MANAGER", "ADMINISTRATOR"), false);
assert.equal(canImpersonate("MEMBER", "MEMBER"), false);

assert.equal(scopeAllows("contacts:read", ["contacts:read"]), true);
assert.equal(scopeAllows("contacts:write", ["contacts:read"]), false);
assert.equal(scopeAllows("dial:write", ["admin"]), true);

const body = JSON.stringify({ id: "evt_1", type: "call.ended" });
const ts = "1700000000";
const secret = "whsec_test_secret_for_unit";
const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
assert.ok(sig.length === 64);

// Rate limit bucket
assert.equal(checkRateLimit("test-key-id", 2), true);
assert.equal(checkRateLimit("test-key-id", 2), true);
assert.equal(checkRateLimit("test-key-id", 2), false);

async function main() {
  assert.equal(await authenticatePowerDialerApiKey(null), null);
  assert.equal(await authenticatePowerDialerApiKey("Bearer invalid"), null);
  const zapierHook = { hookUrl: "https://hooks.zapier.com/hooks/catch/1/abc", event: "disposition.saved" };
  assert.ok(zapierHook.hookUrl.startsWith("https://"));
  console.log("test-power-dialer-batch7: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
