/**
 * Extended scheduling / reminder / org capability types.
 * Single schema layer for platform config, appointment types, and calendar connections.
 */

export type NamedAvailabilitySchedule = {
  id: string;
  name: string;
  timezone?: string;
  weeklyHours: Record<string, Array<{ open: string; close: string }>>;
  dateOverrides?: Array<{ date: string; closed?: boolean; windows?: Array<{ open: string; close: string }> }>;
  holidayCalendarId?: string;
  isDefault?: boolean;
};

export type HolidayCalendarEntry = {
  date: string;
  name: string;
  closed?: boolean;
  windows?: Array<{ open: string; close: string }>;
};

export type EventTypeVisibility = "public" | "unlisted" | "secret";

export type EventTypePermission = {
  role: "owner" | "admin" | "scheduler" | "viewer";
  userId?: string;
  teamId?: string;
  canEdit?: boolean;
  canBook?: boolean;
  canView?: boolean;
};

export type DurationOption = {
  id: string;
  label: string;
  minutes: number;
  priceCents?: number;
  active?: boolean;
};

export type SingleUseBookingLink = {
  id: string;
  token: string;
  appointmentTypeId: string;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  createdBy?: string;
};

export type MeetingPollVoteValue = "yes" | "maybe" | "no";

export type MeetingPollOption = {
  id: string;
  startsAt: string;
  endsAt: string;
  /** @deprecated Legacy aggregate; use responses + scoring */
  votes?: number;
  archivedAt?: string;
};

export type MeetingPollParticipant = {
  id: string;
  name: string;
  email: string;
  contactId?: string;
  inviteToken: string;
  status: "invited" | "viewed" | "responded" | "removed" | "delivery_failed";
  lastActivityAt?: string;
  comment?: string;
};

export type MeetingPollResponse = {
  participantId: string;
  optionId: string;
  value: MeetingPollVoteValue;
  updatedAt: string;
};

export type MeetingPollActivityEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail?: string;
};

export type MeetingPollSettings = {
  allowMaybe: boolean;
  allowComments: boolean;
  allowResponseChanges: boolean;
  showNamesToParticipants: boolean;
  showAggregateBeforeResponse: boolean;
  deadlineBehavior: "mark_passed" | "auto_close";
  requireOrganizerFreeOnFinalize: boolean;
  autoReminderHoursBeforeDeadline?: number;
};

export type MeetingPollStatus =
  | "draft"
  | "open"
  | "closed"
  | "finalized"
  | "expired"
  | "cancelled";

export type MeetingPollMeetingMethod = "video" | "phone" | "in_person" | "custom";

export type MeetingPoll = {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  appointmentTypeId?: string;
  timezone: string;
  durationMinutes: number;
  meetingMethod?: MeetingPollMeetingMethod;
  location?: string;
  options: MeetingPollOption[];
  participants: MeetingPollParticipant[];
  responses: MeetingPollResponse[];
  settings: MeetingPollSettings;
  activity: MeetingPollActivityEntry[];
  status: MeetingPollStatus;
  shareToken: string;
  deadlineAt?: string;
  organizerStaffId?: string;
  organizerUserId?: string;
  winningOptionId?: string;
  finalizedOptionId?: string;
  bookedAppointmentId?: string;
  finalizeIdempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingApprovalConfig = {
  required: boolean;
  autoApproveWithinHours?: number;
  notifyStaff?: boolean;
};

export type BookingRedirectConfig = {
  enabled?: boolean;
  url?: string;
  includeQueryParams?: boolean;
};

export type ConfirmationPageResources = {
  headline?: string;
  bodyHtml?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  attachmentUrls?: string[];
};

export type EmbedBookingConfig = {
  slug: string;
  theme?: "light" | "dark" | "auto";
  primaryColor?: string;
  hideHeader?: boolean;
  preselectTypeId?: string;
};

export type SchedulingGroup = {
  id: string;
  name: string;
  slug: string;
  memberStaffIds: string[];
  memberTypeIds?: string[];
  roundRobinEnabled?: boolean;
  description?: string;
  active?: boolean;
};

export type TeamBookingPage = {
  id: string;
  name: string;
  slug: string;
  schedulingGroupId?: string;
  appointmentTypeIds: string[];
  headline?: string;
  description?: string;
  active?: boolean;
};

export type OrganizationSchedulingPolicy = {
  managedEventTypesOnly?: boolean;
  managedAutomationsOnly?: boolean;
  requireStaffApproval?: boolean;
  defaultTimezone?: string;
  ssoRequired?: boolean;
};

export type GranularRole = {
  id: string;
  name: string;
  permissions: Array<
    | "appointments.read"
    | "appointments.write"
    | "appointments.book"
    | "appointments.types.manage"
    | "appointments.workflows.manage"
    | "appointments.settings.manage"
    | "appointments.analytics.read"
    | "calendar.connect"
    | "team.manage"
  >;
};

export type ReminderTimeOfDay = {
  /** Local time HH:MM in workspace timezone */
  at: string;
  /** Days before appointment (0 = day of) */
  daysBefore: number;
};

export type ReminderStepExtended = {
  enabled: boolean;
  channel: "sms" | "email" | "voice";
  label: string;
  template: string;
  minutesBefore?: number;
  timeOfDay?: ReminderTimeOfDay;
  voiceReminderTemplateId?: string;
  skipWeekends?: boolean;
  skipClosedDays?: boolean;
  skipOffHours?: boolean;
  stopOnReply?: boolean;
};

export type PerCalendarReminderDefaults = {
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  voiceEnabled?: boolean;
  replyDestinationPhone?: string;
  replyDestinationEmail?: string;
  importKeywordInclude?: string[];
  importKeywordExclude?: string[];
  attachIcs?: boolean;
};

export type AppointmentReminderOverride = {
  suppressed?: boolean;
  customSteps?: ReminderStepExtended[];
  extraRecipients?: Array<{ email?: string; phone?: string; name?: string }>;
};

export type UtmAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export type RoutingFormField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "select" | "number" | "company_size" | "industry";
  required?: boolean;
  options?: string[];
};

export type RoutingFormRule = {
  id: string;
  conditions: Array<{
    fieldId: string;
    operator: "equals" | "contains" | "gt" | "lt" | "in";
    value: string;
  }>;
  logic?: "and" | "or";
  destination: {
    appointmentTypeId?: string;
    staffId?: string;
    schedulingGroupId?: string;
    externalUrl?: string;
  };
  fallback?: boolean;
  priority?: number;
};

export type RoutingForm = {
  id: string;
  name: string;
  slug: string;
  headline?: string;
  fields: RoutingFormField[];
  rules: RoutingFormRule[];
  fallbackDestination?: RoutingFormRule["destination"];
  active?: boolean;
};

export type SlotUnavailabilityReason =
  | "past_notice_window"
  | "outside_weekly_hours"
  | "date_closed"
  | "blackout_date"
  | "booking_limit_daily"
  | "booking_limit_weekly"
  | "booking_limit_monthly"
  | "booking_limit_type_daily"
  | "external_calendar_busy"
  | "staff_unavailable"
  | "collective_unavailable"
  | "capacity_full"
  | "existing_appointment"
  | "weekend_closed"
  | "off_hours"
  | "invalid_start_interval";

export type SlotDiagnostic = {
  startsAt: string;
  endsAt: string;
  available: boolean;
  reasons: SlotUnavailabilityReason[];
  detail?: string;
};

export type RecallCampaign = {
  id: string;
  name: string;
  active: boolean;
  channel: "sms" | "email";
  subject?: string;
  messageTemplate: string;
  segment?: {
    lastVisitDaysAgo?: number;
    appointmentTypeId?: string;
    appointmentTypeName?: string;
    noFutureAppointment?: boolean;
  };
  maxRecipients?: number;
  lastRunAt?: string;
  lastRunSent?: number;
  createdAt: string;
};

export type WaitlistOffer = {
  token: string;
  waitlistEntryId: string;
  serviceName: string;
  startsAt: string;
  expiresAt: string;
  status: "open" | "accepted" | "expired";
};
