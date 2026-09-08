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
  quantity: number;
  label?: string;
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

export type SchedulerThemeConfig = {
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  confirmationMessage?: string;
  noIndex?: boolean;
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
  | "signature";

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
