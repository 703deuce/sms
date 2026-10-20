import type { AgentConfig } from "@/lib/agent";
import type {
  IntakeFieldDefinition,
  VoiceV3AgentConfig,
  VoiceWizardBookingStrategy,
} from "@/lib/server/voice-v3/types/agent-config";
import { mapEditorVoiceToLiveVoiceId } from "@/lib/server/receptionist/voice-map";
import { livePromptControlsFromAgentConfig } from "@/lib/server/voice-v3/prompts/live-prompt-controls";

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
  if (editor.appointments.strategy === "link") return "SEND_LINK";
  if (editor.appointments.strategy === "request") return "REQUEST_ONLY";
  if (editor.appointments.strategy === "none" || editor.appointments.provider === "none") {
    return "REQUEST_ONLY";
  }
  if (editor.appointments.provider === "microsoft") return "MICROSOFT_365";
  if (editor.appointments.provider === "google") return "GOOGLE";
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

  const services = editor.appointments.types
    .filter((t) => t.enabled)
    .map((t) => ({
      id: t.id,
      name: t.name,
      durationMinutes: t.duration,
      description: t.location || undefined,
      enabled: true,
      requiredIntakeKeys: t.requiredFields,
    }));

  const service = primaryService(editor);
  const strategy = bookingStrategy(editor);

  const transferEnabled = cap.transfer && editor.transfers.some((t) => t.enabled);
  const transfer = transferEnabled
    ? {
        enabled: true,
        routes: editor.transfers
          .filter((t) => t.enabled)
          .map((t) => ({
            id: t.id,
            label: t.name,
            description: t.reason || "Transfer when appropriate",
          })),
        destinations: editor.transfers
          .filter((t) => t.enabled)
          .map((t) => ({ id: t.id, label: t.name })),
      }
    : undefined;

  const spamSolicitor = editor.protection.find((r) => r.kind === "solicitor" && r.enabled);
  const spamLikely = editor.protection.find((r) => r.kind === "spam_likely" && r.enabled);

  const base: VoiceV3AgentConfig = {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessName,
    timezone,
    intakeFields: editor.intake.map(mapIntakeField),
    transfer,
    transferDestinations: editor.transfers.map((t) => ({
      id: t.id,
      label: t.name,
      phoneE164: t.number,
      enabled: t.enabled,
      description: t.reason,
    })),
    service,
    services: services.length ? services : [service],
    businessHours: { timezone },
    identity: { agentName: editor.identity.name },
    capabilities: {
      answerQuestions: cap.answer,
      collectIntake: editor.intake.length > 0,
      checkAvailability: bookLive,
      bookAppointments: bookLive,
      findAppointments: cap.reschedule || cap.cancel,
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
      services: services.length ? services : [service],
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
        enabled: cap.answer && (knowledge.openaiVectorStoreIds.length > 0 || knowledge.faqFacts.length > 0),
        knowledgeBaseIds: knowledge.knowledgeBaseIds,
        documentSourceIds: knowledge.documentSourceIds,
        openaiVectorStoreIds: knowledge.openaiVectorStoreIds,
        revision: knowledge.revision,
      },
    },
    callHandling: {
      transferTriggers: [],
      transferRingSeconds: 30,
      transferFallback: "message",
      warmTransfer: editor.transferStyle === "warm",
      callbackRequestsEnabled: editor.messages.callbacks,
      callbackUseAniByDefault: editor.messages.requiredFields.ani,
      callbackAskPreferredTime: editor.messages.requiredFields.time,
      callbackConfirmNumber: editor.messages.requiredFields.confirm,
    },
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

  // live-prompt-controls helper expects full config on conversation
  void livePromptControlsFromAgentConfig(base);
  return base;
}
