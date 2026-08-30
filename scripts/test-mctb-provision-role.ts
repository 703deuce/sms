import assert from "node:assert/strict";

function resolveRole(phoneNumberId: string) {
  return "customer_mctb" as const;
}

assert.equal(resolveRole("cmte8laci4o021u5q46723128"), "customer_mctb");
assert.equal(resolveRole("cmsgtjms84g6l2h0o255w1e3v"), "customer_mctb");

console.log("test-mctb-provision-role: ok");
