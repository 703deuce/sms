import type { BookingProtectionMode } from "@/lib/appointments/types";

export type BookingAppointmentType = {
  id: string;
  name: string;
  duration: string;
  description: string;
};

export type BookingWhyBookItem = {
  icon: "clock" | "shield" | "message";
  title: string;
  text: string;
};

export type BookingProtectionOption = {
  id: BookingProtectionMode;
  name: string;
  description: string;
};

export type SuspiciousBookingItem = {
  id: string;
  at: string;
  serviceName?: string;
  riskLevel: string;
  action: string;
  signals: string[];
};

export type BookingPageModel = {
  workspaceName: string;
  workspaceSlug: string;
  bookingUrl: string;
  bookingPath: string;
  hasSlug: boolean;
  bookingEnabled: boolean;
  businessInfo: {
    displayName: string;
    timezone: string;
    phone: string;
    address: string;
  };
  smsConsent: {
    wording: string;
    termsUrl: string;
    privacyUrl: string;
    termsText: string;
    termsVersion: string;
  };
  protectionMode: BookingProtectionMode;
  protectionOptions: BookingProtectionOption[];
  suspiciousBookings: SuspiciousBookingItem[];
  appointmentTypes: BookingAppointmentType[];
  whyBookItems: BookingWhyBookItem[];
};

export type BookingPageActions = {
  onToggleBooking: (enabled: boolean) => void;
  onCopyLink: () => void;
  onOpenBooking: () => void;
  onBusinessFieldChange: (
    field: keyof BookingPageModel["businessInfo"],
    value: string,
  ) => void;
  onSaveBusinessInfo: () => void;
  onConsentFieldChange: (
    field: keyof BookingPageModel["smsConsent"],
    value: string,
  ) => void;
  onSaveConsent: () => void;
  onProtectionModeChange: (mode: BookingProtectionMode) => void;
  onRetry: () => void;
};
