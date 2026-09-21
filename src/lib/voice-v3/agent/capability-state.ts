import type { VoiceV3AgentConfig } from "../config/agent-config";
import { isDirectCalendarBookingConfig } from "../calendar/direct-booking-strategy";

export interface VoiceV3Capabilities {
  canBook: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  canTransfer: boolean;
  canTakeCallback: boolean;
  canTakeMessage: boolean;
  calendarConnected: boolean;
}

export function deriveVoiceV3Capabilities(config: VoiceV3AgentConfig): VoiceV3Capabilities {
  const calendarConnected = Boolean(
    config.calendar?.connectionId?.trim() && config.calendar.calendarIds.length > 0,
  );
  const caps = config.capabilities;
  const directCalendarBooking =
    isDirectCalendarBookingConfig(config) && calendarConnected;
  return {
    canBook:
      directCalendarBooking && caps.bookAppointments && config.service.durationMinutes > 0,
    canReschedule: directCalendarBooking && caps.rescheduleAppointments,
    canCancel: directCalendarBooking && caps.cancelAppointments,
    canTransfer: caps.transferCalls,
    canTakeCallback: true,
    canTakeMessage: caps.takeMessages,
    calendarConnected,
  };
}
