/**
 * Microsoft calendar write/read primitives for Appointment Reminders SMS.
 *
 * These modules live under voice-v3/calendar/microsoft because Voice V3 proved them
 * on production Graph. AR SMS imports them here — it does NOT call Voice V3 tools,
 * dispatchRescheduleIfRequired, live call context, or the agent tool gateway.
 *
 * Date/time for SMS conversation → ISO instants is handled by appointments ai-scheduling
 * (understand/resolver/date-utils). This layer only applies mutations Graph expects.
 */
export { executeMicrosoftUpdateBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-update-booking";
export type {
  MicrosoftUpdateBookingRequest,
  MicrosoftUpdateBookingResult,
} from "@/lib/voice-v3/calendar/microsoft/microsoft-update-booking";
export { executeMicrosoftCancelBooking } from "@/lib/voice-v3/calendar/microsoft/microsoft-cancel-booking";
export { validateMicrosoftAppointmentBeforeMutation } from "@/lib/voice-v3/calendar/microsoft/validate-microsoft-appointment";
export { fetchMicrosoftBusyIntervals } from "@/lib/voice-v3/calendar/microsoft/microsoft-find-availability";
export { fetchMicrosoftEventById } from "@/lib/voice-v3/calendar/microsoft/microsoft-get-event";
export type { ExistingAppointment } from "@/lib/voice-v3/calendar/appointment-management-types";
export {
  filterBusyForReschedule,
  generateAvailabilitySlots,
} from "@/lib/voice-v3/calendar/slot-generator";
export type {
  CalendarBusyInterval,
  BusinessHoursWindow,
} from "@/lib/voice-v3/calendar/types";
