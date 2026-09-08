export type CutoffUnit = "minutes" | "hours" | "days";

export type SchedulingCutoff = {
  enabled: boolean;
  unit?: CutoffUnit;
  value?: number;
};

export type AfterCutoffBehavior =
  | "block_contact_business"
  | "require_staff_approval"
  | "permit_late_fee"
  | "permit_consume_entitlement";

export type ExtendedCancellationPolicy = {
  allowed: "anytime" | "until_before" | "disabled";
  cutoff?: SchedulingCutoff;
  afterCutoff?: AfterCutoffBehavior;
  policyText?: string;
  lateFeeCents?: number;
};

export type ExtendedReschedulePolicy = {
  allowed: "anytime" | "until_before" | "disabled";
  cutoff?: SchedulingCutoff;
  afterCutoff?: AfterCutoffBehavior;
  policyText?: string;
  lateFeeCents?: number;
  preservePayment?: boolean;
  preserveEntitlements?: boolean;
};

export type FixedStartTimesConfig = {
  enabled: boolean;
  /** Allowed wall-clock starts in workspace timezone, e.g. ["09:00", "11:00", "13:30"] */
  times: string[];
  /** Optional per weekday overrides (monday … sunday) */
  perWeekday?: Partial<Record<string, string[]>>;
};

export type ClassCapacityDisplayMode = "exact" | "limited" | "hidden";

export type SchedulingLimitsConfig = {
  minimumBookingNoticeMinutes?: number;
  maximumBookingDaysAhead?: number;
  minimumCancellationNotice?: SchedulingCutoff;
  minimumRescheduleNotice?: SchedulingCutoff;
  clientRescheduleEnabled?: boolean;
  clientCancelEnabled?: boolean;
  clientIntakeEditEnabled?: boolean;
  intakeEditCutoff?: SchedulingCutoff;
  customStartIntervalMinutes?: number;
  appointmentDerivedIntervals?: boolean;
  /** Only allow booking at explicit start times (SimplyBook fixed-time mode). */
  fixedStartTimes?: FixedStartTimesConfig;
  /** Hide a percentage of otherwise-valid slots (“Make Me Look Busy”). 0–90. */
  availabilityDensityHidePercent?: number;
  minimizeGapsMode?: "off" | "prefer_compact";
  simultaneousAppointments?: number;
  maxAppointmentsPerDay?: number;
  maxAppointmentsPerWeek?: number;
  bookingLimits?: {
    maxBookingsPerDay?: number;
    maxBookingsPerWeek?: number;
    maxPerTypePerDay?: number;
  };
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  /** Public class/group capacity label mode */
  classCapacityDisplay?: ClassCapacityDisplayMode;
};

export type PayWhatYouWantConfig = {
  enabled: boolean;
  minimumCents: number;
  suggestedCents?: number;
  presetCents?: number[];
};

export type TippingConfig = {
  enabled: boolean;
  suggestedPercentages?: number[];
  suggestedAmountCents?: number[];
  allowCustom?: boolean;
};

export type ExtendedPaymentRequirement = {
  mode:
    | "none"
    | "optional"
    | "full"
    | "deposit_fixed"
    | "deposit_percent"
    | "customer_choice"
    | "pay_what_you_want"
    | "save_card";
  provider?: "stripe" | "square";
  priceCents?: number;
  depositCents?: number;
  depositPercent?: number;
  currency?: string;
  payWhatYouWant?: PayWhatYouWantConfig;
  tipping?: TippingConfig;
  allowSavedCard?: boolean;
};

export type PackageCreditRule = {
  bookingTypeId?: string;
  serviceName?: string;
  classSeriesId?: string;
  addOnId?: string;
  productId?: string;
  quantity: number;
  label?: string;
};

export type PackageLifecyclePolicy = {
  restoreCreditsOnCancel?: boolean;
  restoreCreditsOnLateCancel?: boolean;
  restoreCreditsOnNoShow?: boolean;
  validFromDaysAfterPurchase?: number;
};

export type MembershipBenefits = {
  includedCredits?: PackageCreditRule[];
  percentDiscount?: number;
  fixedDiscountCents?: number;
  memberOnlyTypeIds?: string[];
  earlyBookingDays?: number;
  multiLocationIds?: string[];
  householdSharing?: boolean;
  productDiscountPercent?: number;
};

export type RecurringEditScope = "this_only" | "this_and_future" | "entire_series";

export type BookingSource =
  | "public_page"
  | "direct_link"
  | "embedded"
  | "staff_created"
  | "client_portal"
  | "mctb"
  | "ai_booking"
  | "api"
  | "campaign"
  | "imported"
  | "calendar_convert";

export type ManageAppointmentPermissions = {
  view?: boolean;
  confirm?: boolean;
  reschedule?: boolean;
  cancel?: boolean;
  payBalance?: boolean;
  editIntake?: boolean;
  viewLocation?: boolean;
};

export type BookingTerminologyConfig = {
  staffLabel?: string;
  serviceLabel?: string;
  appointmentLabel?: string;
  bookButtonLabel?: string;
  locale?: string;
};

export type BookingChannelIntegrationStatus = {
  provider: "google_reserve" | "facebook" | "instagram" | "icloud_calendar";
  status: "not_connected" | "pending" | "active" | "error";
  externalId?: string;
  lastSyncedAt?: string;
  errorMessage?: string;
};

export type SchedulerThemeConfig = {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  confirmationMessage?: string;
  noIndex?: boolean;
  /** Hosted booking custom domain, e.g. book.example.com */
  customDomain?: string;
  /** Advanced booking-page CSS (SimplyBook / Acuity parity) */
  customCss?: string;
  terminology?: BookingTerminologyConfig;
  bookingChannels?: BookingChannelIntegrationStatus[];
};

export type CalendarColorConfig = {
  staffColors?: Record<string, string>;
  serviceColors?: Record<string, string>;
  defaultStaffColor?: string;
  defaultServiceColor?: string;
};

export type TermsAcceptanceSnapshot = {
  accepted: boolean;
  acceptedAt: string;
  termsVersion: string;
  termsTextHash: string;
  termsUrl?: string;
};

export type ServicePhaseKind = "active_staff" | "processing";

export type IntakeFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "multiselect"
  | "date"
  | "info"
  | "agreement"
  | "signature"
  | "file"
  | "image";

export type IntakeField = {
  id: string;
  label: string;
  type: IntakeFieldType;
  required?: boolean;
  options?: string[];
  conditionalOn?: { fieldId: string; value: string };
  placeholder?: string;
  helpText?: string;
};

export const APPOINTMENT_WEBHOOK_EVENTS = [
  "appointment.created",
  "appointment.rescheduled",
  "appointment.canceled",
  "appointment.updated",
  "package.purchased",
  "membership.started",
  "membership.updated",
  "membership.canceled",
  "class.enrolled",
  "waitlist.promoted",
] as const;

export type AppointmentWebhookEvent = (typeof APPOINTMENT_WEBHOOK_EVENTS)[number];
