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
  buildOpeningReplyInstructions,
  buildQualificationTaskInstructions,
  prefillCollectedFields,
  resolveOutboundCallMission,
  resolveOutboundProfileBusinessAnswer,
} from "../src/lib/voice/outbound/compile-outbound-call-context";
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

const lead = {
  leadPhone: "+15714776175",
  leadName: "Anthony",
  leadSource: "Website home buyer inquiry form",
  intent: "home buying",
  submittedFields: { name: "Anthony", callback_phone: "+15714776175" },
};

const mission = resolveOutboundCallMission({ qualification: fixture, lead });
const prefilled = prefillCollectedFields({ qualification: fixture, lead });
assert.equal(prefilled.name, "Anthony");
assert.equal(prefilled.callback_phone, "+15714776175");

const taskInstructions = buildQualificationTaskInstructions(mission);
assert.match(taskInstructions, /Blue Ridge Realty/);
assert.match(taskInstructions, /home buying|home buyer|finding homes/i);
assert.match(taskInstructions, /target_areas/);
assert.match(taskInstructions, /Do NOT invent specific homes/);

const opening = buildOpeningReplyInstructions(mission, prefilled);
assert.match(opening, /Do NOT ask about unrelated topics like 'projects'/);
assert.match(opening, /Anthony/);

const staffordAnswer = resolveOutboundProfileBusinessAnswer({
  business: fixture.business || null,
  businessName: fixture.businessName,
  topic: "Do you work in Stafford?",
});
assert.ok(staffordAnswer && /Stafford/i.test(staffordAnswer));

const mlsAnswer = resolveOutboundProfileBusinessAnswer({
  business: fixture.business || null,
  businessName: fixture.businessName,
  topic: "Do you have any townhouses for 450k in Woodbridge?",
});
assert.ok(mlsAnswer && /don't have live MLS/i.test(mlsAnswer));

const merged = mergeQualificationFields(
  prefilled,
  {
    target_areas: "Woodbridge",
    property_type: "townhouse",
    budget_or_price_range: "~$450,000",
    bedrooms: "3",
  },
);
assert.equal(merged.target_areas, "Woodbridge");
assert.equal(merged.property_type, "townhouse");

const multiUtterance = normalizeQualificationFields({
  ...merged,
  purchase_timeframe: "1-3 months",
  financing_status: "financing",
  preapproval_status: "in progress",
});
assert.equal(missingRequiredFields(fixture, multiUtterance).length, 0);

const qualified = evaluateQualificationOutcome({
  definition: fixture,
  collectedFields: multiUtterance,
  interested: true,
});
assert.equal(qualified, "QUALIFIED");

const corrected = mergeQualificationFields(multiUtterance, { target_areas: "Stafford" });
assert.equal(corrected.target_areas, "Stafford");

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
const qualifyTaskSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/outbound/qualify-lead-task.ts"),
  "utf8",
);
assert.ok(mainSource.includes("runOutboundLeadQualificationEntry"), "main routes outbound jobs");
assert.ok(mainSource.includes("runInboundEntry"), "main routes inbound jobs");
assert.ok(outboundEntry.includes("session.start"), "agent starts before dial");
assert.ok(outboundEntry.includes("createSipParticipant"), "dials after agent ready");
assert.ok(outboundEntry.includes("updateAgent(qualifyTask)"), "hand off via updateAgent after answer");
assert.ok(outboundEntry.includes("waitForQualificationComplete"), "waits for qualification completion");
assert.ok(outboundEntry.includes("prefillCollectedFields"), "pre-fills lead context before conversation");
assert.ok(
  !outboundEntry.includes("buildQualificationCloseLine"),
  "close/goodbye must be handled inside QualifyLeadTask, not a second generateReply in entry",
);
assert.ok(qualifyTaskSource.includes("buildQualificationTaskInstructions"), "uses compiled mission instructions");
assert.ok(qualifyTaskSource.includes("buildOpeningReplyInstructions"), "uses compiled opening guidance");
assert.ok(
  !/ask one open question about what they're looking for/.test(qualifyTaskSource),
  "must not use vague open-question prompt that caused 'projects' improvisation",
);
assert.ok(
  !/QualifyLeadTask\([^)]*\)\.run\(\)/.test(outboundEntry),
  "QualifyLeadTask.run must not be called outside a tool/task context",
);
assert.ok(
  !qualifyTaskSource.includes("this.complete(result)"),
  "must not complete QualifyLeadTask during set_qualification_outcome — that resumes the root agent and causes duplicate goodbyes",
);

console.log("outbound qualification tests: PASS");
