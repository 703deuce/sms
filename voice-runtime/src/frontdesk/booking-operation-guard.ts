import { llm } from "@livekit/agents";
import type { FrontDeskUserData } from "./userdata";
import { calendarToolBlockedReason } from "./booking-operation";
import { toolFeedbackBookingInProgress } from "../tool-feedback";

export function guardCalendarTool(ud: FrontDeskUserData, toolName: string): void {
  const reason = calendarToolBlockedReason(ud, toolName);
  if (reason) throw new llm.ToolError(reason);
}

export function calendarToolGuardFeedback(ud: FrontDeskUserData, toolName: string) {
  const reason = calendarToolBlockedReason(ud, toolName);
  if (!reason) return null;
  return toolFeedbackBookingInProgress(toolName);
}
