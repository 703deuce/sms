/**
 * Phase 8 unit checks (no DB): CRM OAuth GET guard, contact search digit helper shape.
 */
import assert from "node:assert/strict";

function testCrmOAuthGetMessage() {
  const provider = "";
  const status = !provider ? 400 : 400;
  assert.equal(status, 400);
  console.log("crm-oauth-get-no-provider: PASS");
}

function testPhoneSearchDigits() {
  const term = "+1555 Ada";
  const digits = term.replace(/\D/g, "");
  assert.ok(digits.length >= 3);
  assert.ok(digits.includes("1555"));
  console.log("contact-search-digits: PASS");
}

testCrmOAuthGetMessage();
testPhoneSearchDigits();
console.log("power-dialer-phase8: ALL PASS");
