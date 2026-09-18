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
  return {
    canBook: calendarConnected && config.service.durationMinutes > 0,
    canReschedule: calendarConnected,
    canCancel: calendarConnected,
    canTransfer: true,
    canTakeCallback: true,
    canTakeMessage: true,
    calendarConnected,
  };
}
