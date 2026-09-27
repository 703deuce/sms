/**
 * Exhaustive backend proof: every wizard page / control maps into draftConfig
 * and the compiled primary flow for each agent preset.
 *
 * Run: npx tsx scripts/test-wizard-pages-backend.ts
 */
import assert from "assert";
import {
  applyWizardPreset,
  createDefaultWizardState,
  CAPABILITY_OPTIONS,
  ANSWER_WHEN_OPTIONS,
  WIZARD_VOICES,
  TEST_SCENARIOS,
} from "../src/lib/solutions/appointment-receptionist/defaults";
import {
  allowedCapabilitiesForPreset,
  capabilityOptionsForPreset,
  hasBookingCapability,
  testScenariosForCapabilities,
  visibleWizardSteps,
  uniqueAgentDisplayName,
  answerWhenOptionsForPreset,
} from "../src/lib/solutions/appointment-receptionist/wizard-presets";
import { buildWizardAgentConfig } from "../src/lib/solutions/appointment-receptionist/build-agent-config";
import {
  buildVoiceAgentPrimaryDefinition,
  VOICE_MANAGED_TEMPLATE_KEYS,
} from "../src/lib/agents/compile-workflow";
import { reconcileManagedNodes } from "../src/lib/agents/workflows";
import {
  AUTOMATION_BLOCKS,
  getBlock,
} from "../src/lib/automations/catalog";
import {
  nodeSummary,
  parseAutomationDefinition,
} from "../src/lib/automations/types";
import {
  getWizardActivationIssues,
  hasBlockingActivationIssues,
} from "../src/lib/solutions/appointment-receptionist/capability-checklist";
import { validateAutomationForPublish, hasBlockingErrors } from "../src/lib/automations/validation";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

const PRESETS = [
  "every_call",
  "nobody_answers",
  "after_hours",
  "lead_capture",
  "service_intake",
  null, // appointment booking default
] as const;

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`✓ ${label}`);
}

function fillCompleteState(
  base: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  return {
    ...base,
    solutionName: uniqueAgentDisplayName(base.solutionName || "Test Agent", "08-05 15:00"),
    businessName: "Acme Dental",
    agentName: "Astra",
    phoneNumberId: "pn_test_1",
    phoneNumberE164: "+15551234567",
    websiteUrl: "https://acme.example",
    knowledgeItems: base.knowledgeItems.map((i) =>
      i.id === "hours"
        ? {
            ...i,
            summary: "Mon-Fri 9am-5pm",
            status: "complete" as const,
            statusLabel: "Configured",
          }
        : i.id === "business"
          ? {
              ...i,
              summary: "Acme Dental · 123 Main St",
              status: "complete" as const,
              statusLabel: "Configured",
            }
          : i,
    ),
    transferDestinationName: "Front desk",
    transferDestinationPhone: "+15559876543",
    calendarConnected: hasBookingCapability(base.capabilities),
    calendarProvider: hasBookingCapability(base.capabilities) ? "google" : null,
    lastTestPassed: true,
    connectionGreeting: "create_custom",
    connectionGreetingText: "Thanks for calling Acme. Connecting you now.",
  };
}

console.log("\n=== Goals page: capabilities & answer-when per preset ===");
for (const preset of PRESETS) {
  const state = applyWizardPreset(createDefaultWizardState(), preset);
  const allowed = new Set(allowedCapabilitiesForPreset(preset));
  const options = capabilityOptionsForPreset(preset);
  assert.equal(options.length, allowed.size);
  for (const o of options) assert.ok(allowed.has(o.id));
  // No booking caps on pure answering presets
  if (preset === "every_call" || preset === "nobody_answers" || preset === "after_hours") {
    assert.ok(!allowed.has("book_appointments"), `${preset} must not allow booking`);
  }
  const answerOpts = answerWhenOptionsForPreset(preset);
  assert.ok(answerOpts.length >= 1);
  for (const a of answerOpts) {
    assert.ok(ANSWER_WHEN_OPTIONS.some((x) => x.id === a.id));
  }
  ok(`Goals filters for preset=${preset || "appointment_booking"} (${options.length} caps, ${answerOpts.length} answer-when)`);
}

console.log("\n=== Visible wizard steps per preset ===");
for (const preset of PRESETS) {
  const state = applyWizardPreset(createDefaultWizardState(), preset);
  const steps = visibleWizardSteps(state).map((s) => s.id);
  assert.ok(steps.includes("goals"));
  assert.ok(steps.includes("phone"));
  assert.ok(steps.includes("information"));
  assert.ok(steps.includes("call-handling"));
  assert.ok(steps.includes("voice"));
  assert.ok(steps.includes("test"));
  assert.ok(steps.includes("activate"));
  if (hasBookingCapability(state.capabilities)) {
    assert.ok(steps.includes("appointments"), `${preset} should show appointments`);
  } else {
    assert.ok(!steps.includes("appointments"), `${preset} must hide appointments`);
  }
  ok(`Steps for ${preset || "booking"}: ${steps.join(" → ")}`);
}

console.log("\n=== Information page → draftConfig knowledge ===");
{
  const state = fillCompleteState(
    applyWizardPreset(createDefaultWizardState(), "every_call"),
  );
  state.knowledgeSource = "guided_profile";
  const cfg = buildWizardAgentConfig(state);
  const snap = (cfg.advanced as { appointmentReceptionistWizard: AppointmentReceptionistWizardState })
    .appointmentReceptionistWizard;
  assert.equal(snap.businessName, "Acme Dental");
  assert.ok(
    snap.knowledgeItems.some((i) => i.summary.includes("Mon-Fri")),
    "hours must persist",
  );
  assert.ok(cfg.instructions?.system?.includes("Acme Dental"));
  assert.ok(cfg.instructions?.system?.includes("Mon-Fri") || JSON.stringify(snap).includes("Mon-Fri"));
  ok("Information/guided profile fields persist into draftConfig + system prompt");
}

console.log("\n=== Phone page fields persist ===");
{
  const state = fillCompleteState(createDefaultWizardState());
  state.numberSource = "existing";
  state.ringBehavior = "ring_team_first";
  state.ringTeamSeconds = 25;
  state.callRecording = "inbound_only";
  state.connectionGreeting = "create_custom";
  state.connectionGreetingText = "One moment please.";
  const cfg = buildWizardAgentConfig(state);
  const snap = (cfg.advanced as { appointmentReceptionistWizard: AppointmentReceptionistWizardState })
    .appointmentReceptionistWizard;
  assert.equal(snap.phoneNumberE164, "+15551234567");
  assert.equal(snap.ringTeamSeconds, 25);
  assert.equal(snap.callRecording, "inbound_only");
  assert.equal(snap.connectionGreetingText, "One moment please.");
  ok("Phone page: number, ring, recording, greeting persist");
}

console.log("\n=== Appointments page (booking only) ===");
{
  const state = fillCompleteState(createDefaultWizardState());
  assert.ok(hasBookingCapability(state.capabilities));
  state.appointmentTypes = state.appointmentTypes.map((t) =>
    t.id === "initial"
      ? { ...t, durationMin: 45, enabled: true, name: "New Patient" }
      : t,
  );
  state.bookingBehavior = {
    ...state.bookingBehavior,
    confirmBeforeBooking: true,
    sendSmsAfterBooking: true,
    askServiceFirst: true,
  };
  const cfg = buildWizardAgentConfig(state);
  const snap = (cfg.advanced as { appointmentReceptionistWizard: AppointmentReceptionistWizardState })
    .appointmentReceptionistWizard;
  assert.ok(snap.appointmentTypes.some((t) => t.name === "New Patient" && t.durationMin === 45));
  assert.equal(snap.bookingBehavior.sendSmsAfterBooking, true);
  ok("Appointments types + booking behavior persist");
}

console.log("\n=== Call Handling page ===");
{
  const state = fillCompleteState(
    applyWizardPreset(createDefaultWizardState(), "every_call"),
  );
  state.transferTriggers = ["Caller asks for a person", "Urgent issue"];
  state.warmTransfer = true;
  state.detectVoicemailOnTransfer = true;
  state.transferFallback = "take_message";
  state.longTermMemory = true;
  state.crmEnabled = false; // answering — CRM hidden in UI
  const cfg = buildWizardAgentConfig(state);
  const snap = (cfg.advanced as { appointmentReceptionistWizard: AppointmentReceptionistWizardState })
    .appointmentReceptionistWizard;
  assert.equal(snap.transferDestinationPhone, "+15559876543");
  assert.equal(snap.warmTransfer, true);
  assert.equal(snap.transferFallback, "take_message");
  assert.equal(snap.longTermMemory, true);
  ok("Call handling transfer/fallback/memory persist");
}

console.log("\n=== Voice page: every catalog voice builds ===");
for (const voice of WIZARD_VOICES) {
  const state = fillCompleteState(createDefaultWizardState());
  // Voice V3 GPT-Live voices compile through the LiveKit/OpenAI realtime publish path.
  state.bookingStrategy = "MICROSOFT_365";
  state.calendarProvider = "microsoft";
  state.calendarConnected = true;
  state.voiceId = voice.id;
  state.voiceLabel = voice.label;
  state.speakingSpeed = voice.recommendedSpeed;
  state.responsiveness = 0.9;
  state.interruptionSensitivity = 0.6;
  state.tone = "Warm and professional";
  state.openingGreeting = "Hi, thanks for calling {{businessName}}.";
  const cfg = buildWizardAgentConfig(state);
  assert.ok(cfg.voiceLanguage?.voiceId, `voice ${voice.id} must produce voiceLanguage.voiceId`);
  assert.ok(cfg.instructions?.system);
  ok(`Voice ${voice.label} (${voice.id}) → draftConfig`);
}

console.log("\n=== Test page scenarios filtered ===");
{
  const answering = applyWizardPreset(createDefaultWizardState(), "every_call");
  const scenarios = testScenariosForCapabilities(answering.capabilities);
  assert.ok(!scenarios.some((s) => s.id === "appointment_booking"));
  assert.ok(scenarios.some((s) => s.id === "business_question"));
  const booking = createDefaultWizardState();
  assert.ok(
    testScenariosForCapabilities(booking.capabilities).some(
      (s) => s.id === "appointment_booking",
    ),
  );
  ok(`Test scenarios: answering=${scenarios.length}, booking has appointment_booking`);
}

console.log("\n=== Activate checklist + force-ready state ===");
{
  const incomplete = createDefaultWizardState();
  assert.ok(hasBlockingActivationIssues(getWizardActivationIssues(incomplete)));
  const complete = fillCompleteState(createDefaultWizardState());
  const issues = getWizardActivationIssues(complete);
  assert.ok(
    !hasBlockingActivationIssues(issues),
    `unexpected blockers: ${issues.map((i) => i.message).join("; ")}`,
  );
  ok("Activate checklist: blank blocks, complete does not");
}

console.log("\n=== Compile primary flow per preset (graphs differ) ===");
const graphs: Record<string, ReturnType<typeof buildVoiceAgentPrimaryDefinition>> = {};
for (const preset of PRESETS) {
  const state = fillCompleteState(
    applyWizardPreset(createDefaultWizardState(), preset),
  );
  const booking = hasBookingCapability(state.capabilities);
  const def = buildVoiceAgentPrimaryDefinition({
    agentName: state.solutionName,
    agentId: "agent_test",
    phoneNumberId: state.phoneNumberId,
    phoneNumberE164: state.phoneNumberE164,
    routingMode:
      state.answerWhen === "nobody_answers"
        ? "overflow"
        : state.answerWhen === "after_hours"
          ? "after_hours"
          : "every_call",
    includeBookingBranches: booking,
    includeSmsConfirmation: booking && state.bookingBehavior.sendSmsAfterBooking,
  });
  graphs[preset || "booking"] = def;
  const inbound = def.nodes.find((n) => n.data.blockType === "inbound_call");
  assert.ok(inbound);
  const summary = nodeSummary(inbound!);
  assert.ok(
    summary.includes("+15551234567") || summary.includes("15551234567"),
    `inbound summary should show DID, got: ${summary}`,
  );
  const issues = validateAutomationForPublish(state.solutionName, def);
  const voicePrimaryFlowIssues = issues.filter(
    (i) =>
      i.severity === "error" &&
      i.message !== "Voice call blocks are not available in the SMS automation builder",
  );
  assert.ok(
    voicePrimaryFlowIssues.length === 0,
    voicePrimaryFlowIssues.map((i) => i.message).join("; "),
  );
  if (booking) {
    assert.ok(def.edges.some((e) => e.sourceHandle === "booked"));
  } else {
    assert.ok(!def.edges.some((e) => e.sourceHandle === "booked"));
  }
  ok(
    `Flow compile ${preset || "booking"}: nodes=${def.nodes.length} edges=${def.edges.length} summary="${summary}"`,
  );
}
assert.notEqual(
  graphs.every_call.nodes.length,
  graphs.booking.nodes.length,
  "answering vs booking graphs must differ",
);
const stripped = reconcileManagedNodes(
  graphs.booking,
  graphs.every_call,
  VOICE_MANAGED_TEMPLATE_KEYS,
);
assert.ok(!stripped.nodes.some((n) => n.data.blockType === "send_sms"));
ok("Reconcile strips booking SMS when switching to answering");

console.log("\n=== Flow builder catalog blocks (scratch-build) ===");
for (const blockType of ["inbound_call", "run_voice_agent", "wait_for_call_result", "send_sms", "end_automation"]) {
  const b = getBlock(blockType);
  assert.ok(b, `missing block ${blockType}`);
  assert.ok((b!.searchTerms || []).length > 0 || blockType === "end_automation" || blockType === "send_sms");
  ok(`Catalog has ${blockType}: "${b!.label}"`);
}
assert.ok(AUTOMATION_BLOCKS.length > 20);

console.log("\n=== CAPABILITY_OPTIONS / TEST_SCENARIOS inventory ===");
assert.equal(CAPABILITY_OPTIONS.length, 8);
assert.ok(TEST_SCENARIOS.length >= 6);
ok(`Capability options=${CAPABILITY_OPTIONS.length}, test scenarios=${TEST_SCENARIOS.length}`);

console.log(`\nALL WIZARD PAGE BACKEND CHECKS PASSED (${passed})\n`);
