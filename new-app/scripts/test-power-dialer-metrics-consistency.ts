import assert from "node:assert/strict";
import {
  dedupeAttemptsById,
  isHumanConversation,
} from "../lib/server/phone/power-dialer/metrics-definitions";

/** Fixture: one attempt duplicated by webhook retry must not double-count. */
const attempts = dedupeAttemptsById([
  {
    id: "a1",
    disposition: "Interested",
    answerClassification: "human",
    billableSeconds: 120,
  },
  {
    id: "a1",
    disposition: "Interested",
    answerClassification: "human",
    billableSeconds: 120,
  },
  {
    id: "a2",
    disposition: null,
    answerClassification: "voicemail",
    billableSeconds: 30,
  },
]);

let human = 0;
let billable = 0;
for (const a of attempts) {
  if (isHumanConversation(a.disposition, a.answerClassification)) human += 1;
  billable += a.billableSeconds || 0;
}

assert.equal(attempts.length, 2);
assert.equal(human, 1);
assert.equal(billable, 150);

// Overview-style KPI for same fixture
const overviewHuman = attempts.filter((a) =>
  isHumanConversation(a.disposition, a.answerClassification),
).length;
assert.equal(overviewHuman, human);

console.log("metrics-consistency-fixture: PASS");
