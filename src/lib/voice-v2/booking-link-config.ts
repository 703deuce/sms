import type { VoiceAgentConfig } from "@/lib/voice/types";
import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { validateBookingLinkUrl } from "@/lib/mctb/booking-links/validate-url";
import { resolveVoiceV2BookingStrategy } from "./booking-strategy";

function wizardFromConfig(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): AppointmentReceptionistWizardState | undefined {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.appointmentReceptionistWizard as AppointmentReceptionistWizardState | undefined;
}

/** Trusted booking URL from pinned published config only — never from model/tool args. */
export function resolvePinnedBookingLink(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): { url: string; label: string } | null {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const pinned = String(advanced.bookingLink || "").trim();
  const wizard = wizardFromConfig(config);
  const fromWizard = String(wizard?.bookingLinkUrl || "").trim();
  const raw = pinned || fromWizard;
  if (!raw) return null;
  const validated = validateBookingLinkUrl(raw);
  if (!validated.ok) return null;
  const label =
    String(advanced.bookingLinkLabel || wizard?.bookingLinkLabel || "").trim() ||
    "Book your appointment";
  return { url: validated.url, label };
}

export function bookingLinkRequiredForStrategy(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  return resolveVoiceV2BookingStrategy(config) === "SEND_LINK";
}

export function assertPublishableBookingLink(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): { ok: true } | { ok: false; error: string } {
  if (!bookingLinkRequiredForStrategy(config)) return { ok: true };
  const link = resolvePinnedBookingLink(config);
  if (!link) {
    return { ok: false, error: "A valid https:// or http:// booking link is required for Send booking link mode." };
  }
  return { ok: true };
}
