import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";

export type MctbAiBookingFulfillmentMode = "calendar" | "link_only";

/** Whether inbound SMS should call the live calendar orchestrator (Microsoft/Calendly) or only send a booking link. */
export function resolveSmsBookingFulfillmentMode(
  config: MctbAiBookingWorkspaceConfig,
): MctbAiBookingFulfillmentMode {
  return config.fulfillmentMode === "calendar" ? "calendar" : "link_only";
}

export function calendarFulfillmentEnabled(
  config: MctbAiBookingWorkspaceConfig,
): boolean {
  return resolveSmsBookingFulfillmentMode(config) === "calendar";
}
