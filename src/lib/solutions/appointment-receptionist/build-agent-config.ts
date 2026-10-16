import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { DEFAULT_CONNECTION_GREETING } from "./defaults";
import type { AppointmentReceptionistWizardState } from "./types";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
  WIZARD_HANDOFF_NAME,
} from "./transfer-utils";
import { resolveWizardRoutingMode } from "./routing-mode";
import { compileVoiceAgentPromptFromWizard } from "@/lib/voice/prompt/compile-voice-agent-prompt";
import { buildBusinessKnowledgePromptSection } from "@/lib/voice/prompt/build-business-context";
import { applyAmyMinimumSideEffectConfig } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import { buildDefaultOutboundSmsMessaging } from "@/lib/voice/sms/voice-outbound-sms-config";
import { mergeAppointmentWizardAdvanced } from "./wizard-advanced-bridge";
import { ensureWizardOperatingMaturity } from "./operating-maturity-wizard";
import { recompileReceptionistFromDraft } from "@/lib/voice/receptionist/recompile";
import {
  elevenLabsVoiceLanguagePublishFields,
  resolveVoiceV2WizardVoiceForPublish,
} from "./voice-v2-wizard-elevenlabs-catalog";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import { normalizeWizardVoiceToRealtime } from "@/lib/voice/realtime-voice-picker";

export { buildBusinessKnowledgePromptSection };

const KNOWLEDGE_FALLBACK_PHRASE =
  "Answer hours, services, pricing ranges, policies, and FAQs directly from the Business knowledge section below — do not call any tool for those topics. " +
  "Use the document retrieval tool only when the caller asks about material from an uploaded PDF or document that is not covered below. " +
  "If the answer is not in the Business knowledge section and no uploaded document applies, say you do not have that information and use the configured fallback — never invent pricing, policy, technical advice, or promises.";

const DEFAULT_RECORDING_DISCLOSURE =
  "This call may be recorded for quality and training purposes.";

function interpolateGreeting(state: AppointmentReceptionistWizardState) {
  const business = state.businessName.trim() || "our office";
  const agent = state.agentName.trim() || "your receptionist";
  return state.openingGreeting
    .replaceAll("{{businessName}}", business)
    .replaceAll("{{agentName}}", agent);
}

/** Map wizard language labels / locales to BCP-47 + STT language codes. */
export function mapWizardLanguage(language: string): {
  primaryLanguage: string;
  transcriptionLanguage: string;
} {
  const raw = (language || "English").trim();
  const lower = raw.toLowerCase();
  if (lower === "spanish" || lower.startsWith("es")) {
    return { primaryLanguage: "es-ES", transcriptionLanguage: "es" };
  }
  if (lower === "french" || lower.startsWith("fr")) {
    return { primaryLanguage: "fr-FR", transcriptionLanguage: "fr" };
  }
  if (lower === "english" || lower.startsWith("en")) {
    return { primaryLanguage: "en-US", transcriptionLanguage: "en" };
  }
  if (raw.includes("-")) {
    return {
      primaryLanguage: raw,
      transcriptionLanguage: lower.split("-")[0] || "en",
    };
  }
  return { primaryLanguage: "en-US", transcriptionLanguage: "en" };
}

function mapResponsivenessLevel(value: number): "high" | "medium" | "low" {
  if (value >= 0.7) return "high";
  if (value >= 0.4) return "medium";
  return "low";
}

/** Higher responsiveness → shorter silence before the agent continues. */
function silenceTimeoutFromResponsiveness(responsiveness: number): number {
  const clamped = Math.max(0, Math.min(1, responsiveness));
  return Math.round(3500 - clamped * 2000);
}

function buildTranscriptionKeyterms(state: AppointmentReceptionistWizardState): string[] {
  const transferName = wizardTransferDestinationName(state.transferDestinationName);
  const terms = [
    state.businessName?.trim(),
    state.agentName?.trim(),
    transferName,
    ...state.appointmentTypes.filter((t) => t.enabled).map((t) => t.name?.trim()),
  ].filter((t): t is string => Boolean(t && t.length > 1));
  return [...new Set(terms)].slice(0, 50);
}

export function buildSystemPrompt(state: AppointmentReceptionistWizardState): string {
  return compileVoiceAgentPromptFromWizard(state);
}

/** Legacy monolithic prompt — retained for reference and tests. */
export function buildSystemPromptLegacy(state: AppointmentReceptionistWizardState): string {
  const caps = state.capabilities;
  const transferName = wizardTransferDestinationName(state.transferDestinationName);
  const transferPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  const lines: string[] = [];
  lines.push(
    `You are ${state.agentName || "Amy"}, a ${state.role || "appointment booking agent"} for ${state.businessName || "the business"}.`,
  );
  lines.push(`Tone: ${state.tone}. Speaking style: ${state.speakingStyle}.`);
  lines.push(`Primary language: ${state.language}.`);
  lines.push("");
  lines.push("Date and time (do not invent a calendar):");
  lines.push(`- Business timezone: {{business_timezone}}`);
  lines.push(
    "- When the caller uses relative timing (today, tomorrow, this Friday, in three hours, next week, before closing), call resolve_datetime with their phrase. Do not invent today's date or guess the weekday.",
  );
  lines.push(
    "- You may keep the conversation moving while resolve_datetime runs; use its result before offering slots or booking.",
  );
  lines.push(
    "- Before booking, repeat the full date, day of week, time, and timezone. Never book based only on an ambiguous phrase such as \"Friday at five.\"",
  );
  lines.push("");
  lines.push("Goals:");
  if (caps.includes("answer_questions")) {
    lines.push(
      "- Answer common business questions directly from the Business knowledge section below. Do not call tools for hours, services, pricing, or FAQs that are already listed there.",
    );
  }
  if (caps.includes("book_appointments")) {
    lines.push("- Help callers book appointments when the runtime permits scheduling tools.");
  }
  if (caps.includes("reschedule")) lines.push("- Help callers reschedule existing appointments.");
  if (caps.includes("cancel")) lines.push("- Help callers cancel appointments when allowed.");
  if (caps.includes("take_messages")) {
    lines.push("- Take and save a clear message when a person is unavailable or the caller wants a callback.");
  } else {
    lines.push(
      "- Always be able to take and save a message (take_structured_message) if booking or transfer cannot complete.",
    );
  }
  if (caps.includes("qualify_callers")) lines.push("- Qualify new callers before booking or transfer.");
  if (state.bookingBehavior.distinguishNewExisting) {
    lines.push(
      "- Ask whether the caller is new or an existing patient/client before booking, and tailor questions accordingly.",
    );
  }
  if (caps.includes("transfer_calls") && transferPhone) {
    lines.push(
      `- Transfer to ${transferName} when transfer rules apply (use the escalate_human tool).`,
    );
  }
  if (caps.includes("send_sms_confirmations") || state.bookingBehavior.sendSmsAfterBooking) {
    lines.push("- Send SMS confirmations after a successful booking when configured.");
  }
  lines.push("");
  lines.push("Tools — use runtime context for which tools are permitted each turn:");
  lines.push(
    "- record_current_field: preferred when collecting the active field — pass only { value }.",
  );
  lines.push(
    "- save_collected_fields: when saving multiple fields by field_id from get_runtime_context.",
  );
  lines.push(
    "- get_runtime_context / get_workflow_requirements: check workflow_state, allowed_tools, and missing fields.",
  );
  lines.push(
    "- take_structured_message: when taking a message or callback — call with caller_name, phone, reason, and urgency.",
  );
  lines.push(
    "- lookup_customer: look up an existing contact by phone when helpful.",
  );
  if (caps.includes("book_appointments")) {
    lines.push(
      "- Scheduling tools (resolve_datetime, calendar_availability, hold_appointment_slot, book_appointment): USE ONLY when workflow_state and allowed_tools permit them. Never call during COLLECTING_FIELDS.",
    );
    lines.push(
      "- Never offer, confirm, or book a time unless startsAt came from calendar_availability slots returned while runtime permitted scheduling.",
    );
    lines.push(
      "- If book_appointment times out, you may retry the same startsAt once. If it returns alreadyBooked=true or ok=true, tell the caller they are confirmed.",
    );
  }
  if (caps.includes("transfer_calls") && transferPhone) {
    lines.push(
      `- escalate_human: to transfer, call once with target_name exactly "${transferName}" (or "${WIZARD_HANDOFF_NAME}"). Never invent a phone number — the destination is already configured.`,
    );
  }
  lines.push("- hangup / end_call: only after a clear goodbye when the conversation is finished.");
  lines.push("");
  lines.push("Booking conversation rules (runtime determines when each step is allowed):");
  if (state.bookingBehavior.askServiceFirst) {
    lines.push("- Ask what service the caller needs when collecting fields.");
  }
  if (state.bookingBehavior.askPreferredDayFirst) {
    lines.push("- Ask for a preferred day or general time window before offering slots.");
  }
  if (state.bookingBehavior.offerEarliestThree) {
    lines.push("- Offer the earliest three valid appointments when appropriate.");
  } else {
    lines.push("- Offer two or three valid options that match the caller's preference.");
  }
  if (state.bookingBehavior.confirmBeforeBooking) {
    lines.push(
      '- Before booking, confirm details out loud (e.g. "I have you scheduled for Tuesday at 10:30 a.m. for an initial consultation. Is that correct?").',
    );
    lines.push("- Only call the booking tool after the caller confirms.");
  }
  lines.push("- Never claim an appointment is booked until the booking tool succeeds.");
  lines.push("- Never invent availability or pricing.");
  lines.push(
    "- When booking is permitted, pass book_appointment startsAt exactly as returned by calendar_availability (ISO).",
  );
  lines.push("");
  lines.push(
    "Field collection is runtime-driven — use get_runtime_context for fields_to_collect and missing_fields. Do not use a fixed field order from this prompt.",
  );
  lines.push(
    "- Prefer record_current_field({ value }) for the active field. Use save_collected_fields for multiple fields.",
  );
  lines.push("");
  if (caps.includes("transfer_calls") && transferPhone) {
    lines.push("Transfer when:");
    for (const t of state.transferTriggers) lines.push(`- ${t}`);
    lines.push(
      `Destination: ${transferName}. On failed transfer: ${state.transferFallback.replaceAll("_", " ")}. Prefer take_structured_message if the transfer tool returns ok=false.`,
    );
  } else if (caps.includes("transfer_calls") && !transferPhone) {
    lines.push(
      "Transfer is requested but no destination phone is configured — take a structured message instead of inventing a number.",
    );
  }
  lines.push("");
  lines.push("Conversation behavior:");
  lines.push("- Keep answers brief.");
  lines.push("- Ask one question at a time.");
  lines.push("- Confirm names, numbers, dates, and addresses.");
  lines.push("- Never invent pricing.");
  lines.push("- Never invent availability.");
  lines.push(
    "- Use the Business knowledge section for hours, pricing, services, policies, and FAQs — answer in your own words without calling tools.",
  );
  lines.push("- Use scheduling tools only when workflow_state and allowed_tools permit them.");
  lines.push(`- ${KNOWLEDGE_FALLBACK_PHRASE}`);
  lines.push("");
  lines.push("Guardrails:");
  for (const g of state.guardrails) lines.push(`- ${g}`);
  lines.push(`- ${KNOWLEDGE_FALLBACK_PHRASE}`);

  const knowledgeBlock = buildBusinessKnowledgePromptSection(state);
  if (knowledgeBlock) {
    lines.push("");
    lines.push("Business knowledge:");
    lines.push(knowledgeBlock);
  }

  return lines.join("\n");
}

export function buildWizardAgentConfig(
  state: AppointmentReceptionistWizardState,
): VoiceAgentConfig {
  const base = parseVoiceAgentConfig(null);
  const greeting = interpolateGreeting(state);
  const connectionMode = state.connectionGreeting;
  const transferName = wizardTransferDestinationName(state.transferDestinationName);
  const transferPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  const canTransfer =
    state.capabilities.includes("transfer_calls") && Boolean(transferPhone);
  const customAudioUrl = (state.connectionGreetingAudioUrl || "").trim();

  const startupGreeting =
    connectionMode === "none"
      ? {
          enabled: false,
          mode: "ai" as const,
          text: "",
          audioUrl: "",
          delayMs: "auto" as const,
          handOffWhenReady: true,
        }
      : connectionMode === "upload_custom" && customAudioUrl
        ? {
            enabled: true,
            mode: "audio_url" as const,
            text: state.connectionGreetingText || DEFAULT_CONNECTION_GREETING,
            audioUrl: customAudioUrl,
            delayMs: 500 as const,
            handOffWhenReady: true,
          }
      : connectionMode === "transovo_professional" || connectionMode === "transovo_warm"
        ? {
            enabled: true,
            mode: "transovo_default" as const,
            text: state.connectionGreetingText || DEFAULT_CONNECTION_GREETING,
            audioUrl: "",
            delayMs: 500 as const,
            handOffWhenReady: true,
          }
        : {
            // create_custom (and upload_custom without URL) — TTS mask before AI.
            enabled: true,
            mode: "tts" as const,
            text: state.connectionGreetingText || DEFAULT_CONNECTION_GREETING,
            audioUrl: customAudioUrl,
            delayMs: "auto" as const,
            handOffWhenReady: true,
          };

  const enabledTools = new Set([
    "hangup",
    "end_call",
    "take_structured_message",
    "save_caller_info",
    "create_task",
    "mark_disposition",
    "lookup_customer",
  ]);
  if (canTransfer) {
    enabledTools.add("transfer");
    enabledTools.add("escalate_human");
  }
  if (state.capabilities.includes("book_appointments")) {
    enabledTools.add("resolve_datetime");
    enabledTools.add("calendar_availability");
    enabledTools.add("hold_appointment_slot");
    enabledTools.add("release_appointment_hold");
    enabledTools.add("book_appointment");
    enabledTools.add("find_appointments");
  }
  if (
    state.capabilities.includes("reschedule") ||
    state.capabilities.includes("book_appointments")
  ) {
    enabledTools.add("reschedule_appointment");
    enabledTools.add("find_appointments");
  }
  if (state.capabilities.includes("cancel")) {
    enabledTools.add("cancel_appointment");
    enabledTools.add("find_appointments");
  }
  if (
    state.capabilities.includes("send_sms_confirmations") ||
    state.bookingBehavior.sendSmsAfterBooking
  ) {
    enabledTools.add("send_sms");
  }
  // Always enable CRM notes with message taking for receptionist; crmEnabled adds full CRM set.
  enabledTools.add("create_crm_note");
  if (state.crmEnabled) {
    enabledTools.add("search_crm_contacts");
    enabledTools.add("upsert_crm_contact");
    enabledTools.add("create_crm_task");
  }

  const ringMode = resolveWizardRoutingMode({
    answerWhen: state.answerWhen,
    ringBehavior: state.ringBehavior,
  });

  const transferTargets = transferPhone
    ? [
        { name: transferName, to: transferPhone },
        ...(transferName !== WIZARD_HANDOFF_NAME
          ? [{ name: WIZARD_HANDOFF_NAME, to: transferPhone }]
          : []),
        { name: "Front Desk", to: transferPhone },
      ]
    : [];

  const lang = mapWizardLanguage(state.language);
  const responsivenessLevel = mapResponsivenessLevel(state.responsiveness);
  const interruptionLevel = mapResponsivenessLevel(state.interruptionSensitivity);
  const silenceTimeoutMs = silenceTimeoutFromResponsiveness(state.responsiveness);
  const keyterms = buildTranscriptionKeyterms(state);
  const recordingOn = state.callRecording !== "off";
  const bookingStrategy = deriveBookingStrategyFromWizard(state);
  const useOpenAiRealtimeTelnyxTransport =
    bookingStrategy === "MICROSOFT_365" ||
    bookingStrategy === "CALENDLY" ||
    bookingStrategy === "SEND_LINK";

  const draft = applyAmyMinimumSideEffectConfig({
    ...base,
    identity: {
      ...base.identity,
      displayName: state.agentName,
      businessLocation: state.businessName,
      directions: ["inbound"],
    },
    instructions: {
      ...base.instructions,
      system: buildSystemPrompt(state),
      role: state.role,
      goals: state.capabilities.join(", "),
      tone: state.tone,
      style: state.speakingStyle,
      responseLength: "short",
      prohibited: state.guardrails,
      confirmation: state.bookingBehavior.confirmBeforeBooking
        ? "Confirm appointment details before booking."
        : undefined,
      escalation: canTransfer
        ? `If the caller asks for a person, use escalate_human with target_name "${transferName}". Never invent a phone number.`
        : "Offer to take a structured message if the caller asks for a person and no transfer destination is configured.",
      uncertainty:
        "If business knowledge, enabled tools, or confirmed intake do not establish the answer, do not invent pricing, policy, technical advice, availability, or promises. Say you do not have that information and use the configured fallback (message, callback, transfer, or booking link).",
      protectedGreeting: true,
    },
    voiceLanguage: {
      ...base.voiceLanguage,
      ...(useOpenAiRealtimeTelnyxTransport
        ? {
            voiceId: normalizeWizardVoiceToRealtime(state.voiceId),
            speed: state.speakingSpeed ?? base.voiceLanguage?.speed,
          }
        : elevenLabsVoiceLanguagePublishFields(
            resolveVoiceV2WizardVoiceForPublish(state.voiceId),
          )),
      speed: state.speakingSpeed ?? base.voiceLanguage?.speed,
      responsiveness: responsivenessLevel,
      interruptionHandling: interruptionLevel,
      silenceTimeoutMs,
      // Higher interruption sensitivity → shorter endpointing wait.
      endpointingMs: Math.round(450 - state.interruptionSensitivity * 250),
      primaryLanguage: lang.primaryLanguage,
      bargeIn: state.interruptionSensitivity >= 0.3,
    },
    transcription: useOpenAiRealtimeTelnyxTransport
      ? {
          ...base.transcription,
          enabled: false,
          sttProvider: undefined,
          sttModel: undefined,
          language: lang.transcriptionLanguage,
          keyterms: undefined,
          settings: undefined,
        }
      : {
          ...base.transcription,
          enabled: true,
          sttProvider: "deepgram",
          sttModel: "deepgram/nova-3",
          language: lang.transcriptionLanguage,
          keyterms,
        },
    callHandling: {
      ...(base.callHandling || {}),
      greeting,
      speaksFirst: state.speaksFirst,
      closingStatement: "Thanks for calling. Goodbye.",
      startupGreeting,
      answerMode:
        ringMode === "human_first" || ringMode === "custom_schedule"
          ? "ring_team_first"
          : ringMode === "ai_after_hours"
            ? "after_hours"
            : ringMode === "overflow"
              ? "overflow"
              : "ai_immediate",
      ringTeamSeconds: state.ringTeamSeconds,
      callRecording: state.callRecording,
      solutionSlug: "appointment-assistant",
      wizardVersion: 1,
    },
    compliance: {
      ...(base.compliance || {}),
      recordingDisclosure: false,
    },
    transfers: {
      ...(base.transfers || {}),
      enabled: canTransfer,
      triggers: state.transferTriggers,
      destinationName: transferName,
      destinationPhone: transferPhone || state.transferDestinationPhone || "",
      ringSeconds: state.transferRingSeconds,
      fallback: state.transferFallback,
      announce: true,
      // Honor wizard warm-transfer preference (cold by default — warm hold tears down AI mid-call).
      warmTransfer: Boolean(state.warmTransfer),
      warmTransferInstructions: state.warmTransfer
        ? "Briefly introduce the caller and reason for transfer before connecting."
        : "",
      detectVoicemailOnTransfer: Boolean(state.detectVoicemailOnTransfer),
      targets: transferTargets,
    },
    messaging: {
      ...(base.messaging || {}),
      smsConfirmations:
        state.bookingBehavior.sendSmsAfterBooking ||
        state.capabilities.includes("send_sms_confirmations"),
      ...buildDefaultOutboundSmsMessaging({
        voiceInboundE164: state.phoneNumberE164,
        dedicatedPhoneNumberId: state.outboundSmsPhoneNumberId ?? null,
        dedicatedE164: state.outboundSmsE164 ?? null,
      }),
    },
    conversationFlow: {
      sections: [
        { id: "greeting", type: "greeting", label: "Greeting", enabled: true },
        {
          id: "intent",
          type: "intent",
          label: "Understand request",
          enabled: true,
        },
        {
          id: "booking",
          type: "booking",
          label: "Book appointment",
          enabled: state.capabilities.includes("book_appointments"),
          config: {
            appointmentTypes: state.appointmentTypes.filter((t) => t.enabled),
            bookingBehavior: state.bookingBehavior,
            collectFields: state.collectFields,
          },
        },
        {
          id: "knowledge",
          type: "knowledge",
          label: "Answer questions",
          enabled: state.capabilities.includes("answer_questions"),
        },
        {
          id: "message_taking",
          type: "message_taking",
          label: "Take message",
          enabled: true,
        },
        {
          id: "transfer",
          type: "transfer",
          label: "Human transfer",
          enabled: canTransfer,
        },
        {
          id: "sms",
          type: "sms_followup",
          label: "SMS confirmation",
          enabled: state.bookingBehavior.sendSmsAfterBooking,
        },
        { id: "end", type: "ending", label: "End call", enabled: true },
      ],
    },
    enabledBuiltinTools: Array.from(enabledTools),
    knowledgeBaseIds: base.knowledgeBaseIds || [],
    dynamicVariables: {
      business_name: state.businessName || state.solutionName,
      agent_name: state.agentName || "Amy",
      agent_role: state.role || "front-desk receptionist",
      solution_name: state.solutionName,
      timezone: state.timezone || "America/New_York",
      // Static — safe at publish time. Live clock comes from resolve_datetime,
      // not from call-start dynvars (avoids delaying first speech).
      business_timezone: state.timezone || "America/New_York",
      transfer_destination_name: transferName,
      phone_number: state.phoneNumberE164 || "",
    },
    postCall: {
      ...(base.postCall || {}),
      extractionFields: [
        "caller_name",
        "caller_phone",
        "intent",
        "service_requested",
        "appointment_booked",
        "appointment_time",
        "message_taken",
        "message_reason",
        "transfer_attempted",
        "transfer_successful",
        "follow_up_required",
        "urgency",
        "sentiment",
        "outcome",
      ],
      scoringRules: base.postCall?.scoringRules,
    },
    advanced: mergeAppointmentWizardAdvanced(state, {
      ...(base.advanced || {}),
      voiceV2OperatingMaturity: ensureWizardOperatingMaturity(state),
      appointmentReceptionistWizard: {
        // Full wizard snapshot so scheduled promote can re-run activate hooks.
        ...state,
        solutionName: state.solutionName,
        phoneNumberId: state.phoneNumberId,
        phoneNumberE164: state.phoneNumberE164,
        agentName: state.agentName,
        voiceId: state.voiceId,
        openingGreeting: state.openingGreeting,
        businessName: state.businessName,
        capabilities: state.capabilities,
        transferDestinationPhone: state.transferDestinationPhone,
        transferDestinationName: state.transferDestinationName,
        calendarConnected: state.calendarConnected,
        calendarProvider: state.calendarProvider,
        appointmentTypes: state.appointmentTypes,
        activationMode: state.activationMode,
        scheduledAt: state.scheduledAt || null,
        lastTestPassed: state.lastTestPassed,
      },
      ...(state.longTermMemory
        ? {
            memory: {
              enabled: true,
              mode: "caller",
              retentionDays: 30,
            },
          }
        : {
            memory: {
              enabled: false,
              mode: "none",
            },
          }),
      voiceArchitectureVersion: "telnyx-production-v1",
    }),
  });

  return recompileReceptionistFromDraft(draft);
}

