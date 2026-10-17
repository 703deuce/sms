#!/usr/bin/env npx tsx
/**
 * Voice V3 wizard compiler certification (no PSTN).
 */
import assert from "node:assert/strict";
import { buildBasicLiveSessionAcceptParams } from "../src/lib/voice-v3-basic/live-session-config";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { buildUpdateIntakeZodSchema } from "../src/lib/voice-v3/intake-objective/build-intake-tool-schema";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

function fixtureWizard(): AppointmentReceptionistWizardState {
  return {
    capabilities: [
      "answer_questions",
      "book_appointments",
      "transfer_calls",
    ],
    answerWhen: "every_call",
    solutionName: "Jessica — Main",
    numberSource: "existing",
    phoneNumberId: "pn_1",
    phoneNumberE164: "+15551234567",
    ringBehavior: "ai_immediate",
    ringTeamSeconds: 20,
    callRecording: "inbound_only",
    connectionGreeting: "none",
    connectionGreetingText: "",
    knowledgeSource: "guided_profile",
    websiteUrl: "https://example.com",
    knowledgeItems: [
      {
        id: "business",
        label: "Business details",
        summary: "Johnson Home Remodeling · Northern Virginia",
        status: "complete",
        statusLabel: "Configured",
      },
      {
        id: "hours",
        label: "Hours",
        summary: "Mon–Fri 8am–6pm, Sat 9am–2pm, closed Sunday",
        status: "complete",
        statusLabel: "Configured",
      },
    ],
    calendarProvider: "microsoft",
    calendarConnected: true,
    calendarEmail: "calendar@example.com",
    appointmentTypes: [
      {
        id: "estimate",
        name: "Free Estimate",
        durationMin: 60,
        calendar: "primary",
        status: "ready",
        enabled: true,
        requiredFields: [],
        bookingPermission: "book_directly",
      },
      {
        id: "consult",
        name: "Design Consultation",
        durationMin: 30,
        calendar: "primary",
        status: "ready",
        enabled: true,
        requiredFields: ["full_name", "phone", "email", "service"],
        bookingPermission: "book_directly",
      },
    ],
    selectedAppointmentTypeId: "consult",
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
      { id: "phone", label: "Phone", required: true, enabled: true },
      { id: "custom_project_type", label: "Project type", required: true, enabled: true },
      { id: "email", label: "Email", required: false, enabled: true },
      { id: "service", label: "Service", required: true, enabled: true },
    ],
    transferTriggers: [],
    transferDestinationName: "Sales",
    transferDestinationPhone: "+15559876543",
    transferRingSeconds: 30,
    transferFallback: "take_message",
    warmTransfer: false,
    detectVoicemailOnTransfer: false,
    transferDestinations: [
      { id: "sales", label: "Sales", phoneE164: "+15559876543", enabled: true },
    ],
    agentName: "Jessica",
    businessName: "Johnson Home Remodeling",
    role: "Appointment coordinator",
    tone: "Warm and professional",
    speakingStyle: "Brief and conversational",
    language: "English",
    speaksFirst: "ai",
    openingGreeting:
      "Thank you for calling Johnson Home Remodeling. This is Jessica. How can I help you today?",
    conversationBehaviors: {
      keepBrief: true,
      oneQuestionAtATime: true,
      confirmDetails: true,
      neverInventPricing: true,
      neverInventAvailability: true,
    },
    guardrails: ["Never discuss competitors."],
    voiceId: "coral",
    voiceLabel: "Coral",
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
  const wizard = fixtureWizard();
  const config = compileVoiceV3AgentConfig({
    wizard,
    providerConnections: {
      microsoftConnectionId: "ms_conn_test",
      microsoftCalendarIds: ["primary"],
    },
  });

  assert.equal(config.identity.agentName, "Jessica");
  assert.equal(config.businessName, "Johnson Home Remodeling");
  assert.equal(config.service.id, "consult");
  assert.equal(config.service.durationMinutes, 30);
  assert.deepEqual(config.service.requiredIntakeKeys, [
    "name",
    "phone",
    "email",
    "service_reason",
  ]);
  assert.equal(config.services.length, 2);
  assert.ok(config.intakeFields.some((f) => f.key === "project_type" && f.required));
  assert.ok(!config.intakeFields.find((f) => f.key === "email")?.required);
  assert.equal(config.telephony.liveVoiceId, "coral");
  assert.equal(config.scheduling.bookingStrategy, "MICROSOFT_365");
  assert.equal(config.calendar?.connectionId, "ms_conn_test");
  assert.ok(
    config.business.hoursDisplay?.includes("Monday") ||
      config.business.hoursDisplay?.includes("Mon"),
  );

  const prompts = buildVoiceV3Prompts({
    agentConfig: config,
    toolNames: listVoiceV3AstraToolNamesForConfig(config),
  });
  assert.ok(prompts.liveInstructions.includes("Jessica"));
  assert.ok(prompts.liveInstructions.includes("Johnson Home Remodeling"));
  assert.ok(
    prompts.liveInstructions.includes("Monday") || prompts.liveInstructions.includes("Mon–Fri"),
  );
  assert.ok(!prompts.astraInstructions.includes("Warm and professional"));

  const schema = buildUpdateIntakeZodSchema(config);
  assert.ok("project_type" in schema.shape);

  const tools = listVoiceV3AstraToolNamesForConfig(config);
  assert.ok(tools.includes("book_appointment"));
  assert.ok(tools.includes("transfer_call"));
  assert.ok(!tools.includes("cancel_appointment"));
  assert.ok(config.transfer?.enabled);
  assert.equal(config.transfer?.routing, "single");
  assert.ok(config.transfer?.destinations.some((d) => d.id === "sales"));

  const accept = buildBasicLiveSessionAcceptParams(new Date(), config);
  const session = accept.session as { audio?: { output?: { voice?: string } } };
  assert.equal(session.audio?.output?.voice, "coral");

  console.log("VOICE_V3_WIZARD_COMPILER_CERT: PASS");
}

run();
