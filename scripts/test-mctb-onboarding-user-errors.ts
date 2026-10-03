import assert from "node:assert/strict";
import { formatMctbOnboardingUserError } from "../src/lib/mctb/onboarding/user-facing-errors";

const msg = formatMctbOnboardingUserError("no_telnyx_toll_free_available");
assert.match(msg, /forwarding number/i);
assert.ok(!msg.includes("no_telnyx"));

console.log("test-mctb-onboarding-user-errors: ok");
