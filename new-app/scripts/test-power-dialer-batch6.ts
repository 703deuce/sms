import assert from "node:assert/strict";
import {
  analyticsRepFilter,
  scopesForMembershipRole,
} from "../lib/server/phone/power-dialer/power-dialer-permissions";
import { buildConversationIntelligence } from "../lib/server/phone/power-dialer/call-intelligence";
import { labelForCallSource, resolveCallSourceKind } from "../lib/server/phone/power-dialer/call-source-label";
import { dedupeAttemptsById, isHumanConversation } from "../lib/server/phone/power-dialer/metrics-definitions";

assert.deepEqual(scopesForMembershipRole("MEMBER"), ["dial", "analytics_read", "recordings_listen"]);
assert.ok(scopesForMembershipRole("MANAGER").includes("analytics_export"));
assert.ok(scopesForMembershipRole("OWNER").includes("settings_write"));
assert.equal(analyticsRepFilter("MEMBER", "u1"), "u1");
assert.equal(analyticsRepFilter("MANAGER", "u1"), null);

const intel = buildConversationIntelligence(
  "Thanks for calling. I am interested in pricing but need to call back tomorrow.",
);
assert.equal(intel.modelDerived, true);
assert.ok(intel.actionItems.length > 0);
assert.ok(intel.summary.includes("Sentiment"));

assert.equal(resolveCallSourceKind("power_dialer", { dialOrigin: "cadence" }), "cadence");
assert.equal(labelForCallSource("manual_dial" as const), "Manual dial");

const attempts = [
  { id: "1", disposition: "Interested", answerClassification: "human" },
  { id: "1", disposition: "Interested", answerClassification: "human" },
];
assert.equal(dedupeAttemptsById(attempts).length, 1);
assert.equal(isHumanConversation("Interested", "human"), true);

console.log("test-power-dialer-batch6: PASS");
