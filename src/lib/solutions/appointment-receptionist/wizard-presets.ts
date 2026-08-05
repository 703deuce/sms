import type {
  AppointmentReceptionistWizardState,
  CapabilityId,
} from "./types";
import { WIZARD_STEPS } from "./types";
import {
  CAPABILITY_OPTIONS,
  ANSWER_WHEN_OPTIONS,
  TEST_SCENARIOS,
  type WizardPresetId,
} from "./defaults";

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
  // Overflow / after-hours answering — no calendar booking suite.
  nobody_answers: [
    "answer_questions",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
    "send_sms_confirmations",
  ],
  after_hours: [
    "answer_questions",
    "take_messages",
    "qualify_callers",
    "transfer_calls",
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

/** Steps shown for this wizard run — hide Appointments / booking-only UI. */
export function visibleWizardSteps(
  state: Pick<AppointmentReceptionistWizardState, "capabilities" | "preset">,
): Array<(typeof WIZARD_STEPS)[number]> {
  const booking = hasBookingCapability(state.capabilities);
  return WIZARD_STEPS.filter((s) => {
    if (s.id === "appointments") return booking;
    return true;
  });
}

const BOOKING_ONLY_TEST_SCENARIOS = new Set([
  "appointment_booking",
  "no_availability",
  "tool_failure",
]);

/** Test scenarios that match this agent's capabilities. */
export function testScenariosForCapabilities(
  capabilities: AppointmentReceptionistWizardState["capabilities"] | undefined,
) {
  const booking = hasBookingCapability(capabilities);
  return TEST_SCENARIOS.filter((s) => {
    if (BOOKING_ONLY_TEST_SCENARIOS.has(s.id)) return booking;
    return true;
  });
}

/** Default display name for a new agent of this preset (user can rename). */
export { defaultSolutionNameForPreset } from "./defaults";

/**
 * Make a unique agent/setup display name so five answering agents are distinguishable.
 */
export function uniqueAgentDisplayName(base: string, salt?: string): string {
  const trimmed = (base || "").trim() || "AI Agent";
  const stamp =
    salt ||
    new Date().toISOString().slice(5, 16).replace("T", " "); // MM-DD HH:mm
  // Avoid double-stamping if the user already customized past the canned defaults.
  if (/\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(trimmed) || /\(\d+\)$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} · ${stamp}`;
}

/** Answer-when options that make sense for this preset. */
export function answerWhenOptionsForPreset(preset: string | null | undefined) {
  const key = resolvePresetKey(preset);
  const allowed = new Set(
    key === "nobody_answers"
      ? ["nobody_answers", "line_busy", "every_call"]
      : key === "after_hours"
        ? ["after_hours", "custom_schedule", "every_call"]
        : ANSWER_WHEN_OPTIONS.map((o) => o.id),
  );
  return ANSWER_WHEN_OPTIONS.filter((o) => allowed.has(o.id));
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
