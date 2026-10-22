import type { AgentConfig } from "@/lib/agent";
import type {
  IntakeFieldDefinition,
  VoiceV3AgentConfig,
} from "@/lib/server/voice-v3/config/agent-config";
import type { VoiceWizardBookingStrategy } from "@/lib/server/voice-v3/config/booking-strategies";
import {
  DEFAULT_V3_BOOKING_STRATEGY,
  defaultNestedFromFlat,
  mergeNestedConfig,
} from "@/lib/server/voice-v3/config/default-nested-config";
import { compileVoiceV3TransferPolicyFromEditor } from "@/lib/server/receptionist/compile-transfer-from-editor";
import { operatingPolicyFromEditor, resolveBusinessScheduleForRuntime } from "@/lib/server/receptionist/operating-maturity-from-editor";
import { qualificationConfigFromEditor } from "@/lib/server/receptionist/qualification-from-editor";
import { voiceV3ServicesFromEditor } from "@/lib/server/receptionist/service-config-from-editor";
import { transferTriggerPhrasesFromEditor } from "@/lib/server/receptionist/transfer-triggers-from-editor";
import { urgencyRulesFromEditor } from "@/lib/server/receptionist/urgency-from-editor";
import { mapEditorVoiceToLiveVoiceId } from "@/lib/server/receptionist/voice-map";
import { businessHoursWindowFromWeeklySchedule } from "@/lib/server/voice-v3/config/business-hours-from-wizard";
import { livePromptControlsFromAgentConfig } from "@/lib/server/voice-v3/prompts/live-prompt-controls";
import {
  isConversationalIvrEditor,
  resolveRuntimeProfile,
} from "@/lib/receptionist/runtime-profile";
import { isBookingLinkOnlyLaunch } from "@/lib/receptionist/booking-launch-mode";

export type KnowledgeCompileSlice = {
  knowledgeBaseIds: string[];
  openaiVectorStoreIds: string[];
  documentSourceIds: string[];
  faqFacts: string[];
  knowledgeItemSummaries: Array<{ id: string; label: string; summary: string }>;
  revision: string | null;
};

function mapIntakeField(f: AgentConfig["intake"][number]): IntakeFieldDefinition {
  const type =
    f.type === "zip"
      ? "text"
      : f.type === "choice"
        ? "text"
        : f.type === "date"
          ? "date"
          : f.type === "phone"
            ? "phone"
            : f.type === "email"
              ? "email"
              : "text";
  return {
    key: f.id,
    label: f.label,
    type,
    required: f.required,
    description: f.label,
  };
}

function bookingStrategy(editor: AgentConfig): VoiceWizardBookingStrategy {
  if (!editor.capabilities.book) return "NONE";
  if (isBookingLinkOnlyLaunch()) return "SEND_LINK";
  if (editor.appointments.strategy === "link") return "SEND_LINK";
  if (editor.appointments.strategy === "request") return "REQUEST_ONLY";
  if (editor.appointments.strategy === "none" || editor.appointments.provider === "none") {
    return "REQUEST_ONLY";
  }
  if (editor.appointments.provider === "microsoft") return "MICROSOFT_365";
  if (editor.appointments.provider === "google") return "GOOGLE_CALENDAR";
  if (editor.appointments.provider === "calendly") return "CALENDLY";
  return "REQUEST_ONLY";
}

function primaryService(editor: AgentConfig) {
  const t = editor.appointments.types.find((x) => x.enabled) ?? editor.appointments.types[0];
  return {
    id: t?.id ?? "default",
    name: t?.name ?? "General appointment",
    durationMinutes: t?.duration ?? 30,
    description: t?.location?.trim() || undefined,
    enabled: t?.enabled ?? true,
    requiredIntakeKeys: t?.requiredFields ?? [],
  };
}

/**
 * Single runtime source of truth: new-app receptionist `AgentConfig` (UI editor + knowledge profile).
 * Not the legacy appointment-receptionist wizard snapshot.
 */
export function editorToVoiceV3AgentConfig(input: {
  editor: AgentConfig;
  workspaceId: string;
  agentId: string;
  businessName: string;
  timezone: string;
  businessFacts?: {
    companyDescription?: string;
    location?: string;
    serviceArea?: string;
    hoursDisplay?: string;
    servicesSummary?: string;
    pricingSummary?: string;
    paymentMethods?: string;
    policiesSummary?: string;
  };
  knowledge: KnowledgeCompileSlice;
}): VoiceV3AgentConfig {
  const { editor, businessName, timezone, knowledge } = input;
  const cap = editor.capabilities;
  const bookLive =
    cap.book &&
    editor.appointments.strategy === "live" &&
    editor.appointments.provider !== "none";

  const v3Services = voiceV3ServicesFromEditor(editor);
  const service = v3Services[0] ?? primaryService(editor);
  const strategy = bookingStrategy(editor);
  const schedule = resolveBusinessScheduleForRuntime(editor);
  const businessHours = businessHoursWindowFromWeeklySchedule(schedule, {
    timezone: schedule.timezone || timezone,
    weekdays: [1, 2, 3, 4, 5],
    startLocal: "09:00",
    endLocal: "17:00",
  });
  const transferPolicy = compileVoiceV3TransferPolicyFromEditor(editor);
  const transferDestinationsFromPolicy = transferPolicy.destinations.map((d) => ({
    id: d.id,
    label: d.label,
    phoneE164: d.phoneE164,
    enabled: d.enabled !== false,
    description: d.description,
  }));
  const operatingPolicy = operatingPolicyFromEditor(editor);
  const transferTriggers = transferTriggerPhrasesFromEditor(editor);
  const adv = editor.transferAdvanced;

  const spamSolicitor = editor.protection.find((r) => r.kind === "solicitor" && r.enabled);
  const spamLikely = editor.protection.find((r) => r.kind === "spam_likely" && r.enabled);

  const nested = defaultNestedFromFlat({
    businessName,
    timezone,
    service,
    agentName: editor.identity.name,
  });

  const shell: VoiceV3AgentConfig = {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessName,
    timezone,
    intakeFields: editor.intake.map(mapIntakeField),
    transferDestinations:
      transferDestinationsFromPolicy.length > 0
        ? transferDestinationsFromPolicy
        : editor.transfers.map((t) => ({
            id: t.id,
            label: t.name,
            phoneE164: t.number,
            enabled: t.enabled,
            description: t.reason,
          })),
    service,
    services: v3Services.length ? v3Services : [service],
    businessHours: { ...businessHours, timezone: schedule.timezone || timezone },
    ...nested,
    source: "new_app_published",
  };

  const merged = mergeNestedConfig(shell, {
    identity: { agentName: editor.identity.name },
    capabilities: {
      answerQuestions: cap.answer,
      collectIntake: editor.intake.length > 0,
      checkAvailability: bookLive,
      bookAppointments: bookLive,
      findAppointments: (cap.reschedule || cap.cancel) && bookLive,
      rescheduleAppointments: cap.reschedule && bookLive,
      cancelAppointments: cap.cancel && bookLive,
      transferCalls: cap.transfer,
      sendSms: cap.smsConfirm || editor.recovery.enabled,
      takeMessages: cap.message || editor.messages.takeMessage,
      qualifyCallers: cap.qualify,
    },
    conversation: {
      role:
        editor.knowledgeProfile?.agentJob?.trim() ||
        editor.identity.role ||
        "Front desk receptionist",
      tone: "Professional and warm",
      speakingStyle: "Natural telephone receptionist",
      language: editor.identity.language,
      speaksFirst: "ai",
      openingGreeting: editor.identity.greeting.replace(/\{business_name\}/g, businessName),
      conversationBehaviors: {
        keepBrief: editor.style.pace !== "slow",
        oneQuestionAtATime: true,
        confirmDetails: true,
        neverInventPricing: true,
        neverInventAvailability: true,
      },
      guardrails: editor.instructions?.trim() ? [editor.instructions.trim()] : [],
      livePromptControls: {
        speakingPace:
          editor.style.pace === "slow" ? "slower" : editor.style.pace === "fast" ? "faster" : "normal",
        voiceAccent: "neutral_american",
        backchannelLevel:
          editor.style.backchannels === "none"
            ? "none"
            : editor.style.backchannels === "minimal"
              ? "minimal"
              : "natural",
        callerPausePatience:
          editor.style.patience === "quick"
            ? "quick"
            : editor.style.patience === "patient"
              ? "patient"
              : "normal",
        interruptionStyle:
          editor.style.interruptions === "yield" ? "yield_immediately" : "natural",
      },
    },
    business: {
      companyDescription: input.businessFacts?.companyDescription,
      location: input.businessFacts?.location,
      serviceArea: input.businessFacts?.serviceArea,
      hoursDisplay: input.businessFacts?.hoursDisplay,
      servicesSummary: input.businessFacts?.servicesSummary,
      pricingSummary: input.businessFacts?.pricingSummary,
      paymentMethods: input.businessFacts?.paymentMethods,
      policiesSummary: input.businessFacts?.policiesSummary,
      faqFacts: knowledge.faqFacts.length ? knowledge.faqFacts : undefined,
      knowledgeItemSummaries: knowledge.knowledgeItemSummaries.length
        ? knowledge.knowledgeItemSummaries
        : undefined,
    },
    scheduling: {
      bookingStrategy: strategy,
      primaryServiceId: service.id,
      services: v3Services.length ? v3Services : [service],
      bookingBehavior: {
        askPreferredDayFirst: editor.appointments.preferredDayFirst,
        offerEarliestThree: editor.appointments.offerCount === 3,
        confirmBeforeBooking: editor.appointments.confirmBeforeWrite,
        sendSmsAfterBooking: editor.appointments.smsConfirmation,
        askServiceFirst: editor.appointments.askType,
        distinguishNewExisting: editor.appointments.askNewExisting,
      },
    },
    knowledge: {
      hotContext: {
        companyDescription: input.businessFacts?.companyDescription,
        location: input.businessFacts?.location,
        serviceArea: input.businessFacts?.serviceArea,
        hoursDisplay: input.businessFacts?.hoursDisplay,
        servicesSummary: input.businessFacts?.servicesSummary,
        pricingSummary: input.businessFacts?.pricingSummary,
        paymentMethods: input.businessFacts?.paymentMethods,
        policiesSummary: input.businessFacts?.policiesSummary,
        faqFacts: knowledge.faqFacts,
        knowledgeItemSummaries: knowledge.knowledgeItemSummaries,
      },
      retrieval: {
        enabled:
          cap.answer &&
          (knowledge.openaiVectorStoreIds.length > 0 || knowledge.faqFacts.length > 0),
        knowledgeBaseIds: knowledge.knowledgeBaseIds,
        documentSourceIds: knowledge.documentSourceIds,
        openaiVectorStoreIds: knowledge.openaiVectorStoreIds,
        revision: knowledge.revision,
      },
    },
    telephony: {
      phoneNumberId: editor.connection.id?.trim() || null,
      phoneNumberE164: null,
      outboundSmsMode:
        strategy === "SEND_LINK" || isBookingLinkOnlyLaunch() ? "platform" : undefined,
      outboundSmsPhoneNumberId: null,
      outboundSmsE164: null,
      callRecording:
        editor.audio.recording === "inbound"
          ? "inbound_only"
          : editor.audio.recording === "all"
            ? "all"
            : "off",
      connectionGreetingMode: editor.audio.connectionGreeting,
      connectionGreetingText: editor.audio.connectionGreetingText,
      liveVoiceId: mapEditorVoiceToLiveVoiceId(editor.identity.voice, editor.identity.customVoiceId),
      speaksFirst: "ai",
    },
    callHandling: {
      transferTriggers,
      transferRingSeconds: adv.ringSeconds,
      transferFallback: adv.globalFallback,
      warmTransfer: editor.transferStyle === "warm",
      detectVoicemailOnTransfer: adv.detectVoicemailOnTransfer,
      voiceV2HumanTransferEnabled: adv.humanTransferEnabled,
      allowCallerRequestedTransfer: true,
      transferRouting: adv.routing === "waterfall" ? "waterfall" : "single",
      defaultTransferPlanId: "default_transfer_route",
      transferPlanSteps: adv.planSteps,
      urgencyEnabled: editor.urgency.enabled,
      urgencyRules: urgencyRulesFromEditor(editor),
      callbackRequestsEnabled: editor.messages.callbacks,
      callbackUseAniByDefault: editor.messages.requiredFields.ani,
      callbackAskPreferredTime: editor.messages.requiredFields.time,
      callbackConfirmNumber: editor.messages.requiredFields.confirm,
    },
    qualification: qualificationConfigFromEditor(editor),
    recovery: {
      aiCallRecoveryEnabled: editor.recovery.enabled,
      consentMode: editor.recovery.consentMode ?? null,
      sendingPhoneNumberId: null,
      continueOverSms: editor.recovery.carryover,
      delaySeconds: editor.recovery.delaySec ?? null,
      sendWhenCallbackCreated: false,
    },
    integrations: {
      crmEnabled: editor.crmWrite,
      longTermMemory: editor.memory,
      calendarProvider: editor.appointments.provider,
      calendarConnected: editor.appointments.provider !== "none",
      calendarEmail: null,
    },
    bookingStrategyDetail: {
      ...DEFAULT_V3_BOOKING_STRATEGY,
      strategy,
      executionStatus:
        strategy === "SEND_LINK" || strategy === "MICROSOFT_365" || strategy === "GOOGLE_CALENDAR"
          ? "ACTIVE_EXECUTION"
          : "CONFIGURED_NOT_IMPLEMENTED",
      bookingLinkUrl: editor.appointments.bookingLink?.trim() || null,
      bookingLinkLabel: editor.appointments.linkSender?.trim() || null,
      sendLinkConsentRequired: false,
    },
  });

  let base: VoiceV3AgentConfig = {
    ...merged,
    runtimeProfile: resolveRuntimeProfile(editor),
    transfer: transferPolicy,
    operatingPolicy,
    spamProtection: {
      spamLikelyPolicy: spamLikely
        ? spamLikely.action === "end"
          ? "BLOCK"
          : "SCREEN"
        : "ALLOW",
      solicitorPolicy: spamSolicitor
        ? spamSolicitor.action === "end"
          ? "DECLINE"
          : spamSolicitor.action === "message"
            ? "TAKE_MESSAGE"
            : "ALLOW"
        : "ALLOW",
    },
  };

  const bookLink =
    cap.book && (editor.appointments.strategy === "link" || isBookingLinkOnlyLaunch());

  if (isConversationalIvrEditor(editor) && !bookLive && !bookLink) {
    const mt = editor.messageTaking;
    const extraGuards: string[] = [
      "You are a conversational phone menu — not a full receptionist. Never claim an appointment was booked, check calendar availability, promise confirmed times, reschedule or cancel appointments, or send booking links.",
      "If the caller wants an appointment, offer to transfer to the appropriate route or take a message. You may note their preferred time in conversation but must not represent it as confirmed.",
      "Message-taking questions are conversational guidance only. Do not re-ask for information the caller already provided. Do not run a rigid form or require every question to be answered.",
    ];
    if (mt?.additionalInstructions?.trim()) {
      extraGuards.push(mt.additionalInstructions.trim());
    }
    if (mt?.enabled && mt.questions?.length) {
      extraGuards.push(
        `When taking a message, you may naturally cover: ${mt.questions.map((q) => `"${q}"`).join("; ")}.`,
      );
    }
    base = {
      ...base,
      intakeFields: [],
      capabilities: {
        ...base.capabilities,
        collectIntake: false,
        checkAvailability: false,
        bookAppointments: false,
        findAppointments: false,
        rescheduleAppointments: false,
        cancelAppointments: false,
        qualifyCallers: false,
        takeMessages: mt?.enabled ?? base.capabilities.takeMessages,
        transferCalls: editor.capabilities.transfer,
        answerQuestions: editor.capabilities.answer,
        sendSms: false,
      },
      scheduling: {
        ...base.scheduling,
        bookingStrategy: "NONE",
      },
      bookingStrategyDetail: {
        ...base.bookingStrategyDetail,
        strategy: "NONE",
        executionStatus: "CONFIGURED_NOT_IMPLEMENTED",
      },
      conversation: {
        ...base.conversation,
        conversationBehaviors: {
          ...base.conversation.conversationBehaviors,
          confirmDetails: false,
          neverInventAvailability: true,
        },
        guardrails: [...(base.conversation.guardrails ?? []), ...extraGuards],
      },
      callHandling: {
        ...base.callHandling,
        callbackRequestsEnabled: false,
      },
      knowledge: {
        ...base.knowledge,
        retrieval: {
          ...base.knowledge.retrieval,
          enabled:
            editor.capabilities.answer &&
            (knowledge.openaiVectorStoreIds.length > 0 || knowledge.faqFacts.length > 0),
        },
      },
    };
  }

  if (isConversationalIvrEditor(editor) && bookLink && !bookLive) {
    const mt = editor.messageTaking;
    const linkGuards: string[] = [
      "You are a conversational phone menu. Do not claim an appointment is booked on the call, check live calendar availability, or promise specific confirmed times.",
      "When the caller wants to schedule, call send_booking_link with confirmed=true as soon as they agree to receive the link by text (same turn when possible). Do not describe sending without calling the tool.",
      "You may still transfer or take a message if they prefer not to receive a text.",
    ];
    if (mt?.additionalInstructions?.trim()) {
      linkGuards.push(mt.additionalInstructions.trim());
    }
    base = {
      ...base,
      capabilities: {
        ...base.capabilities,
        checkAvailability: false,
        bookAppointments: false,
        findAppointments: false,
        rescheduleAppointments: false,
        cancelAppointments: false,
        sendSms: true,
      },
      scheduling: {
        ...base.scheduling,
        bookingStrategy: "SEND_LINK",
      },
      bookingStrategyDetail: {
        ...base.bookingStrategyDetail,
        strategy: "SEND_LINK",
        executionStatus: "ACTIVE_EXECUTION",
        bookingLinkUrl: editor.appointments.bookingLink?.trim() || base.bookingStrategyDetail.bookingLinkUrl,
      },
      conversation: {
        ...base.conversation,
        guardrails: [...(base.conversation.guardrails ?? []), ...linkGuards],
      },
    };
  }

  void livePromptControlsFromAgentConfig(base);
  return base;
}
