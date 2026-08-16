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
  beginOutboundCallClosing,
  endCallToolMessage,
  endOutboundCall,
  isOutboundCallClosing,
} from "../voice-runtime/src/outbound/end-outbound-call";
import {
  validateOutboundDestination,
  assertOutboundTestModeEnabled,
} from "../src/lib/voice/outbound/outbound-call-service";
import {
  validateQualificationDefinition,
} from "../src/lib/voice/outbound/validate-qualification-definition";
import { createDefaultQualificationDefinition } from "../src/lib/voice/outbound/default-qualification-definition";
import type { QualificationDefinition } from "../src/lib/voice/outbound/types";
import type { OutboundLeadUserData } from "../voice-runtime/src/outbound/userdata";
import {
  isOutboundLeadQualificationProfile,
  isOutboundLeadQualificationRealtimeProfile,
  isOutboundLeadQualificationStackProfile,
  resolveOutboundRealtimePipelineConfig,
  OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
} from "../src/lib/voice/outbound/agent-config";
import { isOutboundRealtimeTestEnabled } from "../src/lib/voice/outbound/outbound-boot";
import { resolveOutboundRealtimeOutputMode } from "../voice-runtime/src/pipeline";
import {
  describeOutboundRealtimeTurnDetection,
  resolveOutboundRealtimeTurnDetection,
  resolveOutboundRealtimeVadMode,
} from "../voice-runtime/src/realtime-turn-config";
import {
  normalizeRealtimeNativeVoice,
  parseRealtimeNativeVoiceList,
  OUTBOUND_REALTIME_VOICE_BENCHMARK,
} from "../src/lib/voice/outbound/realtime-native-voices";

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
assert.match(taskInstructions, /Do NOT invent specific inventory|Do NOT invent specific homes/);

const defaultQual = createDefaultQualificationDefinition({ businessName: "Acme HVAC" });
assert.equal(validateQualificationDefinition(defaultQual).length, 0);
assert.ok(defaultQual.fields.length >= 3);
assert.ok(defaultQual.closeTemplate?.includes("{businessName}"));

const opening = buildOpeningReplyInstructions(mission, prefilled);
assert.match(opening, /Anthony/);
assert.match(opening, /Blue Ridge Realty/);

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
assert.ok(mlsAnswer && /does not have live inventory|don't have live MLS/i.test(mlsAnswer));

const stackConfig = {
  advanced: { livekitProfile: "outbound_lead_qualification" },
} as const;
const realtimeConfig = {
  advanced: {
    livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
    realtimeModel: "gpt-realtime-2.1-mini",
    realtimeVoice: "marin",
  },
} as const;
assert.ok(isOutboundLeadQualificationStackProfile(stackConfig));
assert.ok(!isOutboundLeadQualificationRealtimeProfile(stackConfig));
assert.ok(isOutboundLeadQualificationRealtimeProfile(realtimeConfig));
assert.ok(isOutboundLeadQualificationProfile(realtimeConfig));
assert.equal(
  resolveOutboundRealtimePipelineConfig(realtimeConfig).model,
  "gpt-realtime-2.1-mini",
);
assert.equal(resolveOutboundRealtimePipelineConfig(realtimeConfig).voice, "marin");
assert.equal(
  resolveOutboundRealtimePipelineConfig(realtimeConfig).reasoning?.effort,
  "low",
  "mini defaults to low reasoning for latency",
);
const fullRealtime = resolveOutboundRealtimePipelineConfig({
  advanced: {
    livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
    realtimeModel: "gpt-realtime-2.1",
  },
});
assert.equal(fullRealtime.model, "gpt-realtime-2.1");
assert.equal(fullRealtime.reasoning?.effort, "low");

assert.equal(normalizeRealtimeNativeVoice("Marin"), "marin");
assert.deepEqual([...OUTBOUND_REALTIME_VOICE_BENCHMARK], [
  "marin",
  "coral",
  "shimmer",
  "cedar",
]);
assert.deepEqual(parseRealtimeNativeVoiceList("marin,coral"), ["marin", "coral"]);
assert.throws(() => normalizeRealtimeNativeVoice("not-a-voice"));

const prevVoiceEnv = process.env.VOICE_REALTIME_VOICE;
process.env.VOICE_REALTIME_VOICE = "coral";
assert.equal(
  resolveOutboundRealtimePipelineConfig(realtimeConfig).voice,
  "marin",
  "agent realtimeVoice wins over VOICE_REALTIME_VOICE env",
);
assert.equal(
  resolveOutboundRealtimePipelineConfig(realtimeConfig, { voice: "shimmer" }).voice,
  "shimmer",
);
assert.equal(
  resolveOutboundRealtimePipelineConfig({
    advanced: {
      livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
      realtimeModel: "gpt-realtime-2.1-mini",
    },
    voiceLanguage: { voiceId: "shimmer", primaryLanguage: "en-US" },
  }).voice,
  "shimmer",
  "voiceLanguage picker wins over env when realtimeVoice unset",
);
assert.equal(
  resolveOutboundRealtimePipelineConfig({
    advanced: {
      livekitProfile: OUTBOUND_LEAD_QUALIFICATION_REALTIME_PROFILE,
      realtimeModel: "gpt-realtime-2.1-mini",
    },
  }).voice,
  "coral",
  "env fallback when agent has no configured realtime voice",
);
process.env.VOICE_REALTIME_VOICE = prevVoiceEnv;
if (prevVoiceEnv == null) delete process.env.VOICE_REALTIME_VOICE;

const prevRealtimeTest = process.env.OUTBOUND_REALTIME_TEST;
process.env.OUTBOUND_REALTIME_TEST = "1";
assert.equal(isOutboundRealtimeTestEnabled(), true);
process.env.OUTBOUND_REALTIME_TEST = "0";
assert.equal(isOutboundRealtimeTestEnabled(), false);
process.env.OUTBOUND_REALTIME_TEST = prevRealtimeTest;

const prevOutputMode = process.env.VOICE_REALTIME_OUTPUT_MODE;
process.env.VOICE_REALTIME_OUTPUT_MODE = "elevenlabs";
assert.equal(resolveOutboundRealtimeOutputMode(), "elevenlabs");
process.env.VOICE_REALTIME_OUTPUT_MODE = "native";
assert.equal(resolveOutboundRealtimeOutputMode(), "native");
process.env.VOICE_REALTIME_OUTPUT_MODE = prevOutputMode;

const prevVadMode = process.env.VOICE_REALTIME_VAD_MODE;
const prevVadEagerness = process.env.VOICE_REALTIME_VAD_EAGERNESS;
delete process.env.VOICE_REALTIME_VAD_MODE;
delete process.env.VOICE_REALTIME_VAD_EAGERNESS;
const defaultTurnDetection = resolveOutboundRealtimeTurnDetection();
assert.equal(defaultTurnDetection.mode, "semantic");
assert.equal(defaultTurnDetection.turnDetection.type, "semantic_vad");
if (defaultTurnDetection.turnDetection.type === "semantic_vad") {
  assert.equal(defaultTurnDetection.turnDetection.eagerness, "medium");
}
assert.deepEqual(describeOutboundRealtimeTurnDetection(defaultTurnDetection), {
  type: "semantic_vad",
  eagerness: "medium",
  interrupt_response: true,
});

process.env.VOICE_REALTIME_VAD_MODE = "server";
process.env.VOICE_REALTIME_VAD_SILENCE_MS = "400";
const serverVad = resolveOutboundRealtimeTurnDetection();
assert.equal(resolveOutboundRealtimeVadMode(), "server");
assert.equal(serverVad.turnDetection.type, "server_vad");
if (serverVad.turnDetection.type === "server_vad") {
  assert.equal(serverVad.turnDetection.silence_duration_ms, 400);
  assert.equal(serverVad.turnDetection.threshold, 0.75);
}

process.env.VOICE_REALTIME_VAD_MODE = prevVadMode;
process.env.VOICE_REALTIME_VAD_EAGERNESS = prevVadEagerness;
if (prevVadMode == null) delete process.env.VOICE_REALTIME_VAD_MODE;
if (prevVadEagerness == null) delete process.env.VOICE_REALTIME_VAD_EAGERNESS;

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
assert.ok(outboundEntry.includes("endOutboundCall"), "all hangups go through idempotent endOutboundCall");
assert.ok(
  !outboundEntry.includes("buildQualificationCloseLine"),
  "close/goodbye must be handled inside QualifyLeadTask, not a second generateReply in entry",
);
assert.ok(qualifyTaskSource.includes("buildQualificationTaskInstructions"), "uses compiled mission instructions");
assert.ok(qualifyTaskSource.includes("deliverOutboundOpening"), "opening uses verbatim TTS say, not generateReply");
assert.ok(
  !qualifyTaskSource.includes("buildOpeningReplyInstructions"),
  "opening must not use LLM generateReply — callee hello causes duplicate intros",
);
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

const endCallSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/outbound/end-outbound-call.ts"),
  "utf8",
);
assert.match(endCallSource, /outbound_end_call_effective/);
assert.match(endCallSource, /outbound_end_call_duplicate/);

const rootAgentSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/outbound/new-lead-qualification-agent.ts"),
  "utf8",
);
assert.ok(rootAgentSource.includes("tools: {}"), "root shell must not expose end_call");

function makeMockSession(userData: Partial<OutboundLeadUserData> & { callId: string }) {
  const ud = {
    workspaceId: "ws_1",
    agentId: "agent_1",
    businessName: "Blue Ridge Realty",
    timezone: "America/New_York",
    collectedFields: {},
    interested: true,
    qualificationComplete: false,
    job: { kind: "outbound_lead_qualification" },
    ...userData,
  } as OutboundLeadUserData;
  const shutdownCalls: string[] = [];
  return {
    userData: ud,
    shutdownCalls,
    session: {
      userData: ud,
      shutdown: (opts: { reason?: string }) => {
        shutdownCalls.push(opts.reason || "unknown");
      },
      interrupt: () => ({ await: Promise.resolve() }),
    },
  };
}

void (async () => {
  const mock = makeMockSession({ callId: "call-idempotent-1" });
  const first = await endOutboundCall(mock.session as never, { source: "end_call_tool" });
  const second = await endOutboundCall(mock.session as never, { source: "end_call_tool" });
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(second.reason, "already_ended");
  assert.equal(mock.shutdownCalls.length, 1);
  assert.match(endCallToolMessage(second), /already ending/i);

  const closing = makeMockSession({ callId: "call-closing-1" });
  assert.equal(beginOutboundCallClosing(closing.userData), true);
  assert.equal(beginOutboundCallClosing(closing.userData), false);
  assert.equal(isOutboundCallClosing(closing.userData), true);

  console.log("outbound qualification tests: PASS");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
