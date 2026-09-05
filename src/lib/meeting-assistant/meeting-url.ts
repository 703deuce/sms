import "server-only";

import type { AppointmentMetadata } from "@/lib/appointments/types";
import { detectMeetingPlatform, isSupportedMeetingUrl } from "./platform";

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/i;

export function extractMeetingUrlFromText(text?: string | null): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith("http")) return trimmed;
  const match = trimmed.match(URL_IN_TEXT_RE);
  return match?.[0] || null;
}

export function resolveMeetingUrlFromMetadata(meta: AppointmentMetadata): string | null {
  const candidates = [
    meta.meetingUrl,
    meta.joinUrl,
    meta.eventUrl,
    typeof meta.location === "string" ? meta.location : null,
  ];
  for (const c of candidates) {
    const url = extractMeetingUrlFromText(typeof c === "string" ? c : null);
    if (url && isSupportedMeetingUrl(url)) return url;
  }
  return null;
}

/** Server-side meeting URL resolution for appointments (metadata + location label). */
export function resolveMeetingUrlForAppointment(meta: AppointmentMetadata): string | null {
  const direct = resolveMeetingUrlFromMetadata(meta);
  if (direct) return direct;
  const locationUrl = extractMeetingUrlFromText(meta.location);
  if (locationUrl && isSupportedMeetingUrl(locationUrl)) return locationUrl;
  return null;
}

export function detectPlatformFromAppointmentMeta(meta: AppointmentMetadata): string | null {
  const url = resolveMeetingUrlForAppointment(meta);
  if (!url) return null;
  return detectMeetingPlatform(url);
}
