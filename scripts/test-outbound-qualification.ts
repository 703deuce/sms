/**
 * Unit tests for outbound lead qualification evaluator and validation.
 * Run: npx tsx scripts/test-outbound-qualification.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  evaluateQualificationOutcome,
  mergeQualificationFields,
  missingRequiredFields,
  normalizeQualificationFields,
  nextActionForOutcome,
} from "../src/lib/voice/outbound/qualification-evaluator";
import {
  validateOutboundDestination,
  assertOutboundTestModeEnabled,
} from "../src/lib/voice/outbound/outbound-call-service";
import type { QualificationDefinition } from "../src/lib/voice/outbound/types";

const fixture = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "scripts/fixtures/blue-ridge-realty-qualification.json"),
    "utf8",
  ),
) as QualificationDefinition;

assert.equal(validateOutboundDestination("5714776175"), "+15714776175");
assert.throws(() => validateOutboundDestination("abc"));

const merged = mergeQualificationFields(
  { name: "Anthony" },
  { target_location: "Woodbridge", price_range_or_budget: "~450000" },
);
assert.equal(merged.name, "Anthony");
assert.equal(merged.target_location, "Woodbridge");

const multiUtterance = normalizeQualificationFields({
  name: "Anthony",
  buying_or_selling: "buying",
  target_location: "Woodbridge",
  property_type: "townhouse",
  price_range_or_budget: "450000",
  timeframe: "3 months",
});
assert.equal(missingRequiredFields(fixture, multiUtterance).length, 0);

const qualified = evaluateQualificationOutcome({
  definition: fixture,
  collectedFields: multiUtterance,
  interested: true,
});
assert.equal(qualified, "QUALIFIED");

const corrected = mergeQualificationFields(multiUtterance, { target_location: "Stafford" });
assert.equal(corrected.target_location, "Stafford");

const notInterested = evaluateQualificationOutcome({
  definition: fixture,
  collectedFields: { name: "Anthony" },
  explicitOutcome: "NOT_INTERESTED",
});
assert.equal(notInterested, "NOT_INTERESTED");

const wrongNumber = evaluateQualificationOutcome({
  definition: fixture,
  collectedFields: {},
  explicitOutcome: "WRONG_NUMBER",
});
assert.equal(wrongNumber, "WRONG_NUMBER");

assert.match(nextActionForOutcome("QUALIFIED"), /follow-up/i);

const outboundServiceSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice/outbound/outbound-call-service.ts"),
  "utf8",
);
assert.match(
  outboundServiceSource,
  /createDispatch\(\s*roomName,\s*TRANSOVO_LIVEKIT_AGENT_NAME/s,
  "createDispatch must pass (roomName, agentName) per livekit-server-sdk",
);

const prev = process.env.OUTBOUND_VOICE_TEST_MODE;
process.env.OUTBOUND_VOICE_TEST_MODE = "1";
assert.doesNotThrow(() => assertOutboundTestModeEnabled());
process.env.OUTBOUND_VOICE_TEST_MODE = "0";
assert.throws(() => assertOutboundTestModeEnabled());
process.env.OUTBOUND_VOICE_TEST_MODE = prev;

const mainSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/main.ts"),
  "utf8",
);
const outboundEntry = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/outbound/entry.ts"),
  "utf8",
);
assert.ok(mainSource.includes("runOutboundLeadQualificationEntry"), "main routes outbound jobs");
assert.ok(mainSource.includes("runInboundEntry"), "main routes inbound jobs");
assert.ok(outboundEntry.includes("session.start"), "agent starts before dial");
assert.ok(outboundEntry.includes("createSipParticipant"), "dials after agent ready");
assert.ok(outboundEntry.includes("QualifyLeadTask"), "runs qualification after answer");

console.log("outbound qualification tests: PASS");
