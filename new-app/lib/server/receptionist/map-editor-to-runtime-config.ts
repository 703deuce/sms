import type { AgentConfig } from "@/lib/agent";
import { normalizeReceptionistVoiceId } from "@/lib/voice/realtime-voices";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";

const COVERAGE_TO_ANSWER_WHEN: Record<AgentConfig["coverage"]["mode"], string> = {
  every_call: "every_call",
  after_hours: "after_hours",
  overflow: "nobody_answers",
  busy: "line_busy",
  custom: "custom_schedule",
};

const CAP_MAP: Record<string, string> = {
  answer: "answer_questions",
  book: "book_appointments",
  reschedule: "reschedule",
  cancel: "cancel",
  message: "take_messages",
  qualify: "qualify_callers",
  transfer: "transfer_calls",
  smsConfirm: "send_sms_confirmations",
};

function bookingStrategy(editor: AgentConfig): string {
  if (editor.appointments.strategy === "link") return "SEND_LINK";
  if (editor.appointments.strategy === "request") return "REQUEST_ONLY";
  if (editor.appointments.provider === "calendly") return "CALENDLY";
  if (editor.appointments.provider === "google") return "MICROSOFT_365";
  if (editor.appointments.provider === "microsoft") return "MICROSOFT_365";
  return editor.appointments.strategy === "live" ? "MICROSOFT_365" : "NONE";
}

/**
 * Maps flat new-app AgentConfig into VoiceAgentConfig + wizard snapshot for Voice V3 runtime.
 */
export function buildVoiceAgentRuntimeConfigFromEditor(
  editor: AgentConfig,
  bundle: ReceptionistPublishedBundle,
): Record<string, unknown> {
  const capabilities = Object.entries(editor.capabilities)
    .filter(([, on]) => on)
    .map(([k]) => CAP_MAP[k] || k);

  const wizard = {
    capabilities,
    answerWhen: COVERAGE_TO_ANSWER_WHEN[editor.coverage.mode] || "nobody_answers",
    solutionName: editor.identity.name,
    numberSource: editor.connection.kind === "owned" ? "connect_existing" : "forward_existing",
    phoneNumberId: editor.connection.id || null,
    phoneNumberE164: null,
    ringBehavior:
      editor.coverage.mode === "every_call"
        ? "ai_immediate"
        : editor.coverage.staffFirstSec > 0
          ? "ring_team_first"
          : "after_hours",
    ringTeamSeconds: editor.coverage.staffFirstSec || 20,
    callRecording: editor.audio.recording,
    connectionGreeting: editor.audio.connectionGreeting,
    connectionGreetingText: editor.audio.connectionGreetingText,
    knowledgeSource: "guided_profile",
    websiteUrl: "",
    knowledgeItems: [],
    calendarProvider: editor.appointments.provider,
    calendarConnected: editor.appointments.provider !== "none",
    calendarEmail: null,
    appointmentTypes: editor.appointments.types.map((t) => ({
      id: t.id,
      name: t.name,
      durationMinutes: t.duration,
      enabled: t.enabled,
      location: t.location,
      bookingPermission: t.booking === "book" ? "book_directly" : "suggest_then_confirm",
    })),
    selectedAppointmentTypeId: editor.appointments.types.find((t) => t.enabled)?.id || null,
    bookingStrategy: bookingStrategy(editor),
    bookingLinkUrl: editor.appointments.bookingLink || null,
    agentDisplayName: editor.identity.name,
    greeting: editor.identity.greeting,
    customInstructions: editor.instructions,
    voiceId: normalizeReceptionistVoiceId(
      editor.identity.customVoiceId?.trim() || editor.identity.voice,
    ),
    transfers: editor.transfers,
    intakeFields: editor.intake,
  };

  return {
    name: editor.identity.name,
    displayName: editor.identity.name,
    greeting: editor.identity.greeting,
    voice: normalizeReceptionistVoiceId(
      editor.identity.customVoiceId?.trim() || editor.identity.voice,
    ),
    advanced: {
      capabilityPack: "appointment_receptionist",
      appointmentReceptionistWizard: wizard,
    },
    newAppReceptionist: {
      schemaVersion: bundle.schemaVersion,
      publishedAt: bundle.publishedAt,
      editor,
      runtime: bundle.runtime,
    },
  };
}
