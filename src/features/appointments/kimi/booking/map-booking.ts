import { DEFAULT_SMS_CONSENT_TEXT } from "@/lib/appointments/types";
import type { AppointmentPlatformConfig, BookingProtectionMode } from "@/lib/appointments/types";
import type {
  BookingAppointmentType,
  BookingPageModel,
  SuspiciousBookingItem,
} from "./types";

export type BookingSettingsApiData = AppointmentPlatformConfig & {
  suspiciousBookings?: SuspiciousBookingItem[];
};

export type BookingTypeApiRow = {
  id: string;
  name: string;
  durationMinutes: number;
  config?: { description?: string; enabled?: boolean };
};

const PROTECTION_OPTIONS = [
  {
    id: "standard" as BookingProtectionMode,
    name: "Standard",
    description: "Challenge suspicious bookings with a confirmation step.",
  },
  {
    id: "strict" as BookingProtectionMode,
    name: "Strict",
    description: "Block high-risk bookings and challenge medium risk.",
  },
  {
    id: "off" as BookingProtectionMode,
    name: "Off",
    description: "Accept all bookings without risk screening.",
  },
];

const WHY_BOOK_ITEMS = [
  { icon: "clock" as const, title: "Fast & Easy", text: "Book in just a few clicks." },
  {
    icon: "shield" as const,
    title: "Secure & Private",
    text: "Your information is always protected.",
  },
  {
    icon: "message" as const,
    title: "SMS Reminders",
    text: "Get timely reminders on your phone.",
  },
];

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function mapAppointmentTypes(rows: BookingTypeApiRow[]): BookingAppointmentType[] {
  return rows
    .filter((row) => row.config?.enabled !== false)
    .map((row) => ({
      id: row.id,
      name: row.name,
      duration: formatDuration(row.durationMinutes),
      description: row.config?.description || "Book this appointment type online.",
    }));
}

export function buildBookingPageModel(input: {
  settings: BookingSettingsApiData;
  types: BookingTypeApiRow[];
  workspaceSlug: string;
  workspaceName: string;
  origin?: string;
}): BookingPageModel {
  const { settings, types, workspaceSlug, workspaceName } = input;
  const bookingPath = workspaceSlug ? `/book/${workspaceSlug}` : "";
  const bookingUrl =
    input.origin && bookingPath ? `${input.origin}${bookingPath}` : bookingPath;

  return {
    workspaceName,
    workspaceSlug,
    bookingUrl,
    bookingPath,
    hasSlug: Boolean(workspaceSlug),
    bookingEnabled: Boolean(settings.bookingEnabled),
    businessInfo: {
      displayName: settings.businessDisplayName || workspaceName,
      timezone: settings.timezone || "America/New_York",
      phone: settings.businessPhone || "",
      address: settings.businessAddress || "",
    },
    smsConsent: {
      wording: settings.consentText || DEFAULT_SMS_CONSENT_TEXT,
      termsUrl: settings.termsUrl || "/terms",
      privacyUrl: settings.privacyUrl || "/privacy",
      termsText: settings.termsText || "",
      termsVersion: settings.termsVersion || "v1",
    },
    protectionMode: settings.bookingProtection?.mode || "standard",
    protectionOptions: PROTECTION_OPTIONS,
    suspiciousBookings: settings.suspiciousBookings || [],
    appointmentTypes: mapAppointmentTypes(types),
    whyBookItems: WHY_BOOK_ITEMS,
  };
}

export function businessInfoPatch(model: BookingPageModel) {
  return {
    businessDisplayName: model.businessInfo.displayName,
    timezone: model.businessInfo.timezone,
    businessPhone: model.businessInfo.phone,
    businessAddress: model.businessInfo.address,
  };
}

export function consentPatch(
  model: BookingPageModel,
  priorTermsText?: string,
) {
  const termsText = model.smsConsent.termsText.trim();
  const bumped =
    priorTermsText !== undefined && termsText !== (priorTermsText || "").trim();
  const termsVersion = bumped
    ? `v${Date.now()}`
    : model.smsConsent.termsVersion || "v1";
  return {
    consentText: model.smsConsent.wording,
    termsUrl: model.smsConsent.termsUrl,
    privacyUrl: model.smsConsent.privacyUrl,
    termsText: termsText || undefined,
    termsVersion,
  };
}
