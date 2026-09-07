import type {
  BookingQuestion,
  GroupBookingConfig,
  PaymentRequirement,
  RecurringConfig,
  StaffAssignmentMode,
} from "@/lib/appointments/types";

export type DurationOption = { id: string; label: string; minutes: number; active?: boolean };

export type ConfirmationResources = {
  headline?: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  attachmentUrls?: string[];
};

export type PublicBookingType = {
  id: string;
  name: string;
  durationMinutes: number;
  durationOptions?: DurationOption[];
  confirmationPage?: ConfirmationResources;
  config?: {
    description?: string;
    location?: string;
    priceDisplay?: string;
    bookingQuestions?: BookingQuestion[];
    staffAssignment?: StaffAssignmentMode;
    staffIds?: string[];
    locationIds?: string[];
    payment?: PaymentRequirement;
    groupBooking?: GroupBookingConfig;
    recurring?: RecurringConfig;
    durationOptions?: DurationOption[];
    confirmationPage?: ConfirmationResources;
  };
};

export type PublicStaffOption = { id: string; name: string };
export type PublicLocationOption = { id: string; name: string; kind?: string; address?: string };
export type PublicSlot = { startsAt: string; endsAt: string; remaining?: number; capacity?: number };

export type PublicBookingWorkspace = {
  name: string;
  slug: string;
  timezone: string;
  businessPhone: string;
  businessAddress: string;
  consentText: string;
  termsUrl: string;
  privacyUrl: string;
  aiBookingEnabled?: boolean;
  waitlistEnabled?: boolean;
};

export type PublicBookingFlowOptions = {
  slug: string;
  initialServiceId?: string;
  preselectTypeId?: string;
  singleUseToken?: string;
  theme?: "light" | "dark" | "auto";
};

export type PublicBookingStep =
  | "service"
  | "datetime"
  | "info"
  | "done"
  | "ai"
  | "waitlist"
  | "payment"
  | "otp";

export type SquarePaymentConfig = {
  applicationId: string;
  locationId: string;
  amountCents: number;
  currency: string;
  sandbox?: boolean;
};
