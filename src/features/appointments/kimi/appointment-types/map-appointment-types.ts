import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import type {
  AppointmentTypeFormState,
  AppointmentTypeItem,
  AppointmentTypeQuestion,
} from "./types";

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
  { color: "text-indigo-600", bg: "bg-indigo-100" },
  { color: "text-emerald-600", bg: "bg-emerald-100" },
  { color: "text-amber-600", bg: "bg-amber-100" },
  { color: "text-sky-600", bg: "bg-sky-100" },
  { color: "text-rose-600", bg: "bg-rose-100" },
  { color: "text-teal-600", bg: "bg-teal-100" },
  { color: "text-violet-600", bg: "bg-violet-100" },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: "Short answer",
  textarea: "Long answer",
  select: "Multiple choice",
  checkbox: "Checkbox",
};

export const EMPTY_APPOINTMENT_TYPE_FORM: AppointmentTypeFormState = {
  name: "",
  durationMinutes: 30,
  bufferMinutes: 0,
  description: "",
  location: "",
  priceDisplay: "",
  showPriceOnBooking: true,
  bookingHours: "Mon-Fri 09:00-17:00",
  minimumBookingNoticeMinutes: 60,
  maximumBookingDaysAhead: 14,
  enabled: true,
  customQuestion: "",
  customQuestionRequired: false,
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

function mapQuestions(
  questions: AppointmentTypeConfig["bookingQuestions"] = [],
): AppointmentTypeQuestion[] {
  return questions.map((q) => ({
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
  const isLive = Boolean(
    opts.bookingEnabled && opts.workspaceSlug && type.active && enabled,
  );

  return {
    id: type.id,
    name: type.name,
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
  const question = type.config.bookingQuestions?.[0];
  return {
    name: type.name,
    durationMinutes: type.durationMinutes,
    bufferMinutes: type.bufferMinutes,
    description: type.config.description || "",
    location: type.config.location || "",
    priceDisplay: type.config.priceDisplay || "",
    showPriceOnBooking: Boolean(type.config.priceDisplay),
    bookingHours: type.config.bookingHours || "Mon-Fri 09:00-17:00",
    minimumBookingNoticeMinutes: type.config.minimumBookingNoticeMinutes ?? 60,
    maximumBookingDaysAhead: type.config.maximumBookingDaysAhead ?? 14,
    enabled: type.config.enabled !== false,
    customQuestion: question?.label || "",
    customQuestionRequired: Boolean(question?.required),
  };
}

export function previewFromForm(form: AppointmentTypeFormState, selected: AppointmentTypeItem | null) {
  const { price, free } = parsePrice(form.priceDisplay);
  const palette = selected
    ? { color: selected.color, bg: selected.bg }
    : TYPE_COLORS[0];

  return {
    name: form.name || "New appointment type",
    durationMin: form.durationMinutes,
    price,
    free,
    description: form.description || "Add a description customers will see on your booking page.",
    location: form.location || "In-office",
    color: palette.color,
    bg: palette.bg,
    questions: form.customQuestion.trim()
      ? [
          {
            id: "custom_question",
            label: form.customQuestion.trim(),
            type: "Short answer",
            required: form.customQuestionRequired,
          },
        ]
      : [],
  };
}

export function buildSavePayload(form: AppointmentTypeFormState) {
  return {
    name: form.name,
    durationMinutes: form.durationMinutes,
    bufferMinutes: form.bufferMinutes,
    config: {
      description: form.description,
      location: form.location,
      priceDisplay: form.showPriceOnBooking ? form.priceDisplay : "",
      bookingHours: form.bookingHours,
      minimumBookingNoticeMinutes: form.minimumBookingNoticeMinutes,
      maximumBookingDaysAhead: form.maximumBookingDaysAhead,
      enabled: form.enabled,
      bookingQuestions: form.customQuestion.trim()
        ? [
            {
              id: "custom_question",
              label: form.customQuestion.trim(),
              type: "text" as const,
              required: form.customQuestionRequired,
            },
          ]
        : [],
    },
  };
}
