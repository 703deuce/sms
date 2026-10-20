import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceWizardBookingStrategy } from "../config/booking-strategies";

/** Wizard strategies that use the same Voice V3 find/book/manage tool surface (provider resolved at runtime). */
export const DIRECT_CALENDAR_BOOKING_STRATEGIES: VoiceWizardBookingStrategy[] = [
  "MICROSOFT_365",
  "GOOGLE_CALENDAR",
];

export function isDirectCalendarBookingStrategy(
  strategy: VoiceWizardBookingStrategy | undefined | null,
): boolean {
  if (!strategy) return false;
  return (DIRECT_CALENDAR_BOOKING_STRATEGIES as string[]).includes(strategy);
}

export function isDirectCalendarBookingConfig(config: VoiceV3AgentConfig): boolean {
  return isDirectCalendarBookingStrategy(config.scheduling?.bookingStrategy);
}

export function calendarProviderForBookingStrategy(
  strategy: VoiceWizardBookingStrategy | undefined | null,
): "microsoft" | "google" | null {
  if (strategy === "MICROSOFT_365") return "microsoft";
  if (strategy === "GOOGLE_CALENDAR") return "google";
  return null;
}

export function calendarProviderForConfig(
  config: VoiceV3AgentConfig,
): "microsoft" | "google" | null {
  const fromStrategy = calendarProviderForBookingStrategy(config.scheduling?.bookingStrategy);
  if (fromStrategy) return fromStrategy;
  const p = config.calendar?.provider;
  if (p === "microsoft" || p === "google") return p;
  return null;
}
