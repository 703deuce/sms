import type {
  AppointmentTypeConfig,
  BookingQuestion,
  CancellationPolicy,
  PaymentRequirement,
  ReschedulePolicy,
  StaffAssignmentMode,
} from "@/lib/appointments/types";
import {
  resolveBookingTypeKind,
  type BookingTypeKind,
} from "@/lib/appointments/booking-type-kind";
import type {
  AppointmentTypeFormState,
  AppointmentTypeItem,
  AppointmentTypeQuestion,
} from "./types";
import { newBookingQuestion } from "../shared/platform-settings-types";

export type ApiAppointmentType = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  calendarId: string | null;
  active: boolean;
  config: AppointmentTypeConfig;
};

const TYPE_COLORS = [
  { color: "text-[#147d74]", bg: "bg-[#dcefeb]" },
  { color: "text-emerald-600", bg: "bg-emerald-100" },
  { color: "text-amber-600", bg: "bg-amber-100" },
  { color: "text-sky-600", bg: "bg-sky-100" },
  { color: "text-rose-600", bg: "bg-rose-100" },
  { color: "text-teal-600", bg: "bg-teal-100" },
  { color: "text-violet-600", bg: "bg-violet-100" },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone",
  number: "Number",
  select: "Dropdown",
  radio: "Radio",
  checkbox: "Checkbox",
  multiselect: "Multiple choice",
  date: "Date",
};

export const EMPTY_APPOINTMENT_TYPE_FORM: AppointmentTypeFormState = {
  bookingTypeKind: "SERVICE",
  name: "",
  durationMinutes: 30,
  bufferMinutes: 0,
  description: "",
  location: "",
  locationId: "",
  locationIds: [],
  priceDisplay: "",
  showPriceOnBooking: true,
  bookingHours: "Mon-Fri 09:00-17:00",
  minimumBookingNoticeMinutes: 60,
  maximumBookingDaysAhead: 14,
  enabled: true,
  bookingQuestions: [],
  staffAssignment: "any_eligible",
  staffIds: [],
  collectiveStaffIds: [],
  cancellationPolicy: { allowed: "anytime" },
  reschedulePolicy: { allowed: "anytime" },
  extendedCancellationPolicy: { allowed: "anytime" },
  paymentMode: "none",
  paymentProvider: "",
  paymentPriceCents: 0,
  paymentDepositCents: 0,
  paymentDepositPercent: 0,
  paymentCurrency: "usd",
  groupBookingEnabled: false,
  groupCapacity: 1,
  recurringEnabled: false,
  recurringFrequencies: ["weekly", "biweekly", "monthly"],
  maxBookingsPerDay: undefined,
  maxBookingsPerWeek: undefined,
  maxPerTypePerDay: undefined,
  transovoVideoEnabled: false,
  videoMaxParticipants: 10,
  videoRequireGuestEmail: true,
  videoRequireHost: false,
  videoWaitingRoom: false,
  videoRecordingMode: "off",
  videoTranscription: false,
  videoAiRecap: false,
  notetakerEnabled: false,
  notetakerAutoJoin: false,
  notetakerTranscript: true,
  notetakerSummary: true,
  notetakerActionItems: true,
  notetakerSummaryTemplate: "general",
  visibility: "public",
  managed: false,
  displayOrder: 0,
  durationOptions: [],
  bookingApprovalRequired: false,
  redirectAfterBookingEnabled: false,
  redirectAfterBookingUrl: "",
  redirectIncludeQueryParams: true,
  confirmationHeadline: "",
  confirmationBodyHtml: "",
  confirmationCtaLabel: "",
  confirmationCtaUrl: "",
  namedScheduleId: "",
  ownerTeamId: "",
  categoryId: "",
  imageUrl: "",
  resourceIds: [],
  intakeFormIds: [],
  addOnIds: [],
  permissions: [],
};

function parsePrice(priceDisplay?: string): { price: number | null; free: boolean } {
  if (!priceDisplay?.trim()) return { price: null, free: true };
  const numeric = Number(priceDisplay.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return { price: null, free: true };
  return { price: numeric, free: false };
}

function slugify(name: string, id: string) {
  const fromName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return fromName || id;
}

function mapQuestions(questions: BookingQuestion[] = []): AppointmentTypeQuestion[] {
  return questions
    .filter((q) => q.active !== false)
    .map((q) => ({
      id: q.id,
      label: q.label,
      type: QUESTION_TYPE_LABELS[q.type] || q.type,
      required: Boolean(q.required),
    }));
}

export function mapApiTypeToItem(
  type: ApiAppointmentType,
  index: number,
  opts: { workspaceSlug: string; bookingEnabled: boolean },
): AppointmentTypeItem {
  const palette = TYPE_COLORS[index % TYPE_COLORS.length];
  const { price, free } = parsePrice(type.config.priceDisplay);
  const enabled = type.config.enabled !== false;
  const isLive = Boolean(opts.bookingEnabled && opts.workspaceSlug && type.active && enabled);

  return {
    id: type.id,
    name: type.name,
    kind: resolveBookingTypeKind(type.config),
    durationMin: type.durationMinutes,
    price,
    free,
    active: type.active && enabled,
    isLive,
    color: palette.color,
    bg: palette.bg,
    description: type.config.description || "",
    location: type.config.location || "",
    bufferMin: type.bufferMinutes,
    slug: slugify(type.name, type.id),
    created: "—",
    updated: "—",
    questions: mapQuestions(type.config.bookingQuestions),
  };
}

export function mapApiTypesToItems(
  types: ApiAppointmentType[],
  opts: { workspaceSlug: string; bookingEnabled: boolean },
): AppointmentTypeItem[] {
  return types.map((type, index) => mapApiTypeToItem(type, index, opts));
}

export function formStateFromApiType(type: ApiAppointmentType): AppointmentTypeFormState {
  const cfg = type.config;
  const payment = cfg.payment;
  return {
    bookingTypeKind: resolveBookingTypeKind(cfg),
    name: type.name,
    durationMinutes: type.durationMinutes,
    bufferMinutes: type.bufferMinutes,
    description: cfg.description || "",
    location: cfg.location || "",
    locationId: cfg.locationId || "",
    locationIds: cfg.locationIds || [],
    priceDisplay: cfg.priceDisplay || "",
    showPriceOnBooking: Boolean(cfg.priceDisplay),
    bookingHours: cfg.bookingHours || "Mon-Fri 09:00-17:00",
    minimumBookingNoticeMinutes: cfg.minimumBookingNoticeMinutes ?? 60,
    maximumBookingDaysAhead: cfg.maximumBookingDaysAhead ?? 14,
    enabled: cfg.enabled !== false,
    bookingQuestions: (cfg.bookingQuestions || []).map((q) => ({ ...q, active: q.active !== false })),
    staffAssignment: cfg.staffAssignment || "any_eligible",
    staffIds: cfg.staffIds || [],
    collectiveStaffIds: cfg.collectiveStaffIds || [],
    cancellationPolicy: cfg.cancellationPolicy || { allowed: "anytime" },
    reschedulePolicy: cfg.reschedulePolicy || { allowed: "anytime" },
    extendedCancellationPolicy: cfg.extendedCancellationPolicy || { allowed: "anytime" },
    paymentMode: payment?.mode || "none",
    paymentProvider: (payment?.provider as "stripe" | "square") || "",
    paymentPriceCents: payment?.priceCents || 0,
    paymentDepositCents: payment?.depositCents || 0,
    paymentDepositPercent: payment?.depositPercent || 0,
    paymentCurrency: payment?.currency || "usd",
    groupBookingEnabled: cfg.groupBooking?.enabled || false,
    groupCapacity: cfg.groupBooking?.capacity || 1,
    recurringEnabled: cfg.recurring?.enabled || false,
    recurringFrequencies: cfg.recurring?.allowedFrequencies || ["weekly", "biweekly", "monthly"],
    maxBookingsPerDay: cfg.bookingLimits?.maxBookingsPerDay,
    maxBookingsPerWeek: cfg.bookingLimits?.maxBookingsPerWeek,
    maxPerTypePerDay: cfg.bookingLimits?.maxPerTypePerDay,
    transovoVideoEnabled: Boolean(cfg.transovoVideo?.enabled || cfg.location === "Transovo Video"),
    videoMaxParticipants: cfg.transovoVideo?.maxParticipants ?? 10,
    videoRequireGuestEmail: cfg.transovoVideo?.requireGuestEmail ?? true,
    videoRequireHost: cfg.transovoVideo?.requireHost ?? false,
    videoWaitingRoom: cfg.transovoVideo?.waitingRoom ?? false,
    videoRecordingMode: cfg.transovoVideo?.recordingMode ?? "off",
    videoTranscription: cfg.transovoVideo?.transcription ?? false,
    videoAiRecap: cfg.transovoVideo?.aiRecap ?? false,
    notetakerEnabled: cfg.notetaker?.enabled ?? false,
    notetakerAutoJoin: cfg.notetaker?.autoJoin ?? false,
    notetakerTranscript: cfg.notetaker?.transcriptEnabled ?? true,
    notetakerSummary: cfg.notetaker?.summaryEnabled ?? true,
    notetakerActionItems: cfg.notetaker?.actionItemsEnabled ?? true,
    notetakerSummaryTemplate: cfg.notetaker?.summaryTemplate ?? "general",
    visibility: cfg.visibility || "public",
    managed: cfg.managed || false,
    displayOrder: cfg.displayOrder ?? 0,
    durationOptions: (cfg.durationOptions || []).map((o) => ({
      id: o.id,
      label: o.label,
      minutes: o.minutes,
      active: o.active !== false,
    })),
    bookingApprovalRequired: cfg.bookingApproval?.required || false,
    redirectAfterBookingEnabled: cfg.redirectAfterBooking?.enabled || false,
    redirectAfterBookingUrl: cfg.redirectAfterBooking?.url || "",
    redirectIncludeQueryParams: cfg.redirectAfterBooking?.includeQueryParams !== false,
    confirmationHeadline: cfg.confirmationPage?.headline || "",
    confirmationBodyHtml: cfg.confirmationPage?.bodyHtml || "",
    confirmationCtaLabel: cfg.confirmationPage?.ctaLabel || "",
    confirmationCtaUrl: cfg.confirmationPage?.ctaUrl || "",
    maxBookingsPerMonth: cfg.bookingLimits?.maxBookingsPerMonth,
    namedScheduleId: cfg.namedScheduleId || "",
    ownerTeamId: cfg.ownerTeamId || "",
    categoryId: cfg.categoryId || "",
    imageUrl: cfg.imageUrl || "",
    resourceIds: cfg.resourceIds || [],
    intakeFormIds: cfg.intakeFormIds || [],
    addOnIds: cfg.addOnIds || [],
    permissions: (cfg.permissions || []).map((p) => ({ ...p })),
  };
}

export function previewFromForm(form: AppointmentTypeFormState, selected: AppointmentTypeItem | null) {
  const { price, free } = parsePrice(form.priceDisplay);
  const palette = selected ? { color: selected.color, bg: selected.bg } : TYPE_COLORS[0];

  return {
    name: form.name || "New appointment type",
    durationMin: form.durationMinutes,
    price,
    free,
    description: form.description || "Add a description customers will see on your booking page.",
    location: form.location || "In-office",
    color: palette.color,
    bg: palette.bg,
    questions: mapQuestions(form.bookingQuestions),
  };
}

function buildPaymentConfig(form: AppointmentTypeFormState): PaymentRequirement | undefined {
  if (form.paymentMode === "none") return { mode: "none" };
  return {
    mode: form.paymentMode,
    provider: form.paymentProvider || undefined,
    priceCents: form.paymentPriceCents || undefined,
    depositCents: form.paymentDepositCents || undefined,
    depositPercent: form.paymentDepositPercent || undefined,
    currency: form.paymentCurrency || "usd",
  };
}

export function buildSavePayload(form: AppointmentTypeFormState) {
  const activeQuestions = form.bookingQuestions
    .filter((q) => q.label.trim())
    .map((q, i) => ({
      id: q.id,
      label: q.label.trim(),
      description: q.description,
      type: q.type,
      required: q.required,
      placeholder: q.placeholder,
      options: q.options,
      displayOrder: i,
      active: q.active !== false,
    }));

  const config: AppointmentTypeConfig = {
    bookingTypeKind: form.bookingTypeKind,
    description: form.description,
    location: form.location,
    locationId: form.locationId || undefined,
    locationIds: form.locationIds.length ? form.locationIds : undefined,
    priceDisplay: form.showPriceOnBooking ? form.priceDisplay : "",
    bookingHours: form.bookingHours,
    minimumBookingNoticeMinutes: form.minimumBookingNoticeMinutes,
    maximumBookingDaysAhead: form.maximumBookingDaysAhead,
    enabled: form.enabled,
    bookingQuestions: activeQuestions,
    staffAssignment: form.staffAssignment as StaffAssignmentMode,
    staffIds: form.staffIds.length ? form.staffIds : undefined,
    collectiveStaffIds: form.collectiveStaffIds.length ? form.collectiveStaffIds : undefined,
    cancellationPolicy: form.cancellationPolicy as CancellationPolicy,
    reschedulePolicy: form.reschedulePolicy as ReschedulePolicy,
    extendedCancellationPolicy: form.extendedCancellationPolicy,
    payment: buildPaymentConfig(form),
    groupBooking: form.groupBookingEnabled
      ? { enabled: true, capacity: Math.max(2, form.groupCapacity) }
      : { enabled: false, capacity: 1 },
    recurring: form.recurringEnabled
      ? { enabled: true, allowedFrequencies: form.recurringFrequencies, maxOccurrences: 12 }
      : { enabled: false },
    bookingLimits:
      form.maxBookingsPerDay || form.maxBookingsPerWeek || form.maxPerTypePerDay || form.maxBookingsPerMonth
        ? {
            maxBookingsPerDay: form.maxBookingsPerDay,
            maxBookingsPerWeek: form.maxBookingsPerWeek,
            maxPerTypePerDay: form.maxPerTypePerDay,
            maxBookingsPerMonth: form.maxBookingsPerMonth,
          }
        : undefined,
    visibility: form.visibility,
    managed: form.managed,
    displayOrder: form.displayOrder,
    namedScheduleId: form.namedScheduleId || undefined,
    ownerTeamId: form.ownerTeamId || undefined,
    categoryId: form.categoryId || undefined,
    imageUrl: form.imageUrl?.trim() || undefined,
    permissions: form.permissions.length ? form.permissions : undefined,
    durationOptions: form.durationOptions.length
      ? form.durationOptions.filter((o) => o.label && o.minutes > 0)
      : undefined,
    bookingApproval: form.bookingApprovalRequired ? { required: true, notifyStaff: true } : undefined,
    redirectAfterBooking: form.redirectAfterBookingEnabled
      ? {
          enabled: true,
          url: form.redirectAfterBookingUrl,
          includeQueryParams: form.redirectIncludeQueryParams,
        }
      : undefined,
    confirmationPage:
      form.confirmationHeadline || form.confirmationBodyHtml
        ? {
            headline: form.confirmationHeadline,
            bodyHtml: form.confirmationBodyHtml,
            ctaLabel: form.confirmationCtaLabel,
            ctaUrl: form.confirmationCtaUrl,
          }
        : undefined,
    transovoVideo:
      form.transovoVideoEnabled || form.location === "Transovo Video"
        ? {
            enabled: true,
            maxParticipants: form.videoMaxParticipants || 10,
            requireGuestEmail: form.videoRequireGuestEmail,
            requireHost: form.videoRequireHost,
            waitingRoom: form.videoWaitingRoom,
            recordingMode: form.videoRecordingMode,
            transcription: form.videoTranscription,
            aiRecap: form.videoAiRecap,
          }
        : undefined,
    notetaker: form.notetakerEnabled
      ? {
          enabled: true,
          autoJoin: form.notetakerAutoJoin,
          transcriptEnabled: form.notetakerTranscript,
          summaryEnabled: form.notetakerSummary,
          actionItemsEnabled: form.notetakerActionItems,
          summaryTemplate: (form.notetakerSummaryTemplate || "general") as import("@/lib/meeting-assistant/types").SummaryTemplateId,
        }
      : undefined,
    resourceIds: form.resourceIds.length ? form.resourceIds : undefined,
    intakeFormIds: form.intakeFormIds.length ? form.intakeFormIds : undefined,
    addOnIds: form.addOnIds.length ? form.addOnIds : undefined,
  };

  return {
    name: form.name,
    durationMinutes: form.durationMinutes,
    bufferMinutes: form.bufferMinutes,
    config,
  };
}
