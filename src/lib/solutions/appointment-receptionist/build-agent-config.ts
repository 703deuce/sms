import type { VoiceAgentConfig } from "@/lib/voice/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { DEFAULT_CONNECTION_GREETING } from "./defaults";
import type { AppointmentReceptionistWizardState } from "./types";
import {
  normalizeWizardTransferPhone,
  wizardTransferDestinationName,
  WIZARD_HANDOFF_NAME,
} from "./sync-transfer";

function interpolateGreeting(state: AppointmentReceptionistWizardState) {
  const business = state.businessName.trim() || "our office";
  const agent = state.agentName.trim() || "your receptionist";
  return state.openingGreeting
    .replaceAll("{{businessName}}", business)
    .replaceAll("{{agentName}}", agent);
}

export function buildSystemPrompt(state: AppointmentReceptionistWizardState): string {
  const caps = state.capabilities;
  const transferName = wizardTransferDestinationName(state.transferDestinationName);
  const transferPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  const lines: string[] = [];
  lines.push(
    `You are ${state.agentName || "Maya"}, a ${state.role || "front-desk receptionist"} for ${state.businessName || "the business"}.`,
  );
  lines.push(`Tone: ${state.tone}. Speaking style: ${state.speakingStyle}.`);
  lines.push(`Primary language: ${state.language}.`);
  lines.push("");
  lines.push("Goals:");
  if (caps.includes("answer_questions")) {
    lines.push("- Answer common business questions using the knowledge base only.");
  }
  if (caps.includes("book_appointments")) {
    lines.push("- Help callers book appointments using live calendar tools.");
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
  if (caps.includes("transfer_calls") && transferPhone) {
    lines.push(
      `- Transfer to ${transferName} when transfer rules apply (use the escalate_human tool).`,
    );
  }
  if (caps.includes("send_sms_confirmations") || state.bookingBehavior.sendSmsAfterBooking) {
    lines.push("- Send SMS confirmations after a successful booking when configured.");
  }
  lines.push("");
  lines.push("Tools — you MUST use these; never claim you cannot save or transfer:");
  lines.push(
    "- save_caller_info: when the caller gives name, phone, email, or company — call this tool to store it. Confirm after the tool succeeds.",
  );
  lines.push(
    "- take_structured_message: when taking a message or callback — call this tool with caller_name, phone, reason, and urgency. Confirm after it succeeds.",
  );
  lines.push(
    "- lookup_customer: look up an existing contact by phone before booking when helpful.",
  );
  if (caps.includes("book_appointments")) {
    lines.push("- calendar_availability / book_appointment: check live availability and book only after confirmation.");
  }
  if (caps.includes("transfer_calls") && transferPhone) {
    lines.push(
      `- escalate_human: to transfer, call once with target_name exactly "${transferName}" (or "${WIZARD_HANDOFF_NAME}"). Never invent a phone number — the destination is already configured.`,
    );
  }
  lines.push("- hangup / end_call: only after a clear goodbye when the conversation is finished.");
  lines.push("");
  lines.push("Booking conversation rules:");
  if (state.bookingBehavior.askServiceFirst) {
    lines.push("- Ask what service the caller needs before checking the calendar.");
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
  lines.push("");
  lines.push("Collect caller information in this order when needed:");
  for (const field of state.collectFields.filter((f) => f.enabled)) {
    lines.push(`- ${field.label}${field.required ? " (required)" : " (optional)"}`);
  }
  lines.push(
    "- As soon as you have a phone number (or the caller confirms the caller ID), call save_caller_info. Do not say you have no way to save information.",
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
  const b = state.conversationBehaviors;
  if (b.keepBrief) lines.push("- Keep answers brief.");
  if (b.oneQuestionAtATime) lines.push("- Ask one question at a time.");
  if (b.confirmDetails) lines.push("- Confirm names, numbers, dates, and addresses.");
  if (b.neverInventPricing) lines.push("- Never invent pricing.");
  if (b.neverInventAvailability) lines.push("- Never invent availability.");
  lines.push("- Use the knowledge base for business facts.");
  lines.push("- Use calendar tools for availability.");
  lines.push("");
  lines.push("Guardrails:");
  for (const g of state.guardrails) lines.push(`- ${g}`);
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
            enabled: true,
            mode: "ai" as const,
            text: state.connectionGreetingText || DEFAULT_CONNECTION_GREETING,
            audioUrl: "",
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
    enabledTools.add("calendar_availability");
    enabledTools.add("book_appointment");
  }
  if (state.capabilities.includes("reschedule")) {
    enabledTools.add("reschedule_appointment");
  }
  if (state.capabilities.includes("cancel")) {
    enabledTools.add("cancel_appointment");
  }
  if (
    state.capabilities.includes("send_sms_confirmations") ||
    state.bookingBehavior.sendSmsAfterBooking
  ) {
    enabledTools.add("send_sms");
  }

  const ringHumanFirst =
    state.answerWhen === "nobody_answers" || state.ringBehavior === "ring_team_first";

  const transferTargets = transferPhone
    ? [
        { name: transferName, to: transferPhone },
        ...(transferName !== WIZARD_HANDOFF_NAME
          ? [{ name: WIZARD_HANDOFF_NAME, to: transferPhone }]
          : []),
        { name: "Front Desk", to: transferPhone },
      ]
    : [];

  return {
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
      responseLength: state.conversationBehaviors.keepBrief ? "short" : "medium",
      prohibited: state.guardrails,
      confirmation: state.bookingBehavior.confirmBeforeBooking
        ? "Confirm appointment details before booking."
        : undefined,
      escalation: canTransfer
        ? `If the caller asks for a person, use escalate_human with target_name "${transferName}". Never invent a phone number.`
        : "Offer to take a structured message if the caller asks for a person and no transfer destination is configured.",
      uncertainty:
        "If unsure, ask a clarifying question or take a structured message with take_structured_message.",
      protectedGreeting: true,
    },
    voiceLanguage: {
      ...base.voiceLanguage,
      voiceId: state.voiceId,
      voiceProvider: "telnyx",
      speed: state.speakingSpeed,
      responsiveness:
        state.responsiveness >= 0.7 ? "high" : state.responsiveness >= 0.4 ? "medium" : "low",
      interruptionHandling:
        state.interruptionSensitivity >= 0.7
          ? "high"
          : state.interruptionSensitivity >= 0.4
            ? "medium"
            : "low",
      primaryLanguage: state.language.toLowerCase().startsWith("en") ? "en-US" : "en-US",
      bargeIn: true,
    },
    callHandling: {
      ...(base.callHandling || {}),
      greeting,
      speaksFirst: state.speaksFirst,
      closingStatement: "Thanks for calling. Goodbye.",
      startupGreeting,
      answerMode: ringHumanFirst ? "ring_team_first" : "ai_immediate",
      ringTeamSeconds: state.ringTeamSeconds,
      callRecording: state.callRecording,
      solutionSlug: "appointment-assistant",
      wizardVersion: 1,
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
      // Cold Call Control path — warm hold tears down AI mid-call.
      warmTransfer: false,
      warmTransferInstructions: "",
      targets: transferTargets,
    },
    messaging: {
      ...(base.messaging || {}),
      smsConfirmations: state.bookingBehavior.sendSmsAfterBooking,
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
      agent_name: state.agentName || "Maya",
      agent_role: state.role || "front-desk receptionist",
      solution_name: state.solutionName,
      timezone: state.timezone || "America/New_York",
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
    advanced: {
      ...(base.advanced || {}),
      appointmentReceptionistWizard: {
        solutionName: state.solutionName,
        answerWhen: state.answerWhen,
        knowledgeSource: state.knowledgeSource,
        websiteUrl: state.websiteUrl,
        calendarProvider: state.calendarProvider,
        timezone: state.timezone,
        collectFields: state.collectFields,
        appointmentTypes: state.appointmentTypes.filter((t) => t.enabled),
      },
      capabilityPack: "appointment_receptionist",
    },
  };
}

export function buildReceptionistWillList(state: AppointmentReceptionistWizardState): string[] {
  const phone = state.phoneNumberE164 || "your assigned number";
  const items = [
    `Answer incoming calls on ${phone}`,
    `Greet the caller as ${state.agentName || "Maya"}${state.businessName ? ` from ${state.businessName}` : ""}`,
  ];
  if (state.capabilities.includes("answer_questions")) {
    items.push("Answer questions using your business knowledge base");
  }
  if (state.bookingBehavior.askServiceFirst) {
    items.push("Ask what service the caller needs");
  }
  const fields = state.collectFields
    .filter((f) => f.enabled && f.required)
    .map((f) => f.label.toLowerCase());
  if (fields.length) {
    items.push(`Collect ${fields.join(", ")}`);
  }
  items.push("Save caller details with save_caller_info");
  if (state.capabilities.includes("book_appointments")) {
    items.push("Check your calendar for availability");
    items.push(
      state.bookingBehavior.offerEarliestThree
        ? "Offer the earliest three matching appointments"
        : "Offer two or three matching appointments",
    );
    if (state.bookingBehavior.confirmBeforeBooking) {
      items.push("Confirm the caller's selection before booking");
    }
    items.push("Book the appointment");
  }
  if (state.bookingBehavior.sendSmsAfterBooking) {
    items.push("Send an SMS confirmation");
  }
  if (
    state.capabilities.includes("transfer_calls") &&
    normalizeWizardTransferPhone(state.transferDestinationPhone)
  ) {
    const name = wizardTransferDestinationName(state.transferDestinationName);
    items.push(`Transfer urgent or frustrated callers to ${name}`);
    items.push(`Take a message if ${name} does not answer`);
  }
  return items;
}
