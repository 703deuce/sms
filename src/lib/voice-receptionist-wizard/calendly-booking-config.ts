import "server-only";

import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { resolveVoiceV2BookingStrategy } from "./booking-strategy";

export type VoiceV2CalendlyPublishedConfig = {
  eventTypeUri: string;
  eventTypeName: string;
  durationMinutes: number;
  timezone: string;
};

const ADV_KEY = "voiceV2Calendly";

export function calendlyConfigFromAdvanced(
  advanced?: Record<string, unknown> | null,
): VoiceV2CalendlyPublishedConfig | null {
  const raw = advanced?.[ADV_KEY];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const eventTypeUri = String(o.eventTypeUri || "").trim();
  if (!eventTypeUri) return null;
  const duration = Number(o.durationMinutes || 30);
  return {
    eventTypeUri,
    eventTypeName: String(o.eventTypeName || "Appointment").trim(),
    durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 30,
    timezone: String(o.timezone || "America/New_York").trim() || "America/New_York",
  };
}

export function calendlyConfigFromWizard(
  state: AppointmentReceptionistWizardState,
): VoiceV2CalendlyPublishedConfig | null {
  const eventTypeUri = String(state.calendlyEventTypeUri || "").trim();
  if (!eventTypeUri) return null;
  const duration = Number(state.calendlyEventTypeDurationMin || 30);
  return {
    eventTypeUri,
    eventTypeName: String(state.calendlyEventTypeName || "Appointment").trim(),
    durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 30,
    timezone: String(state.calendlyTimezone || "America/New_York").trim() || "America/New_York",
  };
}

export function resolveVoiceV2CalendlyBookingConfig(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): VoiceV2CalendlyPublishedConfig | null {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const fromPinned = calendlyConfigFromAdvanced(advanced);
  if (fromPinned) return fromPinned;
  const wizard = advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
  if (wizard) return calendlyConfigFromWizard(wizard);
  return null;
}

export function assertPublishableCalendlyBooking(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): { ok: true } | { ok: false; reason: string } {
  const strategy = resolveVoiceV2BookingStrategy(config);
  if (strategy !== "CALENDLY") return { ok: true };
  const cal = resolveVoiceV2CalendlyBookingConfig(config);
  if (!cal?.eventTypeUri) {
    return {
      ok: false,
      reason: "Select a Calendly event type before publishing live Calendly booking.",
    };
  }
  return { ok: true };
}

/** Calendly Scheduling API requires invitee email for POST /invitees. */
export function voiceV2CalendlyRequiresEmail(): boolean {
  return true;
}
