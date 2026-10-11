import assert from "node:assert/strict";
import {
  phoneDigitsAppearInAppointmentText,
  validateLunaPhoneExtraction,
} from "./reminder-phone-evidence";

assert.equal(
  phoneDigitsAppearInAppointmentText("+15715550188", ["Customer mobile: (571) 555-0188"]),
  true,
);

const accepted = validateLunaPhoneExtraction(
  {
    found: true,
    phone: "571-555-0123",
    source_field: "description",
    evidence: "Mary Johnson 571-555-0123",
    number_role: "customer",
  },
  ["Mary Johnson 571-555-0123. Office: 703-555-0188"],
);
assert.equal(accepted.ok, true);

const rejectedRole = validateLunaPhoneExtraction(
  {
    found: true,
    phone: "703-555-0188",
    number_role: "business",
  },
  ["Office: 703-555-0188"],
);
assert.equal(rejectedRole.ok, false);

const rejectedInvented = validateLunaPhoneExtraction(
  {
    found: true,
    phone: "+15550001111",
    number_role: "customer",
  },
  ["No phone here"],
);
assert.equal(rejectedInvented.ok, false);

console.log("reminder-phone-evidence.test.ts: ok");
