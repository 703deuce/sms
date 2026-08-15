import { llm } from "@livekit/agents";
import type { FrontDeskUserData } from "./userdata";
import { calendarToolBlockedReason } from "./booking-operation";

export function guardCalendarTool(ud: FrontDeskUserData, toolName: string): void {
  const reason = calendarToolBlockedReason(ud, toolName);
  if (reason) throw new llm.ToolError(reason);
}
