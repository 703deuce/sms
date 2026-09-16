#!/usr/bin/env npx tsx
import { mergeWizardStateForSave } from "../src/lib/solutions/appointment-receptionist/merge-wizard-state-on-save";
import type { AppointmentReceptionistWizardState } from "../src/lib/solutions/appointment-receptionist/types";

function base(): AppointmentReceptionistWizardState {
  return {
    agentId: "agent_test",
    capabilities: ["book_appointments", "answer_questions"],
    answerWhen: "every_call",
    solutionName: "Test",
    numberSource: "existing",
    phoneNumberId: "pn1",
    phoneNumberE164: "+15551234567",
    ringBehavior: "ai_immediate",
    ringTeamSeconds: 0,
    callRecording: "off",
    connectionGreeting: "none",
    connectionGreetingText: "",
    knowledgeSource: "guided_profile",
    websiteUrl: "",
    knowledgeItems: [],
    calendarProvider: "microsoft",
    calendarConnected: true,
    calendarEmail: null,
    appointmentTypes: [],
    selectedAppointmentTypeId: null,
    bookingStrategy: "MICROSOFT_365",
    bookingBehavior: {
      askPreferredDayFirst: true,
      offerEarliestThree: true,
      confirmBeforeBooking: true,
      sendSmsAfterBooking: false,
      askServiceFirst: true,
      distinguishNewExisting: true,
    },
    collectFields: [{ id: "name", label: "Name", required: true, enabled: true }],
    transferTriggers: [],
    transferDestinationName: "",
    transferDestinationPhone: "",
    transferRingSeconds: 30,
    transferFallback: "take_message",
    warmTransfer: false,
    detectVoicemailOnTransfer: false,
    agentName: "Amy",
    businessName: "Biz",
    role: "Receptionist",
    tone: "friendly",
    speakingStyle: "conversational",
    language: "en",
    speaksFirst: "ai",
    openingGreeting: "Hello",
    conversationBehaviors: {
      keepBrief: true,
      oneQuestionAtATime: true,
      confirmDetails: true,
      neverInventPricing: true,
      neverInventAvailability: true,
    },
    guardrails: [],
    voiceId: "v1",
    voiceLabel: "Amy",
    speakingSpeed: 1,
    responsiveness: 1,
    interruptionSensitivity: 1,
    testScenario: "appointment_booking",
    lastTestPassed: null,
    activationMode: "activate_now",
    longTermMemory: false,
    crmEnabled: false,
    timezone: "America/New_York",
  };
}

const server = base();
const staleInfo = {
  ...base(),
  businessName: "Biz UI CERT",
};

const mergedInfo = mergeWizardStateForSave(server, staleInfo, "information");
if (mergedInfo.bookingStrategy !== "MICROSOFT_365") {
  console.error("FAIL: information save must not revert bookingStrategy");
  process.exit(1);
}
if (mergedInfo.businessName !== "Biz UI CERT") {
  console.error("FAIL: information businessName must apply");
  process.exit(1);
}

const staleAppt = {
  ...base(),
  bookingStrategy: "REQUEST_ONLY" as const,
  collectFields: [
    ...server.collectFields,
    { id: "mothers_name", label: "Mother", required: false, enabled: true },
  ],
};
const mergedAppt = mergeWizardStateForSave(server, staleAppt, "appointments");
if (!mergedAppt.collectFields.some((f) => f.id === "mothers_name")) {
  console.error("FAIL: appointments collectFields must apply");
  process.exit(1);
}
console.log("test-wizard-merge-on-save: PASS");
