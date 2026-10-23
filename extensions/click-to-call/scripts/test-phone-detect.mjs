import assert from "node:assert/strict";
import { findPhoneNumbersInText, normalizeDigits } from "../phone-detect.js";

const found = findPhoneNumbersInText("Call us at (555) 123-4567 or +1 555-987-6543 today.");
assert.ok(found.length >= 2);
assert.equal(normalizeDigits("5551234567"), "+15551234567");

console.log("click-to-call phone-detect: PASS");
