import assert from "node:assert/strict";
import {
  assessNumberHealth,
  computeWindowMetrics,
  type NumberSignalInput,
} from "../lib/server/phone/power-dialer/number-health-signals";

function row(partial: Partial<NumberSignalInput> & { attemptId: string }): NumberSignalInput {
  return {
    createdAt: new Date(),
    disposition: null,
    answerClassification: null,
    billableSeconds: null,
    answeredAt: null,
    endedAt: null,
    startedAt: null,
    ...partial,
  };
}

const empty = computeWindowMetrics([]);
assert.equal(empty.attempts, 0);
assert.equal(empty.answerRatePct, null);

const manyShort: NumberSignalInput[] = [];
for (let i = 0; i < 20; i++) {
  manyShort.push(
    row({
      attemptId: `a${i}`,
      answeredAt: new Date(),
      billableSeconds: 3,
      disposition: "No answer",
      answerClassification: "no_answer",
    }),
  );
}
const w7 = computeWindowMetrics(manyShort);
const w30 = computeWindowMetrics(manyShort);
const bad = assessNumberHealth(w7, w30);
assert.ok(bad.label === "watch" || bad.label === "at_risk");
assert.equal(bad.labelSource, "based_on_your_call_data");

console.log("test-power-dialer-number-health-signals: PASS");
