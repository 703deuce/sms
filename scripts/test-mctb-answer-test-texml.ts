import assert from "node:assert/strict";
import {
  buildMctbInstantAnswerTestTexml,
  certModeUsesZeroDbAnswerTest,
} from "../src/lib/mctb/texml-ingress/answer-test-texml";

process.env.MCTB_ENTRY_ZERO_DB_SAY = "0";

assert.match(buildMctbInstantAnswerTestTexml(), /<Say voice="female">If you.+re hearing this, it was a success\.<\/Say><Hangup\/>/);
assert.equal(certModeUsesZeroDbAnswerTest("C3"), true);
assert.equal(certModeUsesZeroDbAnswerTest("D"), false);

process.env.MCTB_ENTRY_ZERO_DB_SAY = "1";
assert.equal(certModeUsesZeroDbAnswerTest("D"), true);
delete process.env.MCTB_ENTRY_ZERO_DB_SAY;

console.log("answer-test-texml tests passed");
