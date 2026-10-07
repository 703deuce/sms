import { DEFAULT_SMS_CONSENT_TEXT } from "./sms-consent-disclosure";
import type { VoiceRemindersPlatformConfig } from "@/lib/appointment-voice-reminders/types";

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "awaiting_confirmation"
  | "reschedule_requested"
  | "completed"
  | "canceled"
  | "cancelled"
  | "no_show";

export type ReminderChannel = "sms" | "email" | "voice";

export type ConfirmationSource = "sms" | "email" | "voice" | "web" | "staff" | "workflow" | "api";

export type ReminderStepConfig = {
  enabled: boolean;
  channel: ReminderChannel;
  minutesBefore?: number;
  timeOfDay?: import("@/lib/appointments/scheduling-capabilities").ReminderTimeOfDay;
  skipWeekends?: boolean;
  skipClosedDays?: boolean;
  skipOffHours?: boolean;
  stopOnReply?: boolean;
  template: string;
  label: string;
  /** Voice reminder template when channel is voice */
  voiceReminderTemplateId?: string;
};

export type DateOverride = {
  date: string;
  closed?: boolean;
  windows?: Array<{ open: string; close: string }>;
};

export type BookingProtectionMode = "standard" | "strict" | "off";

export type BookingQuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "multiselect"
  | "date";

export type BookingQuestion = {
  id: string;
  label: string;
  description?: string;
  type: BookingQuestionType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  displayOrder?: number;
  active?: boolean;
};

export type StaffAssignmentMode =
  | "any_eligible"
  | "specific_staff"
  | "customer_chooses"
  | "round_robin"
  | "priority"
  | "maximize_availability"
  | "collective";

/** How customers pick a provider on public booking (orthogonal to auto-assignment algorithm). */
export type CustomerStaffSelectionMode =
  | "customer_must_choose"
  | "customer_may_choose_or_any"
  | "auto_assign_hidden";

/** Algorithm when the system must pick among eligible staff. */
export type AutoAssignmentMethod =
  | "round_robin"
  | "priority"
  | "maximize_availability"
  | "first_eligible";

export type StaffRoutingConfig = {
  defaultCustomerSelection?: CustomerStaffSelectionMode;
  defaultAutoMethod?: AutoAssignmentMethod;
  /** Workspace-wide priority order (staff ids); per-service order may override. */
  workspaceStaffPriorityOrder?: string[];
  rescheduleWhenStaffUnavailable?: "require_new_slot" | "auto_reroute";
  /** When true, cancelled routed bookings still count toward round-robin balance. */
  countCancelledTowardBalance?: boolean;
  /** When true, manual admin assignments count toward round-robin balance. */
  countManualTowardBalance?: boolean;
};

export type BookableStaffMember = {
  id: string;
  name: string;
  active?: boolean;
  /** When false, hidden from customer staff picker */
  customerSelectable?: boolean;
  appointmentTypeIds?: string[];
  locationIds?: string[];
  /** Linked calendar connection for per-staff busy blocking */
  calendarConnectionId?: string;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
  dateOverrides?: DateOverride[];
  blackoutDates?: string[];
  /** Customer-facing display name (falls back to `name`) */
  publicDisplayName?: string;
  /** Job / role label shown to customers */
  title?: string;
  email?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;
  /** Legacy alias used in some editors */
  role?: string;
  createdAt?: string;
};

export type AppointmentLocation = {
  id: string;
  name: string;
  address?: string;
  timezone?: string;
  kind?: "office" | "store" | "branch" | "customer" | "phone" | "video" | "transovo_video" | "custom";
  active?: boolean;
  /** Staff who work at this location */
  staffIds?: string[];
  /** Appointment types offered here (empty = all) */
  appointmentTypeIds?: string[];
  /** Per-location weekly hours override */
  weeklyHours?: import("@/lib/appointments/availability-engine-policy").WeeklyHours;
  /** Scheduling resources available at this location (empty = all) */
  resourceIds?: string[];
};

export type BookingLimitConfig = {
  maxBookingsPerDay?: number;
  maxBookingsPerWeek?: number;
  maxBookingsPerMonth?: number;
  maxPerTypePerDay?: number;
};

export type CancellationPolicy = {
  allowed: "anytime" | "until_hours_before" | "disabled";
  cutoffHours?: number;
  policyText?: string;
};

export type ReschedulePolicy = {
  allowed: "anytime" | "until_hours_before" | "disabled";
  cutoffHours?: number;
  policyText?: string;
};

export type PaymentRequirement = {
  mode:
    | "none"
    | "optional"
    | "deposit"
    | "full"
    | "deposit_fixed"
    | "deposit_percent"
    | "customer_choice"
    | "pay_what_you_want"
    | "save_card";
  /** Connected merchant processor — funds settle to business, not Transovo */
  provider?: "stripe" | "square";
  priceCents?: number;
  depositCents?: number;
  depositPercent?: number;
  currency?: string;
  payWhatYouWant?: {
    enabled?: boolean;
    minimumCents?: number;
    suggestedCents?: number;
    presetCents?: number[];
  };
  tipping?: {
    enabled?: boolean;
    suggestedPercentages?: number[];
    suggestedAmountCents?: number[];
    allowCustom?: boolean;
  };
  allowSavedCard?: boolean;
  dynamicPricing?: {
    basePriceCents: number;
    finalPriceCents: number;
    adjustments: Array<{
      ruleId: string;
      ruleName: string;
      adjustmentType: string;
      adjustmentValue: number;
      deltaCents: number;
    }>;
  };
  couponCode?: string;
  couponDiscountCents?: number;
  couponRedemptionId?: string;
};

export type RoutingRule = {
  id: string;
  name?: string;
  conditions: Array<{
    field: string;
    operator: "equals" | "not_equals";
    value: string;
  }>;
  logic?: "and" | "or";
  destination: {
    appointmentTypeId?: string;
    staffPoolIds?: string[];
    staffId?: string;
    schedulingGroupId?: string;
    locationId?: string;
    externalUrl?: string;
  };
};

export type GroupBookingConfig = {
  enabled?: boolean;
  capacity?: number;
};

export type RecurringConfig = {
  enabled?: boolean;
  allowedFrequencies?: Array<"weekly" | "biweekly" | "monthly">;
  maxOccurrences?: number;
};

/** `simple` = meetings/services only on public booking (Appointment Reminders default). */
export type PublicBookingProfile = "simple" | "full";

export type AppointmentPlatformConfig = {
  bookingEnabled: boolean;
  publicBookingProfile?: PublicBookingProfile;
  timezone: string;
  businessPhone?: string;
  businessAddress?: string;
  businessDisplayName?: string;
  consentText?: string;
  consentVersion?: string;
  termsUrl?: string;
  termsVersion?: string;
  termsText?: string;
  privacyUrl?: string;
  onboardingComplete?: boolean;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
  dateOverrides?: DateOverride[];
  blackoutDates?: string[];
  minimumBookingNoticeMinutes?: number;
  maximumBookingDaysAhead?: number;
  bookingProtection?: {
    mode: BookingProtectionMode;
  };
  suspiciousBookings?: Array<{
    id: string;
    at: string;
    serviceName?: string;
    phone?: string;
    email?: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    riskScore: number;
    signals: string[];
    action: "challenge" | "block";
    recovered?: boolean;
  }>;
  /** Multi-staff scheduling */
  staff?: BookableStaffMember[];
  /** Multiple locations */
  locations?: AppointmentLocation[];
  /** Deterministic routing rules */
  routingRules?: RoutingRule[];
  /** Workspace-level booking limits */
  bookingLimits?: BookingLimitConfig;
  /** Acuity-class slot density / fixed-start controls (workspace default) */
  schedulingLimits?: import("@/lib/appointments/service-booking/types").SchedulingLimitsConfig;
  /** Round-robin assignment tracking */
  roundRobinState?: Record<string, { lastAssignedStaffId?: string; counts?: Record<string, number> }>;
  /** External calendar blocking */
  externalCalendarBlocking?: {
    enabled?: boolean;
    connectionIds?: string[];
    calendarIds?: string[];
  };
  namedSchedules?: import("@/lib/appointments/scheduling-capabilities").NamedAvailabilitySchedule[];
  holidays?: import("@/lib/appointments/scheduling-capabilities").HolidayCalendarEntry[];
  routingForms?: import("@/lib/appointments/scheduling-capabilities").RoutingForm[];
  schedulingGroups?: import("@/lib/appointments/scheduling-capabilities").SchedulingGroup[];
  /** Workspace defaults for staff assignment routing (Services/Meetings may override). */
  staffRouting?: StaffRoutingConfig;
  teamBookingPages?: import("@/lib/appointments/scheduling-capabilities").TeamBookingPage[];
  teamBookingTemplates?: import("@/lib/appointments/team-booking/types").TeamBookingTemplate[];
  teamBookingDefaults?: import("@/lib/appointments/team-booking/types").TeamBookingServiceConfig;
  organizationPolicy?: import("@/lib/appointments/scheduling-capabilities").OrganizationSchedulingPolicy;
  singleUseLinks?: import("@/lib/appointments/scheduling-capabilities").SingleUseBookingLink[];
  meetingPolls?: import("@/lib/appointments/scheduling-capabilities").MeetingPoll[];
  reminders: {
    confirmation: ReminderStepConfig;
    reminder24h: ReminderStepConfig;
    reminder2h: ReminderStepConfig;
    /** Optional extra timed steps — same runtime as core reminders. */
    additionalSteps?: Array<ReminderStepConfig & { id: string }>;
  };
  /** Automated outbound voice reminder templates and settings */
  voiceReminders?: VoiceRemindersPlatformConfig;
  /** Appointment Reminders — AI Rescheduler (SMS C/R/X + optional AI calendar mutation). */
  aiRescheduler?: import("@/lib/appointment-reminders/ai-rescheduler/types").AiReschedulerConfig;
  /** Workspace-wide booking commerce defaults (offering config may override). */
  commerceDefaults?: CommerceDefaults;
};

export type CommerceDefaults = {
  /** Default collection when an offering does not set payment.mode explicitly. */
  paymentMode?: "none" | "full" | "deposit";
  depositType?: "fixed" | "percent";
  depositCents?: number;
  depositPercent?: number;
  defaultProvider?: "stripe" | "square";
  /** Show promo code field on public checkout when supported. */
  allowPromoCodes?: boolean;
  /** How remaining balance after deposit is expected to be collected. */
  balanceDueBehavior?: "at_appointment" | "manual" | "invoice";
};

/** Booking archetype — MEETING (minimal), SERVICE (commerce/recurrence), CLASS (group/capacity). */
export type BookingTypeKind = "MEETING" | "SERVICE" | "CLASS";

export type AppointmentTypeConfig = {
  /** Canonical archetype; defaults to SERVICE when unset (legacy types). */
  bookingTypeKind?: BookingTypeKind;
  /**
   * CLASS-only UI segment: recurring class series vs one-off workshop/event.
   * Same scheduling engine; separate customer-facing management in Booking Types.
   */
  classPresentation?: "recurring_class" | "workshop_event";
  enabled?: boolean;
  description?: string;
  location?: string;
  locationId?: string;
  /** Join URL for link-based meeting methods (Zoom, Webex, custom link). */
  meetingLink?: string;
  priceDisplay?: string;
  bookingHours?: string;
  minimumBookingNoticeMinutes?: number;
  maximumBookingDaysAhead?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  timezone?: string;
  visibility?: import("@/lib/appointments/scheduling-capabilities").EventTypeVisibility;
  managed?: boolean;
  displayOrder?: number;
  durationOptions?: import("@/lib/appointments/scheduling-capabilities").DurationOption[];
  permissions?: import("@/lib/appointments/scheduling-capabilities").EventTypePermission[];
  /** Team / scheduling group that owns this event type */
  ownerTeamId?: string;
  bookingApproval?: import("@/lib/appointments/scheduling-capabilities").BookingApprovalConfig;
  redirectAfterBooking?: import("@/lib/appointments/scheduling-capabilities").BookingRedirectConfig;
  confirmationPage?: import("@/lib/appointments/scheduling-capabilities").ConfirmationPageResources;
  bookingQuestions?: BookingQuestion[];
  staffAssignment?: StaffAssignmentMode;
  /** Explicit priority order for `priority` assignment (staff ids). */
  staffPriorityOrder?: string[];
  /** When true, public booking may offer "Any available" alongside named staff. */
  allowAnyAvailable?: boolean;
  /** When true, inherit workspace `staffRouting` defaults instead of custom staffAssignment encoding. */
  useWorkspaceRoutingDefault?: boolean;
  staffIds?: string[];
  groupCapacity?: number;
  collectiveStaffIds?: string[];
  /** Multi-staff team booking requirements (distinct from single-staff routing). */
  teamBooking?: import("@/lib/appointments/team-booking/types").TeamBookingServiceConfig;
  locationIds?: string[];
  bookingLimits?: BookingLimitConfig;
  cancellationPolicy?: CancellationPolicy;
  reschedulePolicy?: ReschedulePolicy;
  payment?: PaymentRequirement;
  groupBooking?: GroupBookingConfig;
  recurring?: RecurringConfig;
  /** Reusable named availability schedule */
  namedScheduleId?: string;
  categoryId?: string;
  imageUrl?: string;
  schedulingLimits?: import("@/lib/appointments/service-booking/types").SchedulingLimitsConfig;
  extendedCancellationPolicy?: import("@/lib/appointments/service-booking/types").ExtendedCancellationPolicy;
  extendedReschedulePolicy?: import("@/lib/appointments/service-booking/types").ExtendedReschedulePolicy;
  addOnIds?: string[];
  resourceIds?: string[];
  /** Intake forms assigned to this booking type */
  intakeFormIds?: string[];
  /** AI Notetaker defaults for this appointment type */
  notetaker?: import("@/lib/meeting-assistant/types").EventTypeNotetakerConfig;
  /** Transovo Video defaults for this appointment type */
  transovoVideo?: import("@/lib/transovo-video/types").EventTypeVideoConfig;
};

export type AppointmentTimelineEvent = {
  at: string;
  type: string;
  label: string;
  detail?: string;
};

export type AppointmentMetadata = {
  source?: "admin" | "public_booking" | "calendly" | "voice" | "waitlist";
  inviteeName?: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  confirmToken?: string;
  cancelToken?: string;
  rescheduleToken?: string;
  smsConsent?: boolean;
  smsConsentAt?: string;
  smsConsentVersion?: string;
  smsConsentText?: string;
  reminderStatus?: string;
  reminderGeneration?: number;
  remindersSuppressed?: boolean;
  reminderSentKeys?: string[];
  timeline?: AppointmentTimelineEvent[];
  bookingAnswers?: Record<string, string>;
  location?: string;
  locationId?: string;
  staffId?: string;
  /** All staff participating in a team booking (includes primary). */
  teamStaffIds?: string[];
  teamAssignments?: Array<{ requirementId: string; staffId: string; label?: string }>;
  primaryStaffId?: string;
  paymentStatus?: string;
  paymentProvider?: string;
  paymentAmountCents?: number;
  totalPriceCents?: number;
  depositPaidCents?: number;
  balanceDueCents?: number;
  amountDueCents?: number;
  merchantPaymentId?: string;
  providerPaymentId?: string;
  providerSessionId?: string;
  refundAmountCents?: number;
  refundStatus?: string;
  paymentHoldExpiresAt?: string;
  paymentAbandonedAt?: string;
  paymentCheckoutUrl?: string;
  initiatedBy?: "customer" | "staff" | "system" | "api" | "workflow";
  lastChangeInitiatedBy?: "customer" | "staff" | "system" | "api" | "workflow";
  confirmationSource?: ConfirmationSource;
  meetingUrl?: string;
  joinUrl?: string;
  videoMeetingId?: string;
  notetakerEnabled?: boolean;
  meetingSessionId?: string;
  locationKind?: string;
  eventUrl?: string;
  recurringSeriesId?: string;
  recurringOccurrenceIndex?: number;
  attendeeCount?: number;
  waitlistEntryId?: string;
  manageAppointmentUrl?: string;
  manageAppointmentTokenIssuedAt?: string;
  bookingSource?: string;
  utm?: import("@/lib/appointments/scheduling-capabilities").UtmAttribution;
  reminderOverride?: import("@/lib/appointments/scheduling-capabilities").AppointmentReminderOverride;
  emailTracking?: Record<string, { sentAt?: string; opens?: number; clicks?: number }>;
  extraRecipients?: Array<{ email?: string; phone?: string; name?: string }>;
  internalNotes?: Array<{ id: string; at: string; authorId?: string; authorName?: string; body: string }>;
  notes?: string;
  [key: string]: unknown;
};

export { DEFAULT_SMS_CONSENT_TEXT };

export const DEFAULT_REMINDER_TEMPLATES = {
  confirmation:
    "Hi {{first_name}}, your {{service}} with {{business_name}} is confirmed for {{appointment_date}} at {{appointment_time}}.{{join_meeting_line}} Manage: {{manage_link}} Reply YES to confirm.",
  reminder24h:
    "Reminder: {{service}} with {{business_name}} tomorrow at {{appointment_time}}.{{join_meeting_line}} Manage: {{manage_link}} Reply YES to confirm.",
  reminder2h:
    "Reminder: {{service}} with {{business_name}} today at {{appointment_time}}.{{join_meeting_line}} Manage: {{manage_link}}",
};

export const DEFAULT_PLATFORM_CONFIG: AppointmentPlatformConfig = {
  bookingEnabled: false,
  publicBookingProfile: "simple",
  timezone: "America/New_York",
  consentText: DEFAULT_SMS_CONSENT_TEXT,
  consentVersion: "v1",
  termsUrl: "/terms",
  privacyUrl: "/privacy",
  minimumBookingNoticeMinutes: 60,
  maximumBookingDaysAhead: 14,
  bookingProtection: { mode: "standard" },
  reminders: {
    confirmation: {
      enabled: true,
      channel: "sms",
      label: "Booking confirmation",
      template: DEFAULT_REMINDER_TEMPLATES.confirmation,
    },
    reminder24h: {
      enabled: true,
      channel: "sms",
      minutesBefore: 1440,
      label: "24-hour reminder",
      template: DEFAULT_REMINDER_TEMPLATES.reminder24h,
    },
    reminder2h: {
      enabled: true,
      channel: "sms",
      minutesBefore: 120,
      label: "2-hour reminder",
      template: DEFAULT_REMINDER_TEMPLATES.reminder2h,
    },
  },
  aiRescheduler: {
    mode: "notify",
    approval: "automatic",
    weeklyHours: {
      monday: { enabled: true, open: "09:00", close: "17:00" },
      tuesday: { enabled: true, open: "09:00", close: "17:00" },
      wednesday: { enabled: true, open: "09:00", close: "17:00" },
      thursday: { enabled: true, open: "09:00", close: "17:00" },
      friday: { enabled: true, open: "09:00", close: "17:00" },
      saturday: { enabled: false, open: "09:00", close: "12:00" },
      sunday: { enabled: false, open: "09:00", close: "12:00" },
    },
    durationMode: "original",
    minimumNoticeMinutes: 120,
    maximumDaysAhead: 60,
    bufferMinutes: 0,
    allowProviderCancel: false,
  },
};

export function normalizeAppointmentStatus(status: string): AppointmentStatus {
  const s = status.toLowerCase();
  if (s === "cancelled") return "canceled";
  if (s === "confirmed") return "confirmed";
  if (s === "awaiting_confirmation") return "awaiting_confirmation";
  if (s === "reschedule_requested") return "reschedule_requested";
  if (s === "completed") return "completed";
  if (s === "no_show" || s === "no-show") return "no_show";
  if (s === "scheduled") return "scheduled";
  if (s === "canceled") return "canceled";
  return "scheduled";
}

export function statusLabel(status: string): string {
  switch (normalizeAppointmentStatus(status)) {
    case "confirmed":
      return "Confirmed";
    case "awaiting_confirmation":
      return "Awaiting confirmation";
    case "reschedule_requested":
      return "Reschedule requested";
    case "completed":
      return "Completed";
    case "canceled":
      return "Canceled";
    case "no_show":
      return "No-show";
    default:
      return "Scheduled";
  }
}

export function lastCommunicationLabel(metadata: AppointmentMetadata): string | null {
  const timeline = metadata.timeline || [];
  const last = timeline[timeline.length - 1];
  return last?.label || null;
}
