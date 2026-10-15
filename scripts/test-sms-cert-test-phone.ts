#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  isSmsCertTestPhoneE164,
  shouldBypassSmsSuppressionForCertPhone,
} from "../src/lib/messaging/cert-test-phone";

assert.equal(isSmsCertTestPhoneE164("+15714776175"), true);
assert.equal(isSmsCertTestPhoneE164("5714776175"), true);
assert.equal(isSmsCertTestPhoneE164("+15551234567"), false);
assert.equal(shouldBypassSmsSuppressionForCertPhone("+15714776175"), true);

console.log("PASS sms-cert-test-phone");
