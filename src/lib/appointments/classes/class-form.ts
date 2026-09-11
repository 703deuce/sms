import {
  parseClassSeriesMetadata,
  type ClassBookingQuestion,
  type ClassSeriesMetadata,
} from "@/lib/appointments/class-series-offering";
import {
  EMPTY_RECURRENCE,
  inferClassRecurrence,
  parseClassRecurrence,
} from "@/lib/appointments/classes/class-recurrence";

/** A class as the editor holds it: columns and metadata flattened into one object. */
export type ClassFormState = {
  name: string;
  description: string;
  capacity: number;
  staffId: string;
  locationId: string;
  active: boolean;
  requireFullSeries: boolean;
  recurrence: typeof EMPTY_RECURRENCE;

  visibility: "public" | "hidden";
  imageUrl: string;
  category: string;
  timezone: string;

  isFree: boolean;
  priceCents: number;
  paymentMode: "free" | "on_site";
  packageProductIds: string[];
  membershipProductIds: string[];
  memberOnly: boolean;

  registrationOpensAt: string;
  registrationClosesAt: string;
  showRemainingSpots: boolean;

  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistOfferExpiresHours: number;

  resourceIds: string[];

  bookingQuestions: ClassBookingQuestion[];
  intakeFormIds: string[];
  requireEmail: boolean;
  requirePhone: boolean;
  requireLastName: boolean;

  cancellationPolicy: string;
  cancellationWindowHours: number;
  termsUrl: string;
  admissionEnabled: boolean;
  confirmationMessage: string;
};

export type ClassSeriesRow = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  staffId: string | null;
  locationId: string | null;
  active: boolean;
  requireFullSeries?: boolean;
  recurrenceRule?: unknown;
  metadata?: unknown;
  occurrences?: ClassOccurrenceRow[];
};

export type ClassOccurrenceRow = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  status: string;
  staffId?: string | null;
  locationId?: string | null;
  enrolled?: number;
  remaining?: number;
};

export const EMPTY_CLASS_FORM: ClassFormState = {
  name: "",
  description: "",
  capacity: 12,
  staffId: "",
  locationId: "",
  active: true,
  requireFullSeries: false,
  recurrence: { ...EMPTY_RECURRENCE },

  visibility: "public",
  imageUrl: "",
  category: "",
  timezone: "",

  isFree: true,
  priceCents: 0,
  paymentMode: "free",
  packageProductIds: [],
  membershipProductIds: [],
  memberOnly: false,

  registrationOpensAt: "",
  registrationClosesAt: "",
  showRemainingSpots: true,

  waitlistEnabled: false,
  waitlistAutoPromote: false,
  waitlistOfferExpiresHours: 24,

  resourceIds: [],

  bookingQuestions: [],
  intakeFormIds: [],
  requireEmail: false,
  requirePhone: true,
  requireLastName: false,

  cancellationPolicy: "",
  cancellationWindowHours: 24,
  termsUrl: "",
  admissionEnabled: false,
  confirmationMessage: "",
};

function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function classFormFromRow(row: ClassSeriesRow): ClassFormState {
  const meta = parseClassSeriesMetadata(row.metadata);
  // `intakeFormId` was the original single-form field. Reading both keeps
  // classes configured before the rewrite pointing at the same form.
  const formIds = meta.intakeFormIds?.length
    ? meta.intakeFormIds
    : meta.intakeFormId
      ? [meta.intakeFormId]
      : [];
  const isFree = meta.isFree !== false && !(meta.priceCents && meta.priceCents > 0);

  const stored = parseClassRecurrence(row.recurrenceRule);
  const recurrence = stored.startDate
    ? stored
    : (inferClassRecurrence(row.occurrences || []) ?? stored);

  // A class created before the timezone moved into metadata still carries it on
  // the recurrence rule, and the schedule editor should not claim UTC for it.
  const legacyTimezone =
    row.recurrenceRule &&
    typeof row.recurrenceRule === "object" &&
    typeof (row.recurrenceRule as { timezone?: unknown }).timezone === "string"
      ? (row.recurrenceRule as { timezone: string }).timezone
      : "";

  return {
    name: row.name || "",
    description: row.description || "",
    capacity: Number(row.capacity ?? 12) || 12,
    staffId: row.staffId || "",
    locationId: row.locationId || "",
    active: row.active !== false,
    requireFullSeries: row.requireFullSeries === true,
    recurrence,

    visibility: meta.visibility === "hidden" ? "hidden" : "public",
    imageUrl: meta.imageUrl || "",
    category: meta.category || "",
    timezone: meta.timezone || legacyTimezone,

    isFree,
    priceCents: Number(meta.priceCents ?? 0) || 0,
    paymentMode: isFree ? "free" : "on_site",
    packageProductIds: meta.packageProductIds || [],
    membershipProductIds: meta.membershipProductIds || [],
    memberOnly: meta.memberOnly === true,

    registrationOpensAt: toLocalInput(meta.registrationOpensAt),
    registrationClosesAt: toLocalInput(meta.registrationClosesAt),
    showRemainingSpots: meta.showRemainingSpots !== false,

    waitlistEnabled: meta.waitlistEnabled === true,
    waitlistAutoPromote: meta.waitlistAutoPromote === true,
    waitlistOfferExpiresHours: Number(meta.waitlistOfferExpiresHours ?? 24) || 24,

    resourceIds: meta.resourceIds || [],

    bookingQuestions: meta.bookingQuestions || [],
    intakeFormIds: formIds,
    requireEmail: meta.requireEmail === true,
    requirePhone: meta.requirePhone !== false,
    requireLastName: meta.requireLastName === true,

    cancellationPolicy: meta.cancellationPolicy || "",
    cancellationWindowHours: Number(meta.cancellationWindowHours ?? 24) || 24,
    termsUrl: meta.termsUrl || "",
    admissionEnabled: meta.admissionEnabled === true,
    confirmationMessage: meta.confirmationMessage || "",
  };
}

export function classMetadataFromForm(form: ClassFormState): ClassSeriesMetadata {
  return {
    kind: "class",
    visibility: form.visibility,
    imageUrl: form.imageUrl.trim() || undefined,
    category: form.category.trim() || undefined,
    timezone: form.timezone || undefined,

    isFree: form.isFree,
    priceCents: form.isFree ? 0 : form.priceCents,
    paymentMode: form.isFree ? "free" : "on_site",
    packageProductIds: form.packageProductIds,
    membershipProductIds: form.membershipProductIds,
    memberOnly: form.memberOnly,

    registrationOpensAt: fromLocalInput(form.registrationOpensAt),
    registrationClosesAt: fromLocalInput(form.registrationClosesAt),
    showRemainingSpots: form.showRemainingSpots,

    waitlistEnabled: form.waitlistEnabled,
    waitlistAutoPromote: form.waitlistAutoPromote,
    waitlistOfferExpiresHours: form.waitlistOfferExpiresHours,

    resourceIds: form.resourceIds,

    bookingQuestions: form.bookingQuestions,
    intakeFormIds: form.intakeFormIds,
    intakeFormId: form.intakeFormIds[0],
    requireEmail: form.requireEmail,
    requirePhone: form.requirePhone,
    requireLastName: form.requireLastName,

    cancellationPolicy: form.cancellationPolicy.trim() || undefined,
    cancellationWindowHours: form.cancellationWindowHours,
    termsUrl: form.termsUrl.trim() || undefined,
    admissionEnabled: form.admissionEnabled,
    confirmationMessage: form.confirmationMessage.trim() || undefined,
  };
}

export function classSavePayload(form: ClassFormState, id?: string) {
  return {
    id,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    capacity: form.capacity,
    staffId: form.staffId || undefined,
    locationId: form.locationId || undefined,
    active: form.active,
    requireFullSeries: form.requireFullSeries,
    recurrenceRule: form.recurrence,
    metadata: classMetadataFromForm(form),
  };
}

/** Blocking problems, keyed by the section that fixes them. */
export function validateClassForm(form: ClassFormState): string {
  if (!form.name.trim()) return "Class name is required";
  if (!Number.isFinite(form.capacity) || form.capacity < 1) {
    return "Capacity must be at least 1";
  }
  if (!form.isFree && form.priceCents <= 0) {
    return "Set a price above $0, or mark the class free";
  }
  if (form.recurrence.pattern === "repeating" && form.recurrence.endsMode === "after") {
    if (form.recurrence.endsAfter < 1) return "A repeating class needs at least one session";
  }
  if (
    form.registrationOpensAt &&
    form.registrationClosesAt &&
    new Date(form.registrationOpensAt) >= new Date(form.registrationClosesAt)
  ) {
    return "Registration must open before it closes";
  }
  return "";
}
