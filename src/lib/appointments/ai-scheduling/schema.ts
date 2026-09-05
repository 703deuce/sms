/**
 * Canonical appointment AI schema — understanding agent output and service results.
 * Extends legacy SchedulingIntent without duplicating parallel enums.
 */

export type AppointmentAiIntent =
  | "FIND_AVAILABILITY"
  | "BOOK"
  | "RESCHEDULE"
  | "CANCEL"
  | "CONFIRM"
  | "APPOINTMENT_DETAILS"
  | "ANSWER_BOOKING_QUESTION"
  | "JOIN_WAITLIST"
  | "CLARIFY"
  | "OUT_OF_SCOPE";

/** Legacy intent names mapped to canonical intents. */
export const LEGACY_INTENT_MAP: Record<string, AppointmentAiIntent> = {
  availability_request: "FIND_AVAILABILITY",
  new_booking: "BOOK",
  reschedule: "RESCHEDULE",
  cancel: "CANCEL",
  confirm: "CONFIRM",
};

export function normalizeAppointmentAiIntent(raw: string): AppointmentAiIntent | null {
  const upper = raw.trim();
  const canonical: AppointmentAiIntent[] = [
    "FIND_AVAILABILITY",
    "BOOK",
    "RESCHEDULE",
    "CANCEL",
    "CONFIRM",
    "APPOINTMENT_DETAILS",
    "ANSWER_BOOKING_QUESTION",
    "JOIN_WAITLIST",
    "CLARIFY",
    "OUT_OF_SCOPE",
  ];
  if (canonical.includes(upper as AppointmentAiIntent)) {
    return upper as AppointmentAiIntent;
  }
  return LEGACY_INTENT_MAP[raw] || null;
}

export type UnderstandingResult = {
  intent: AppointmentAiIntent;
  confidence: number;
  requiresClarification: boolean;
  clarificationReason: string | null;
  appointmentReference: {
    appointmentId: string | null;
    description: string | null;
  };
  servicePreference: {
    appointmentTypeId: string | null;
    nameMentioned: string | null;
  };
  datePreference: {
    raw: string | null;
    relative: string | null;
    date: string | null;
    dateRange: { start: string; end: string } | null;
  };
  timePreference: {
    raw: string | null;
    exactTime: string | null;
    period: "morning" | "afternoon" | "evening" | null;
    range: { start: string; end: string } | null;
  };
  staffPreference: {
    staffId: string | null;
    nameMentioned: string | null;
  };
  locationPreference: {
    locationId: string | null;
    nameMentioned: string | null;
  };
  groupSize: number | null;
  recurrence: {
    frequency: "weekly" | "biweekly" | "monthly";
    occurrences?: number;
    endDate?: string;
  } | null;
  bookingAnswers: Record<string, string>;
  explicitMutationRequested: boolean;
  notesForResolver: string[];
  originalText: string;
};

export type WriteActionVerdict = "MATCH" | "NEEDS_CLARIFICATION" | "MISMATCH";

export type ProposedWriteAction =
  | { kind: "BOOK"; serviceName: string; startsAt: string; appointmentTypeId?: string }
  | { kind: "RESCHEDULE"; appointmentId: string; startsAt: string }
  | { kind: "CANCEL"; appointmentId: string }
  | { kind: "CONFIRM"; appointmentId: string }
  | { kind: "JOIN_WAITLIST"; serviceName?: string; appointmentTypeId?: string };

export type ResolverOutcome = {
  status:
    | "AVAILABLE_OPTIONS"
    | "CLARIFICATION_REQUIRED"
    | "BOOKING_CONFIRMED"
    | "RESCHEDULED"
    | "CANCELED"
    | "CONFIRMED"
    | "PAYMENT_REQUIRED"
    | "WAITLIST_JOINED"
    | "APPOINTMENT_DETAILS"
    | "POLICY_ANSWER"
    | "OUT_OF_SCOPE"
    | "ERROR"
    | "NO_OP";
  reason?: string;
  slots?: Array<{ startsAt: string; endsAt: string; staffName?: string; locationName?: string }>;
  appointments?: Array<{
    id: string;
    serviceName: string;
    startsAt: string;
    status: string;
  }>;
  appointment?: {
    id: string;
    serviceName: string;
    startsAt: string;
    endsAt?: string;
    status: string;
  };
  checkoutUrl?: string;
  paymentMode?: "deposit" | "full";
  serviceName?: string;
  proposedWrite?: ProposedWriteAction;
  requiresVerifier: boolean;
  mutationExecuted: boolean;
};

export type AppointmentAiChannel = "public_booking" | "sms" | "conversation";

export type AppointmentAiResultType =
  | "MESSAGE"
  | "AVAILABLE_SLOTS"
  | "CLARIFICATION"
  | "PAYMENT_REQUIRED"
  | "BOOKED"
  | "RESCHEDULED"
  | "CANCELED"
  | "OUT_OF_SCOPE";

export type AppointmentAiResult = {
  type: AppointmentAiResultType;
  message: string;
  data?: Record<string, unknown>;
  slots?: Array<{ startsAt: string; endsAt: string }>;
  serviceName?: string;
  requiresFollowUp: boolean;
  requiresConfirmation: boolean;
  requiresBookingDetails: boolean;
  requiresPayment?: boolean;
  paymentMode?: "deposit" | "full";
  understanding?: UnderstandingResult;
  presentationPhases?: Array<"understanding" | "checking_availability" | "verifying">;
};

export const UNDERSTANDING_JSON_SCHEMA = `{
  "intent": "FIND_AVAILABILITY|BOOK|RESCHEDULE|CANCEL|CONFIRM|APPOINTMENT_DETAILS|ANSWER_BOOKING_QUESTION|JOIN_WAITLIST|CLARIFY|OUT_OF_SCOPE",
  "confidence": 0.0-1.0,
  "requiresClarification": true/false,
  "clarificationReason": null | "string",
  "appointmentReference": { "appointmentId": null, "description": null },
  "servicePreference": { "appointmentTypeId": null, "nameMentioned": null },
  "datePreference": { "raw": null, "relative": null, "date": null, "dateRange": null },
  "timePreference": { "raw": null, "exactTime": null, "period": null, "range": null },
  "staffPreference": { "staffId": null, "nameMentioned": null },
  "locationPreference": { "locationId": null, "nameMentioned": null },
  "groupSize": null,
  "recurrence": null,
  "bookingAnswers": {},
  "explicitMutationRequested": true/false,
  "notesForResolver": []
}`;

export function emptyUnderstanding(originalText: string): UnderstandingResult {
  return {
    intent: "CLARIFY",
    confidence: 0,
    requiresClarification: true,
    clarificationReason: null,
    appointmentReference: { appointmentId: null, description: null },
    servicePreference: { appointmentTypeId: null, nameMentioned: null },
    datePreference: { raw: null, relative: null, date: null, dateRange: null },
    timePreference: { raw: null, exactTime: null, period: null, range: null },
    staffPreference: { staffId: null, nameMentioned: null },
    locationPreference: { locationId: null, nameMentioned: null },
    groupSize: null,
    recurrence: null,
    bookingAnswers: {},
    explicitMutationRequested: false,
    notesForResolver: [],
    originalText,
  };
}

export function validateUnderstandingResult(
  raw: unknown,
  scopedContext?: {
    appointmentTypeIds?: Set<string>;
    staffIds?: Set<string>;
    locationIds?: Set<string>;
    appointmentIds?: Set<string>;
  },
): UnderstandingResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const intent = normalizeAppointmentAiIntent(String(o.intent || ""));
  if (!intent) return null;

  const confidence = Number(o.confidence);
  const appointmentRef =
    o.appointmentReference && typeof o.appointmentReference === "object"
      ? (o.appointmentReference as Record<string, unknown>)
      : {};
  const servicePref =
    o.servicePreference && typeof o.servicePreference === "object"
      ? (o.servicePreference as Record<string, unknown>)
      : {};
  const datePref =
    o.datePreference && typeof o.datePreference === "object"
      ? (o.datePreference as Record<string, unknown>)
      : {};
  const timePref =
    o.timePreference && typeof o.timePreference === "object"
      ? (o.timePreference as Record<string, unknown>)
      : {};
  const staffPref =
    o.staffPreference && typeof o.staffPreference === "object"
      ? (o.staffPreference as Record<string, unknown>)
      : {};
  const locPref =
    o.locationPreference && typeof o.locationPreference === "object"
      ? (o.locationPreference as Record<string, unknown>)
      : {};

  let appointmentTypeId =
    typeof servicePref.appointmentTypeId === "string" ? servicePref.appointmentTypeId : null;
  let staffId = typeof staffPref.staffId === "string" ? staffPref.staffId : null;
  let locationId = typeof locPref.locationId === "string" ? locPref.locationId : null;
  let appointmentId =
    typeof appointmentRef.appointmentId === "string" ? appointmentRef.appointmentId : null;

  if (scopedContext) {
    if (appointmentTypeId && !scopedContext.appointmentTypeIds?.has(appointmentTypeId)) {
      appointmentTypeId = null;
    }
    if (staffId && !scopedContext.staffIds?.has(staffId)) staffId = null;
    if (locationId && !scopedContext.locationIds?.has(locationId)) locationId = null;
    if (appointmentId && !scopedContext.appointmentIds?.has(appointmentId)) {
      appointmentId = null;
    }
  }

  const period = timePref.period;
  const validPeriod =
    period === "morning" || period === "afternoon" || period === "evening" ? period : null;

  let recurrence: UnderstandingResult["recurrence"] = null;
  if (o.recurrence && typeof o.recurrence === "object") {
    const r = o.recurrence as Record<string, unknown>;
    const freq = r.frequency;
    if (freq === "weekly" || freq === "biweekly" || freq === "monthly") {
      recurrence = {
        frequency: freq,
        occurrences: typeof r.occurrences === "number" ? r.occurrences : undefined,
        endDate: typeof r.endDate === "string" ? r.endDate : undefined,
      };
    }
  }

  const bookingAnswers: Record<string, string> = {};
  if (o.bookingAnswers && typeof o.bookingAnswers === "object" && !Array.isArray(o.bookingAnswers)) {
    for (const [k, v] of Object.entries(o.bookingAnswers as Record<string, unknown>)) {
      if (typeof v === "string") bookingAnswers[k] = v;
    }
  }

  const notesForResolver = Array.isArray(o.notesForResolver)
    ? o.notesForResolver.filter((n): n is string => typeof n === "string")
    : [];

  let dateRange: { start: string; end: string } | null = null;
  if (datePref.dateRange && typeof datePref.dateRange === "object") {
    const dr = datePref.dateRange as Record<string, unknown>;
    if (typeof dr.start === "string" && typeof dr.end === "string") {
      dateRange = { start: dr.start, end: dr.end };
    }
  }

  let timeRange: { start: string; end: string } | null = null;
  if (timePref.range && typeof timePref.range === "object") {
    const tr = timePref.range as Record<string, unknown>;
    if (typeof tr.start === "string" && typeof tr.end === "string") {
      timeRange = { start: tr.start, end: tr.end };
    }
  }

  const unsafeMutation =
    (intent === "CANCEL" || intent === "RESCHEDULE" || intent === "BOOK") &&
    o.explicitMutationRequested !== true &&
    (intent === "CANCEL" || intent === "RESCHEDULE");

  return {
    intent: unsafeMutation && intent === "CANCEL" ? "CLARIFY" : intent,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0.5,
    requiresClarification: Boolean(o.requiresClarification) || unsafeMutation,
    clarificationReason:
      typeof o.clarificationReason === "string"
        ? o.clarificationReason
        : unsafeMutation
          ? "Mutation not explicitly authorized"
          : null,
    appointmentReference: {
      appointmentId,
      description:
        typeof appointmentRef.description === "string" ? appointmentRef.description : null,
    },
    servicePreference: {
      appointmentTypeId,
      nameMentioned:
        typeof servicePref.nameMentioned === "string" ? servicePref.nameMentioned : null,
    },
    datePreference: {
      raw: typeof datePref.raw === "string" ? datePref.raw : null,
      relative: typeof datePref.relative === "string" ? datePref.relative : null,
      date: typeof datePref.date === "string" ? datePref.date : null,
      dateRange,
    },
    timePreference: {
      raw: typeof timePref.raw === "string" ? timePref.raw : null,
      exactTime: typeof timePref.exactTime === "string" ? timePref.exactTime : null,
      period: validPeriod,
      range: timeRange,
    },
    staffPreference: {
      staffId,
      nameMentioned: typeof staffPref.nameMentioned === "string" ? staffPref.nameMentioned : null,
    },
    locationPreference: {
      locationId,
      nameMentioned: typeof locPref.nameMentioned === "string" ? locPref.nameMentioned : null,
    },
    groupSize: typeof o.groupSize === "number" ? o.groupSize : null,
    recurrence,
    bookingAnswers,
    explicitMutationRequested: Boolean(o.explicitMutationRequested),
    notesForResolver,
    originalText: typeof o.originalText === "string" ? o.originalText : "",
  };
}

export function validateWriteActionVerdict(raw: string): {
  verdict: WriteActionVerdict;
  reason?: string;
} | null {
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^(MATCH|NEEDS_CLARIFICATION|MISMATCH)\b/i);
  if (!match) return null;
  const verdict = match[1].toUpperCase() as WriteActionVerdict;
  const reason = raw.replace(/^(MATCH|NEEDS_CLARIFICATION|MISMATCH)\s*[-:–]?\s*/i, "").trim();
  return { verdict, reason: reason || undefined };
}
