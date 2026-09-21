import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** Wizard-published booking mode — sole authority for live FIND/BOOK vs request vs message. */
export type VoiceV2BookingStrategy =
  | "NONE"
  | "REQUEST_ONLY"
  | "SEND_LINK"
  | "MICROSOFT_365"
  | "GOOGLE_CALENDAR"
  | "CALENDLY";

const STRATEGIES: VoiceV2BookingStrategy[] = [
  "NONE",
  "REQUEST_ONLY",
  "SEND_LINK",
  "MICROSOFT_365",
  "GOOGLE_CALENDAR",
  "CALENDLY",
];

function isStrategy(value: string): value is VoiceV2BookingStrategy {
  return (STRATEGIES as string[]).includes(value);
}

function wizardFromConfig(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): AppointmentReceptionistWizardState | undefined {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
}

/** Derive strategy from wizard when `bookingStrategy` is not pinned on advanced config. */
export function deriveBookingStrategyFromWizard(
  wizard: AppointmentReceptionistWizardState,
): VoiceV2BookingStrategy {
  if (wizard.bookingStrategy && isStrategy(wizard.bookingStrategy)) {
    return wizard.bookingStrategy;
  }
  if (!wizard.capabilities?.includes("book_appointments")) {
    return "NONE";
  }
  const primary =
    wizard.appointmentTypes.find((t) => t.enabled) || wizard.appointmentTypes[0];
  const perm = primary?.bookingPermission;
  if (perm === "send_booking_link") return "SEND_LINK";
  if (
    perm === "book_directly" &&
    wizard.calendarConnected &&
    (wizard.calendarProvider === "microsoft" || wizard.calendarProvider === "outlook")
  ) {
    return "MICROSOFT_365";
  }
  if (
    perm === "book_directly" &&
    wizard.calendarConnected &&
    wizard.calendarProvider === "google"
  ) {
    return "GOOGLE_CALENDAR";
  }
  if (
    perm === "book_directly" &&
    wizard.calendarConnected &&
    wizard.calendarProvider === "calendly"
  ) {
    return "CALENDLY";
  }
  return "REQUEST_ONLY";
}

/** Pinned published config — never infer live booking from calendar connection alone. */
export function resolveVoiceV2BookingStrategy(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): VoiceV2BookingStrategy {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const pinned = String(advanced.bookingStrategy || "").trim();
  if (isStrategy(pinned)) return pinned;

  const wizard = wizardFromConfig(config);
  if (wizard) return deriveBookingStrategyFromWizard(wizard);

  // Legacy flag from pre-strategy publishes.
  if (advanced.voiceV2PstnLiveBooking === true) return "MICROSOFT_365";
  return "NONE";
}

/** One-Amy Voice V2 PSTN intake path (save + mode-specific completion; no General→Booking handoff). */
export function isVoiceV2PstnOneAmyMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  const strategy = resolveVoiceV2BookingStrategy(config);
  return (
    strategy === "MICROSOFT_365" ||
    strategy === "CALENDLY" ||
    strategy === "REQUEST_ONLY" ||
    strategy === "SEND_LINK" ||
    strategy === "NONE"
  );
}

export function isVoiceV2PstnLiveBookingMode(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  const strategy = resolveVoiceV2BookingStrategy(config);
  return strategy === "MICROSOFT_365" || strategy === "GOOGLE_CALENDAR" || strategy === "CALENDLY";
}

export function voiceV2StrategyAllowsFindBook(strategy: VoiceV2BookingStrategy): boolean {
  return strategy === "MICROSOFT_365" || strategy === "GOOGLE_CALENDAR" || strategy === "CALENDLY";
}

export function voiceV2StrategyRequiresSchedulingPreference(
  strategy: VoiceV2BookingStrategy,
): boolean {
  return (
    strategy === "MICROSOFT_365" ||
    strategy === "GOOGLE_CALENDAR" ||
    strategy === "CALENDLY" ||
    strategy === "REQUEST_ONLY"
  );
}

export type VoiceV2StructuredOutcome =
  | "MESSAGE_TAKEN"
  | "APPOINTMENT_REQUESTED"
  | "BOOKING_LINK_SENT"
  | "BOOKING_LINK_SEND_FAILED"
  | "BOOKED"
  | "CALLBACK_REQUESTED"
  | "TRANSFERRED"
  | "FILTERED";

export function structuredOutcomeForStrategy(
  strategy: VoiceV2BookingStrategy,
): VoiceV2StructuredOutcome {
  if (strategy === "REQUEST_ONLY") return "APPOINTMENT_REQUESTED";
  return "MESSAGE_TAKEN";
}
