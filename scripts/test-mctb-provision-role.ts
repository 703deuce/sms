import assert from "node:assert/strict";

function resolveRole(phoneNumberId: string, demoPhoneNumberId: string | null) {
  if (demoPhoneNumberId && phoneNumberId === demoPhoneNumberId) {
    return "platform_demo";
  }
  return "customer_mctb";
}

const DEMO = "cmte8laci4o021u5q46723128";
const OWNED = "cmsgtjms84g6l2h0o255w1e3v";

assert.equal(resolveRole(DEMO, DEMO), "platform_demo");
assert.equal(resolveRole(OWNED, DEMO), "customer_mctb");
assert.equal(resolveRole(OWNED, null), "customer_mctb");

console.log("test-mctb-provision-role: ok");
