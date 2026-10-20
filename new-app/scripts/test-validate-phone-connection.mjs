import assert from "node:assert/strict";
import { isDemoFixturePhoneId } from "../lib/server/receptionist/phone-fixture-ids.ts";

assert.ok(isDemoFixturePhoneId("n1"));
assert.ok(isDemoFixturePhoneId("N2"));
assert.ok(!isDemoFixturePhoneId("cmvelb8d0000flm0lmsudc61b"));
assert.ok(!isDemoFixturePhoneId(""));

console.log("test-validate-phone-connection: PASS");
