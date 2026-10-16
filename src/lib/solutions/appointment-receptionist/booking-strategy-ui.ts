import type {
  AppointmentReceptionistWizardState,
  VoiceWizardBookingStrategy,
} from "./types";
import {
  bookingPermissionForStrategy,
  type VoiceV2BookingStrategy,
} from "@/lib/voice-receptionist-wizard/booking-strategy";

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
