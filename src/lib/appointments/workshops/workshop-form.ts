import {
  parseClassSeriesMetadata,
  type ClassBookingQuestion,
  type ClassSeriesMetadata,
} from "@/lib/appointments/class-series-offering";
import {
  EMPTY_SESSION_DRAFT,
  primarySession,
  sessionRowToDraft,
  type WorkshopSessionDraft,
  type WorkshopSessionRow,
} from "@/lib/appointments/workshops/workshop-schedule";

/** A workshop as the editor holds it: columns and metadata flattened into one object. */
export type WorkshopFormState = {
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  active: boolean;
  visibility: "public" | "hidden";
  cancelledAt: string;

  /** The intended primary session. Real sessions are rows, not form state. */
  schedule: WorkshopSessionDraft;
  timezone: string;

  locationMode: "in_person" | "virtual" | "custom";
  locationId: string;
  virtualUrl: string;
  locationNote: string;
  staffId: string;
  resourceIds: string[];

  capacity: number;
  showRemainingSpots: boolean;
  registrationOpensAt: string;
  registrationClosesAt: string;
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistOfferExpiresHours: number;

  isFree: boolean;
  priceCents: number;
  paymentMode: "free" | "on_site";
  packageProductIds: string[];
  membershipProductIds: string[];
  memberOnly: boolean;

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

export type WorkshopSeriesRow = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  staffId: string | null;
  locationId: string | null;
  active: boolean;
  recurrenceRule?: unknown;
  metadata?: unknown;
  occurrences?: WorkshopSessionRow[];
  /** Live registrations across the whole event, supplied by the list route. */
  registeredCount?: number;
};

export const EMPTY_WORKSHOP_FORM: WorkshopFormState = {
  name: "",
  description: "",
  category: "",
  imageUrl: "",
  active: true,
  visibility: "public",
  cancelledAt: "",

  schedule: { ...EMPTY_SESSION_DRAFT },
  timezone: "",

  locationMode: "in_person",
  locationId: "",
  virtualUrl: "",
  locationNote: "",
  staffId: "",
  resourceIds: [],

  capacity: 20,
  showRemainingSpots: true,
  registrationOpensAt: "",
  registrationClosesAt: "",
  waitlistEnabled: false,
  waitlistAutoPromote: false,
  waitlistOfferExpiresHours: 24,

  isFree: true,
  priceCents: 0,
  paymentMode: "free",
  packageProductIds: [],
  membershipProductIds: [],
  memberOnly: false,

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

/**
 * The intended date. A workshop that already has sessions is described by
 * them, so they win; the stored draft only matters before the first session
 * exists, which is the window between creating a workshop and scheduling it.
 */
function scheduleFromRow(row: WorkshopSeriesRow): WorkshopSessionDraft {
  const session = primarySession(row.occurrences || []);
  if (session) return sessionRowToDraft(session);

  const rule = (row.recurrenceRule || {}) as {
    startDate?: unknown;
    startTime?: unknown;
    durationMinutes?: unknown;
  };
  return {
    date: typeof rule.startDate === "string" ? rule.startDate : "",
    startTime: typeof rule.startTime === "string" ? rule.startTime : EMPTY_SESSION_DRAFT.startTime,
    durationMinutes:
      Number(rule.durationMinutes) > 0
        ? Number(rule.durationMinutes)
        : EMPTY_SESSION_DRAFT.durationMinutes,
  };
}

export function workshopFormFromRow(row: WorkshopSeriesRow): WorkshopFormState {
  const meta = parseClassSeriesMetadata(row.metadata);
  // `intakeFormId` was the original single-form field; reading both keeps a
  // workshop configured before the rewrite pointing at the same form.
  const formIds = meta.intakeFormIds?.length
    ? meta.intakeFormIds
    : meta.intakeFormId
      ? [meta.intakeFormId]
      : [];
  const isFree = meta.isFree !== false && !(meta.priceCents && meta.priceCents > 0);
  const rule = (row.recurrenceRule || {}) as { timezone?: unknown };

  return {
    name: row.name || "",
    description: row.description || "",
    category: meta.category || "",
    imageUrl: meta.imageUrl || "",
    active: row.active !== false,
    visibility: meta.visibility === "hidden" ? "hidden" : "public",
    cancelledAt: meta.cancelledAt || "",

    schedule: scheduleFromRow(row),
    timezone: meta.timezone || (typeof rule.timezone === "string" ? rule.timezone : ""),

    locationMode:
      meta.locationMode === "virtual" || meta.locationMode === "custom"
        ? meta.locationMode
        : "in_person",
    locationId: row.locationId || "",
    virtualUrl: meta.virtualUrl || "",
    locationNote: meta.locationNote || "",
    staffId: row.staffId || "",
    resourceIds: meta.resourceIds || [],

    capacity: Number(row.capacity ?? 20) || 20,
    showRemainingSpots: meta.showRemainingSpots !== false,
    registrationOpensAt: toLocalInput(meta.registrationOpensAt),
    registrationClosesAt: toLocalInput(meta.registrationClosesAt),
    waitlistEnabled: meta.waitlistEnabled === true,
    waitlistAutoPromote: meta.waitlistAutoPromote === true,
    waitlistOfferExpiresHours: Number(meta.waitlistOfferExpiresHours ?? 24) || 24,

    isFree,
    priceCents: Number(meta.priceCents ?? 0) || 0,
    paymentMode: isFree ? "free" : "on_site",
    packageProductIds: meta.packageProductIds || [],
    membershipProductIds: meta.membershipProductIds || [],
    memberOnly: meta.memberOnly === true,

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

export function workshopMetadataFromForm(form: WorkshopFormState): ClassSeriesMetadata {
  return {
    kind: "workshop",
    visibility: form.visibility,
    imageUrl: form.imageUrl.trim() || undefined,
    category: form.category.trim() || undefined,
    timezone: form.timezone || undefined,
    cancelledAt: form.cancelledAt || undefined,

    locationMode: form.locationMode,
    virtualUrl: form.virtualUrl.trim() || undefined,
    locationNote: form.locationNote.trim() || undefined,
    resourceIds: form.resourceIds,

    showRemainingSpots: form.showRemainingSpots,
    registrationOpensAt: fromLocalInput(form.registrationOpensAt),
    registrationClosesAt: fromLocalInput(form.registrationClosesAt),
    waitlistEnabled: form.waitlistEnabled,
    waitlistAutoPromote: form.waitlistAutoPromote,
    waitlistOfferExpiresHours: form.waitlistOfferExpiresHours,

    isFree: form.isFree,
    priceCents: form.isFree ? 0 : form.priceCents,
    paymentMode: form.isFree ? "free" : "on_site",
    packageProductIds: form.packageProductIds,
    membershipProductIds: form.membershipProductIds,
    memberOnly: form.memberOnly,

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

export function workshopSavePayload(form: WorkshopFormState, id?: string) {
  return {
    id,
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    capacity: form.capacity,
    // A virtual workshop has no room, and saving a stale room id would put the
    // wrong address on the registration page.
    staffId: form.staffId || undefined,
    locationId: form.locationMode === "in_person" ? form.locationId || undefined : undefined,
    active: form.active,
    recurrenceRule: {
      pattern: "one_time",
      startDate: form.schedule.date,
      startTime: form.schedule.startTime,
      durationMinutes: form.schedule.durationMinutes,
    },
    metadata: workshopMetadataFromForm(form),
  };
}

/** Blocking problems, phrased as the fix rather than the rule. */
export function validateWorkshopForm(form: WorkshopFormState): string {
  if (!form.name.trim()) return "Workshop name is required";
  if (!Number.isFinite(form.capacity) || form.capacity < 1) {
    return "Capacity must be at least 1";
  }
  if (!form.isFree && form.priceCents <= 0) {
    return "Set a price above $0, or mark the workshop free";
  }
  if (form.locationMode === "virtual" && form.virtualUrl.trim()) {
    try {
      new URL(form.virtualUrl.trim());
    } catch {
      return "Enter a full joining link, starting with https://";
    }
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

/** Whether a capacity change would strand people who already registered. */
export function capacityBelowRegistered(capacity: number, registered: number): boolean {
  return Number.isFinite(capacity) && capacity > 0 && capacity < registered;
}
