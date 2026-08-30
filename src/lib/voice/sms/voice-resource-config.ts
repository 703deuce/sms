/**
 * Trusted resource configuration resolved from agent/workspace — not from the model.
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";

export const VOICE_RESOURCE_TYPES = [
  "booking",
  "quote",
  "financing",
  "directions",
  "photo_upload",
] as const;

export type VoiceResourceType = (typeof VOICE_RESOURCE_TYPES)[number];

const TEMPLATE_BY_RESOURCE: Record<VoiceResourceType, string> = {
  booking: "booking_link",
  quote: "quote_link",
  financing: "financing_link",
  directions: "directions",
  photo_upload: "quote_link",
};

export function resourceTypeToTemplateId(resourceType: string): string | null {
  const key = resourceType.trim().toLowerCase() as VoiceResourceType;
  return VOICE_RESOURCE_TYPES.includes(key) ? TEMPLATE_BY_RESOURCE[key] : null;
}

export function resolveVoiceResourceConfig(config?: VoiceAgentConfig | null): {
  booking: boolean;
  quote: boolean;
  financing: boolean;
  directions: boolean;
  photoUpload: boolean;
  smsEnabled: boolean;
  anyConfigured: boolean;
  enabledTypes: VoiceResourceType[];
  bookingUrl: string | null;
  websiteUrl: string | null;
  businessName: string | null;
} {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  const wizard = advanced.appointmentReceptionistWizard as
    | { businessName?: string; websiteUrl?: string }
    | undefined;

  const bookingUrl =
    process.env.HARBOR_BOOKING_LINK_URL?.trim() ||
    process.env.VOICE_BOOKING_LINK_URL?.trim() ||
    wizard?.websiteUrl?.trim() ||
    null;

  const enabledTypes: VoiceResourceType[] = ["booking", "quote", "financing", "directions"];
  if (bookingUrl) enabledTypes.push("photo_upload");

  return {
    booking: Boolean(bookingUrl),
    quote: Boolean(bookingUrl || wizard?.websiteUrl),
    financing: Boolean(wizard?.websiteUrl || bookingUrl),
    directions: Boolean(wizard?.websiteUrl || bookingUrl),
    photoUpload: Boolean(bookingUrl || wizard?.websiteUrl),
    smsEnabled: true,
    anyConfigured: Boolean(bookingUrl || wizard?.websiteUrl),
    enabledTypes,
    bookingUrl,
    websiteUrl: wizard?.websiteUrl?.trim() || null,
    businessName: wizard?.businessName?.trim() || null,
  };
}
