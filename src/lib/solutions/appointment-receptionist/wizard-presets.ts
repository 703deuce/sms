import type {
  AppointmentReceptionistWizardState,
  CapabilityId,
} from "./types";
import { WIZARD_STEPS } from "./types";
import { CAPABILITY_OPTIONS, type WizardPresetId } from "./defaults";

/** Capabilities offered for each Solutions-view preset (and booking default). */
export const PRESET_CAPABILITY_ALLOWLIST: Record<
  WizardPresetId | "appointment_booking",
  CapabilityId[]
> = {
  // Answering agent — no calendar booking suite by default.
  every_call: [
    "answer_questions",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
    "send_sms_confirmations",
  ],
  nobody_answers: [
    "answer_questions",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
    "book_appointments",
    "send_sms_confirmations",
  ],
  after_hours: [
    "answer_questions",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
    "book_appointments",
    "send_sms_confirmations",
  ],
  lead_capture: [
    "answer_questions",
    "qualify_callers",
    "take_messages",
    "transfer_calls",
    "send_sms_confirmations",
  ],
  service_intake: [
    "answer_questions",
    "qualify_callers",
    "take_messages",
    "transfer_calls",
    "send_sms_confirmations",
  ],
  // Full Book Appointments wizard (no URL preset).
  appointment_booking: [
    "answer_questions",
    "book_appointments",
    "reschedule",
    "cancel",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
    "send_sms_confirmations",
  ],
};

export function resolvePresetKey(
  preset: string | null | undefined,
): WizardPresetId | "appointment_booking" {
  if (
    preset === "every_call" ||
    preset === "nobody_answers" ||
    preset === "after_hours" ||
    preset === "lead_capture" ||
    preset === "service_intake"
  ) {
    return preset;
  }
  return "appointment_booking";
}

export function allowedCapabilitiesForPreset(
  preset: string | null | undefined,
): CapabilityId[] {
  return PRESET_CAPABILITY_ALLOWLIST[resolvePresetKey(preset)];
}

export function capabilityOptionsForPreset(preset: string | null | undefined) {
  const allowed = new Set(allowedCapabilitiesForPreset(preset));
  return CAPABILITY_OPTIONS.filter((o) => allowed.has(o.id));
}

export function hasBookingCapability(
  capabilities: CapabilityId[] | undefined,
): boolean {
  const caps = capabilities || [];
  return (
    caps.includes("book_appointments") ||
    caps.includes("reschedule") ||
    caps.includes("cancel")
  );
}

/** Steps shown for this wizard run — hide Appointments when booking is off. */
export function visibleWizardSteps(
  state: Pick<AppointmentReceptionistWizardState, "capabilities" | "preset">,
): Array<(typeof WIZARD_STEPS)[number]> {
  const booking = hasBookingCapability(state.capabilities);
  return WIZARD_STEPS.filter((s) => {
    if (s.id === "appointments") return booking;
    return true;
  });
}

export function wizardHeadline(preset: string | null | undefined): {
  title: string;
  subtitle: string;
} {
  switch (resolvePresetKey(preset)) {
    case "every_call":
      return {
        title: "Create AI Answering Agent",
        subtitle: "Answer every call — questions, messages, and transfers",
      };
    case "nobody_answers":
      return {
        title: "Cover Missed Calls",
        subtitle: "Ring your team first, then AI picks up overflow",
      };
    case "after_hours":
      return {
        title: "Answer After Hours",
        subtitle: "AI covers nights, weekends, and holidays",
      };
    case "lead_capture":
      return {
        title: "Capture New Inquiries",
        subtitle: "Qualify callers and take messages",
      };
    case "service_intake":
      return {
        title: "Handle New Service Calls",
        subtitle: "Intake, qualify, and route service requests",
      };
    default:
      return {
        title: "Create Appointment Receptionist",
        subtitle: "Answer calls and book appointments — guided setup",
      };
  }
}

export function goalsSidePanelCopy(preset: string | null | undefined): {
  outcome: string;
  required: Array<{ label: string; detail: string; tone: string }>;
  optional: string[];
} {
  const booking = resolvePresetKey(preset) === "appointment_booking";
  if (booking) {
    return {
      outcome:
        "Your AI receptionist will answer calls, help callers, and book appointments so you never miss an opportunity.",
      required: [
        {
          label: "Phone",
          detail: "Receive and manage calls",
          tone: "bg-success",
        },
        {
          label: "AI Voice",
          detail: "Power conversations with AI",
          tone: "bg-purple",
        },
        {
          label: "Calendar",
          detail: "Book and manage appointments",
          tone: "bg-accent",
        },
      ],
      optional: ["SMS — Send texts and reminders", "CRM — Sync with your CRM"],
    };
  }
  return {
    outcome:
      "Your AI answering agent will pick up calls, answer questions from your knowledge, take messages, and transfer when needed.",
    required: [
      {
        label: "Phone",
        detail: "Receive and manage calls",
        tone: "bg-success",
      },
      {
        label: "AI Voice",
        detail: "Power conversations with AI",
        tone: "bg-purple",
      },
    ],
    optional: [
      "SMS — Confirmations and follow-ups",
      "CRM — Sync inquiry notes",
      "Calendar — Only if you enable booking",
    ],
  };
}
