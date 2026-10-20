import type { VoiceV3AgentConfig } from "../config/agent-config";

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
  const microsoftBooking =
    config.scheduling?.bookingStrategy === "MICROSOFT_365" && calendarConnected;
  return {
    canBook:
      microsoftBooking && caps.bookAppointments && config.service.durationMinutes > 0,
    canReschedule: microsoftBooking && caps.rescheduleAppointments,
    canCancel: microsoftBooking && caps.cancelAppointments,
    canTransfer: caps.transferCalls,
    canTakeCallback: true,
    canTakeMessage: caps.takeMessages,
    calendarConnected,
  };
}
