import type {
  AppointmentReceptionistWizardState,
  VoiceWizardBookingStrategy,
} from "./types";
import {
  bookingPermissionForStrategy,
  deriveBookingStrategyFromWizard,
  syncAppointmentTypesWithBookingStrategy,
  type VoiceV2BookingStrategy,
} from "@/lib/voice-receptionist-wizard/booking-strategy";

const UI_BOOKING_STRATEGIES: VoiceV2BookingStrategy[] = [
  "MICROSOFT_365",
  "REQUEST_ONLY",
  "SEND_LINK",
  "NONE",
];

/** Map stored / legacy values to a radio the Appointments step can show and save. */
export function normalizeWizardBookingStrategy(
  state: AppointmentReceptionistWizardState,
): AppointmentReceptionistWizardState {
  let strategy = state.bookingStrategy;
  if (strategy === "CALENDLY") strategy = "MICROSOFT_365";
  if (!strategy || !UI_BOOKING_STRATEGIES.includes(strategy)) {
    strategy = deriveBookingStrategyFromWizard(state);
    if (strategy === "CALENDLY") strategy = "MICROSOFT_365";
  }
  return syncAppointmentTypesWithBookingStrategy({
    ...state,
    bookingStrategy: strategy,
  });
}

export function effectiveBookingStrategyForUi(
  state: AppointmentReceptionistWizardState,
): VoiceWizardBookingStrategy {
  return normalizeWizardBookingStrategy(state).bookingStrategy ?? "MICROSOFT_365";
}

export function patchWizardBookingStrategy(
  state: AppointmentReceptionistWizardState,
  id: VoiceWizardBookingStrategy,
): Partial<AppointmentReceptionistWizardState> {
  const caps = new Set(state.capabilities);
  if (id === "NONE") {
    caps.delete("book_appointments");
    caps.add("take_messages");
  } else {
    caps.add("book_appointments");
  }
  const perm = bookingPermissionForStrategy(id as VoiceV2BookingStrategy);
  const next: Partial<AppointmentReceptionistWizardState> = {
    bookingStrategy: id,
    capabilities: [...caps],
    appointmentTypes: state.appointmentTypes.map((t) => ({
      ...t,
      bookingPermission: perm,
    })),
  };
  if (id === "MICROSOFT_365") {
    next.calendarProvider =
      state.calendarProvider === "calendly" ? "microsoft" : state.calendarProvider;
  }
  return next;
}
