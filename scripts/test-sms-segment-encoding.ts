import assert from "node:assert/strict";
import { analyzeSmsBody, estimateSmsSegmentsFromAnalysis } from "@/lib/sms/segment-encoding";
import { estimateSmsSegments } from "@/lib/utils";

const gsm160 = "a".repeat(160);
assert.equal(analyzeSmsBody(gsm160).segmentCount, 1);
assert.equal(analyzeSmsBody(gsm160).encoding, "GSM7");
assert.equal(analyzeSmsBody(gsm160 + "b").segmentCount, 2);
assert.equal(analyzeSmsBody("a".repeat(153 * 2)).segmentCount, 2);

const unicode70 = "é".repeat(70);
assert.equal(analyzeSmsBody(unicode70).encoding, "UCS2");
assert.equal(analyzeSmsBody(unicode70).segmentCount, 1);

const curly = "We close at 6 PM — thanks!";
const curlyAnalysis = analyzeSmsBody(curly);
assert.equal(curlyAnalysis.encoding, "UCS2");
assert.equal(analyzeSmsBody("We close at 6 PM - thanks!").encoding, "GSM7");
assert.equal(curlyAnalysis.unnecessaryUcs2, true);

const utils = estimateSmsSegments(gsm160);
const canon = estimateSmsSegmentsFromAnalysis(gsm160);
assert.equal(utils.segments, canon.segments);

console.log("test-sms-segment-encoding: OK");
