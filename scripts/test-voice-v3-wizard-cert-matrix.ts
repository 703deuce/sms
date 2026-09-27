#!/usr/bin/env npx tsx
/**
 * End-to-end compiler certification matrix (items 1–20 from migration spec).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { attachVoiceV3WizardTestCompilation } from "../src/lib/voice-v3/config/wizard-test-compilation";
import { resolveBookingServiceForRuntime } from "../src/lib/voice-v3/config/resolve-booking-service";
import { assertWizardManifestComplete } from "../src/lib/voice-v3/config/wizard-manifest-invariant";
import { WIZARD_V3_MANIFEST_SUMMARY } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";
import { WIZARD_V3_FIELD_MANIFEST } from "../src/lib/voice-v3/config/wizard-v3-field-manifest";
import { resolveLaunchClassification } from "../src/lib/voice-v3/config/wizard-v3-runtime-launch-classification";
import { usesCfnaUnansweredIngressModel } from "../src/lib/solutions/appointment-receptionist/wizard-presets";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { isVoiceV3ToolAuthorized } from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

function richWizard(): AppointmentReceptionistWizardState {
  return {
    capabilities: ["answer_questions", "book_appointments", "transfer_calls"],
    answerWhen: "every_call",
    solutionName: "Matrix Agent",
    numberSource: "existing",
    phoneNumberId: "pn_1",
    phoneNumberE164: "+15551234567",
    ringBehavior: "ai_immediate",
    ringTeamSeconds: 20,
    callRecording: "off",
    connectionGreeting: "none",
    connectionGreetingText: "",
    knowledgeSource: "guided_profile",
    websiteUrl: "https://example.com",
    knowledgeItems: [],
    calendarProvider: "microsoft",
    calendarConnected: true,
    calendarEmail: "b@example.com",
    appointmentTypes: [
      {
        id: "long",
        name: "Long visit",
        durationMin: 90,
        calendar: "primary",
        status: "ready",
        enabled: true,
        requiredFields: [],
        bookingPermission: "book_directly",
      },
      {
        id: "short",
        name: "Short visit",
        durationMin: 30,
        calendar: "primary",
        status: "ready",
        enabled: true,
        requiredFields: [],
        bookingPermission: "book_directly",
      },
    ],
    selectedAppointmentTypeId: "short",
    bookingStrategy: "MICROSOFT_365",
    bookingBehavior: {
      askPreferredDayFirst: true,
      offerEarliestThree: true,
      confirmBeforeBooking: true,
      sendSmsAfterBooking: false,
      askServiceFirst: true,
      distinguishNewExisting: false,
    },
    collectFields: [
      { id: "full_name", label: "Name", required: true, enabled: true },
      { id: "custom_project_type", label: "Project", required: true, enabled: true },
      { id: "email", label: "Email", required: false, enabled: true },
    ],
    transferTriggers: [],
    transferDestinationName: "",
    transferDestinationPhone: "",
    transferRingSeconds: 30,
    transferFallback: "take_message",
    warmTransfer: false,
    detectVoicemailOnTransfer: false,
    transferDestinations: [{ id: "desk", label: "Front desk", phoneE164: "+15550001111", enabled: true }],
    agentName: "MatrixAmy",
    businessName: "Matrix Business",
    role: "Coordinator",
    tone: "Calm",
    speakingStyle: "Brief",
    language: "English",
    speaksFirst: "ai",
    openingGreeting: "Hello from Matrix Business, MatrixAmy speaking.",
    conversationBehaviors: {
      keepBrief: true,
      oneQuestionAtATime: true,
      confirmDetails: true,
      neverInventPricing: true,
      neverInventAvailability: true,
    },
    guardrails: [],
    voiceId: "marin",
    voiceLabel: "Marin",
    speakingSpeed: 1,
    responsiveness: 0.5,
    interruptionSensitivity: 0.5,
    testScenario: "appointment_booking",
    lastTestPassed: null,
    activationMode: "activate_now",
    longTermMemory: false,
    crmEnabled: false,
    timezone: "America/New_York",
  };
}

function run(): void {
  const wizard = richWizard();
  const config = compileVoiceV3AgentConfig({
    wizard,
    providerConnections: { microsoftConnectionId: "conn_b", microsoftCalendarIds: ["primary"] },
  });

  assert.equal(config.identity.agentName, "MatrixAmy");
  assert.ok(config.conversation.openingGreeting.includes("MatrixAmy"));
  const accept = buildBasicLiveSessionAcceptParams(new Date(), config);
  const session = accept.session as { audio?: { output?: { voice?: string } } };
  assert.equal(session.audio?.output?.voice, "marin");
  assert.equal(config.businessName, "Matrix Business");
  assert.ok(config.business.hoursDisplay || config.businessHours);
  assert.equal(config.services.length, 2);
  const ctx = createInitialVoiceV3CallContext({
    callId: "c1",
    liveSessionId: "live_1",
    timezone: config.timezone,
    clock: { nowUtc: new Date(), businessLocal: { date: "2026-01-01", time: "12:00", weekday: 3 } },
    now: new Date(),
  });
  ctx.intake.values.booking_service_id = { value: "long", source: "caller", confidence: "high" };
  const longService = resolveBookingServiceForRuntime(config, ctx);
  assert.equal(longService.durationMinutes, 90);

  assert.ok(config.intakeFields.some((f) => f.key === "project_type" && f.required));
  assert.ok(!config.intakeFields.find((f) => f.key === "email")?.required);
  assert.ok(!isVoiceV3ToolAuthorized(config, "cancel_appointment"));
  assert.ok(config.transferDestinations?.some((d) => d.id === "desk"));
  assert.equal(config.calendar?.connectionId, "conn_b");

  const envOnly = compileVoiceV3AgentConfig({
    wizard: { ...wizard, agentName: "", businessName: "" },
    envFallback: VOICE_V3_BOOKING_AGENT_CONFIG,
  });
  assert.equal(envOnly.identity.agentName, VOICE_V3_BOOKING_AGENT_CONFIG.identity.agentName);

  const draftConfig: VoiceAgentConfig = {
    name: "x",
    advanced: { capabilityPack: "appointment_receptionist", appointmentReceptionistWizard: wizard },
  } as VoiceAgentConfig;
  const withProbe = attachVoiceV3WizardTestCompilation(draftConfig);
  const probe = (withProbe.advanced as Record<string, unknown>).voiceV3WizardTestCompilation as {
    source: string;
  };
  assert.equal(probe.source, "wizard_draft_test");

  const republished = compileVoiceV3AgentConfig({
    wizard: { ...wizard, openingGreeting: "Updated greeting." },
  });
  assert.notEqual(config.configVersion, republished.configVersion);

  assertWizardManifestComplete();
  assert.equal(WIZARD_V3_MANIFEST_SUMMARY.unmapped, 0);
  assert.equal(
    WIZARD_V3_MANIFEST_SUMMARY.DEFERRED_NOT_EXPOSED,
    4,
    "CFNA launch hides four ingress/AMD controls as DEFERRED_NOT_EXPOSED",
  );

  const deferredPaths = WIZARD_V3_FIELD_MANIFEST.filter(
    (r) => r.executionStatus === "DEFERRED_NOT_EXPOSED",
  ).map((r) => r.statePath);
  assert.ok(usesCfnaUnansweredIngressModel("after_hours"));
  for (const statePath of deferredPaths) {
    const launch = resolveLaunchClassification(statePath, "DEFERRED_NOT_EXPOSED");
    assert.equal(
      launch.classification,
      "DEFERRED_NOT_EXPOSED",
      `${statePath} must stay deferred for CFNA after_hours`,
    );
  }

  const prompts = buildVoiceV3Prompts({
    agentConfig: config,
    toolNames: listVoiceV3AstraToolNamesForConfig(config),
  });
  assert.ok(prompts.liveInstructions.includes("MatrixAmy"));

  console.log("VOICE_V3_WIZARD_CERT_MATRIX: PASS");
}

run();
