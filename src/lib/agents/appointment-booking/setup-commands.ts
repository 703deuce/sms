/**
 * Typed setup commands Amy (and Settings / guided wizard) use to mutate drafts.
 * Natural language → typed command → schema validation → draft → readiness.
 * Deterministic deploy remains POST appointment-receptionist activate.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { AgentCollectionField } from "@/lib/agents/appointment-booking/collection-fields";
import {
  createCustomCollectionField,
  normalizeWizardCollectFields,
} from "@/lib/agents/appointment-booking/collection-fields";
import type { BookingPolicy } from "@/lib/agents/appointment-booking/types";

export type SetupSectionId =
  | "company_brain"
  | "phone"
  | "calendar"
  | "bookable_services"
  | "collection_fields"
  | "transfers"
  | "voice"
  | "workflow"
  | "tests"
  | "deploy";

export type SetupSectionStatus = {
  id: SetupSectionId;
  label: string;
  status: "complete" | "partial" | "missing";
  detail: string;
};

export type SetupReadiness = {
  sections: SetupSectionStatus[];
  completeCount: number;
  totalCount: number;
  nextQuestion: string | null;
  canGenerateWorkflow: boolean;
  canDeploy: boolean;
  missingAmySpecific: string[];
};

export type SetupCommand =
  | { type: "get_setup_readiness" }
  | {
      type: "configure_booking_policy";
      summary?: string;
      patch: Partial<BookingPolicy>;
    }
  | {
      type: "add_collection_field";
      summary?: string;
      field: {
        label: string;
        question?: string;
        type?: AgentCollectionField["type"];
        required?: boolean;
        confirmationRequired?: boolean;
        appliesToServices?: string[];
        saveTo?: Array<"contact" | "appointment">;
      };
    }
  | {
      type: "set_voice_configuration";
      summary?: string;
      voiceId?: string;
      voiceLabel?: string;
      openingGreeting?: string;
      speakingSpeed?: number;
    }
  | {
      type: "configure_confirmation_sms";
      enabled: boolean;
      summary?: string;
    }
  | {
      type: "set_transfer_fallback";
      fallback: string;
      summary?: string;
    };

export function computeSetupReadiness(
  agent: AppointmentBookingAgentView,
): SetupReadiness {
  const brain = agent.businessBrain;
  const hasBrainName = Boolean(brain.businessName?.trim());
  const hasServices = (brain.services || []).length > 0 || agent.bookingPolicy.allowedServices.length > 0;
  const hasPhone = Boolean(agent.phoneNumberE164 || agent.phoneNumberIds.length);
  const hasCalendar = agent.calendarConnectionIds.length > 0;
  const hasBookable = agent.bookingPolicy.allowedServices.length > 0;
  const hasFields =
    agent.bookingPolicy.requireCallerName && agent.bookingPolicy.requirePhoneNumber;
  const hasVoice = Boolean(agent.profile.voiceSummary);
  const hasWorkflow = Boolean(agent.primaryFlowId);
  const hasTelnyx = Boolean(agent.telnyxAssistantId);
  const ready = Boolean(agent.readiness?.ready);

  const sections: SetupSectionStatus[] = [
    {
      id: "company_brain",
      label: "Business information",
      status: hasBrainName ? (hasServices ? "complete" : "partial") : "missing",
      detail: hasBrainName
        ? `${brain.businessName}${hasServices ? "" : " · add services in Company Brain"}`
        : "Company Brain needs an approved business name",
    },
    {
      id: "phone",
      label: "Phone number",
      status: hasPhone ? "complete" : "missing",
      detail: hasPhone ? agent.resources.numberLabel : "Assign a number Amy can answer",
    },
    {
      id: "calendar",
      label: "Calendar",
      status: hasCalendar ? "complete" : "missing",
      detail: hasCalendar ? agent.resources.calendarLabel : "Connect the calendar Amy books on",
    },
    {
      id: "bookable_services",
      label: "Bookable services",
      status: hasBookable ? "complete" : "missing",
      detail: hasBookable
        ? `${agent.bookingPolicy.allowedServices.length} service(s)`
        : "Choose which Brain services Amy may book",
    },
    {
      id: "collection_fields",
      label: "Information collected",
      status: hasFields ? "complete" : "partial",
      detail: hasFields
        ? "Name and phone required"
        : "Define what Amy must collect before booking",
    },
    {
      id: "transfers",
      label: "Transfers",
      status: (brain.transferDestinations || []).length ? "complete" : "partial",
      detail: (brain.transferDestinations || []).length
        ? `${brain.transferDestinations.length} destination(s)`
        : "Optional — configure when Amy should transfer",
    },
    {
      id: "voice",
      label: "Voice",
      status: hasVoice ? "complete" : "partial",
      detail: hasVoice ? String(agent.profile.voiceSummary) : "Choose voice and greeting",
    },
    {
      id: "workflow",
      label: "Workflow",
      status: hasWorkflow ? "complete" : "missing",
      detail: hasWorkflow ? agent.resources.workflowLabel : "Ready to generate after resources are set",
    },
    {
      id: "tests",
      label: "Tests",
      status: agent.readiness?.ready ? "complete" : "partial",
      detail: ready ? "Readiness checks passing" : "Run simulations and a live test before activate",
    },
    {
      id: "deploy",
      label: "Deploy",
      status: hasTelnyx && agent.identity.status === "active" ? "complete" : "missing",
      detail: hasTelnyx
        ? `Telnyx ${agent.telnyxAssistantId}`
        : "Activate deploys VoiceAgent + Telnyx via wizard engine",
    },
  ];

  const completeCount = sections.filter((s) => s.status === "complete").length;
  const missingAmySpecific: string[] = [];
  if (!hasPhone) missingAmySpecific.push("Which phone number should I answer?");
  if (!hasCalendar) missingAmySpecific.push("Which calendar should I use?");
  if (!hasBookable) missingAmySpecific.push("Which of these services may I book?");
  if (!hasFields) missingAmySpecific.push("What information must I collect?");
  if (!hasVoice) missingAmySpecific.push("What voice and greeting should I use?");

  const nextQuestion =
    missingAmySpecific[0] ||
    (!hasBrainName
      ? "I need your Company Brain approved first — business name and hours."
      : null);

  return {
    sections,
    completeCount,
    totalCount: sections.length,
    nextQuestion,
    canGenerateWorkflow: hasPhone && hasCalendar && hasBookable,
    canDeploy: Boolean(agent.readiness?.ready) && hasPhone && hasCalendar && hasBookable,
    missingAmySpecific,
  };
}

export function setupInterviewOpening(agent: AppointmentBookingAgentView): string {
  const readiness = computeSetupReadiness(agent);
  const name = agent.identity.displayName || "Amy";
  if (agent.identity.status === "active" && readiness.canDeploy) {
    return `${name} is live. Ask me about today, change a rule, or open Settings.`;
  }
  const known: string[] = [];
  if (agent.businessBrain.businessName) known.push(`I already know ${agent.businessBrain.businessName}`);
  if (agent.businessBrain.services.length) {
    known.push(
      `${agent.businessBrain.services.length} service(s) in Company Brain`,
    );
  }
  const knownLine = known.length ? `${known.join(", ")}. ` : "";
  return (
    `I already know my job is to book appointments. I’m going to learn how your business handles bookings and connect the tools I need. ` +
    knownLine +
    (readiness.nextQuestion
      ? readiness.nextQuestion
      : `Setup is ${readiness.completeCount} of ${readiness.totalCount} — we can generate my workflow and test next.`)
  );
}

/** Map a typed setup command into a change-proposal patch (never direct Telnyx). */
export function setupCommandToProposalInput(command: SetupCommand): {
  summary: string;
  bookingPolicy?: Partial<BookingPolicy>;
  voice?: {
    voiceId?: string;
    voiceLabel?: string;
    openingGreeting?: string;
    speakingSpeed?: number;
  };
  collectionField?: ReturnType<typeof createCustomCollectionField> & {
    question?: string;
    saveTo?: Array<"contact" | "appointment">;
  };
} | null {
  switch (command.type) {
    case "get_setup_readiness":
      return null;
    case "configure_booking_policy":
      return {
        summary: command.summary || "Update booking policy from setup",
        bookingPolicy: command.patch,
      };
    case "configure_confirmation_sms":
      return {
        summary:
          command.summary ||
          (command.enabled ? "Enable confirmation SMS" : "Disable confirmation SMS"),
        bookingPolicy: { sendSmsConfirmation: command.enabled },
      };
    case "set_transfer_fallback":
      return {
        summary: command.summary || `Set transfer fallback: ${command.fallback}`,
        bookingPolicy: {},
      };
    case "set_voice_configuration":
      return {
        summary: command.summary || "Update voice and greeting",
        voice: {
          voiceId: command.voiceId,
          voiceLabel: command.voiceLabel,
          openingGreeting: command.openingGreeting,
          speakingSpeed: command.speakingSpeed,
        },
      };
    case "add_collection_field": {
      const field = createCustomCollectionField({
        label: command.field.label,
        type: command.field.type,
        required: command.field.required,
      });
      return {
        summary:
          command.summary ||
          `Add collection field: ${command.field.label}${
            command.field.required ? " (required)" : ""
          }`,
        collectionField: {
          ...field,
          question: command.field.question,
          confirmationRequired:
            command.field.confirmationRequired ?? Boolean(command.field.required),
          appliesToServiceIds: command.field.appliesToServices,
          saveTo: command.field.saveTo || ["contact", "appointment"],
        },
      };
    }
    default:
      return null;
  }
}

export function listCurrentCollectionFields(
  agent: AppointmentBookingAgentView,
): AgentCollectionField[] {
  // Prefer typed fields when present on operating state via profile requiredFields summary.
  // Full list lives in draftConfig; callers may pass wizard-normalized fields separately.
  const required: AgentCollectionField[] = [];
  if (agent.bookingPolicy.requireCallerName) {
    required.push(
      ...normalizeWizardCollectFields([
        { id: "full_name", label: "Full name", required: true, enabled: true },
      ]),
    );
  }
  if (agent.bookingPolicy.requirePhoneNumber) {
    required.push(
      ...normalizeWizardCollectFields([
        { id: "phone", label: "Callback number", required: true, enabled: true },
      ]).filter((f) => f.id === "phone"),
    );
  }
  if (agent.bookingPolicy.requireEmail) {
    required.push(
      ...normalizeWizardCollectFields([
        { id: "email", label: "Email", required: true, enabled: true },
      ]).filter((f) => f.id === "email"),
    );
  }
  if (agent.bookingPolicy.requireServiceAddress) {
    required.push(
      ...normalizeWizardCollectFields([
        { id: "address", label: "Service address", required: true, enabled: true },
      ]).filter((f) => f.id === "address"),
    );
  }
  return required.length ? required : normalizeWizardCollectFields(undefined);
}
