/** Customer-facing offering kind for ClassSeries rows (workshops use event-style registration). */
export type ClassSeriesOfferingKind = "class" | "workshop";

/** How a class repeats. Persisted on `class_series.recurrence_rule`. */
export type ClassRecurrence = {
  pattern?: "one_time" | "repeating";
  startDate?: string;
  startTime?: string;
  durationMinutes?: number;
  repeat?: "daily" | "weekly" | "biweekly" | "monthly";
  /** 0 = Sunday, matching `Date.getDay()`. */
  weekdays?: number[];
  endsMode?: "never" | "on" | "after";
  endsOn?: string;
  endsAfter?: number;
};

/**
 * A question asked at registration. Same shape as the appointment booking
 * question so the two can share editors and, later, one renderer.
 */
export type ClassBookingQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "checkbox" | "phone" | "email";
  required?: boolean;
  options?: string[];
};

/** Extended ClassSeries metadata persisted in `class_series.metadata` JSON. */
export type ClassSeriesMetadata = {
  kind?: ClassSeriesOfferingKind | "event";
  visibility?: "public" | "hidden";
  imageUrl?: string;
  category?: string;
  priceCents?: number;
  isFree?: boolean;
  /**
   * How a seat is paid for.
   * - `free` — no payment
   * - `package_only` — redeem package/membership (store purchase)
   * - `pay_at_registration` — card checkout on register (Phase 1b)
   * - `on_site` — legacy label; treated like package/contact for public guard until checkout ships
   */
  paymentMode?: "free" | "package_only" | "pay_at_registration" | "on_site";
  packageProductIds?: string[];
  membershipProductIds?: string[];
  memberOnly?: boolean;
  waitlistEnabled?: boolean;
  waitlistAutoPromote?: boolean;
  waitlistOfferExpiresHours?: number;
  intakeFormId?: string;
  intakeFormIds?: string[];
  bookingQuestions?: ClassBookingQuestion[];
  requireEmail?: boolean;
  requirePhone?: boolean;
  requireLastName?: boolean;
  resourceIds?: string[];
  cancellationPolicy?: string;
  cancellationWindowHours?: number;
  termsUrl?: string;
  admissionEnabled?: boolean;
  confirmationMessage?: string;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  timezone?: string;
  showRemainingSpots?: boolean;

  /* --- workshop-only ---------------------------------------------------
   * A workshop states where it happens in its own right: a class inherits a
   * room from the business, an event may be online or at a one-off venue.
   */
  locationMode?: "in_person" | "virtual" | "custom";
  virtualUrl?: string;
  locationNote?: string;
  /** Set when the operator calls the whole workshop off, which is not the same
   *  as deactivating it: registration stops but the history is kept. */
  cancelledAt?: string;
};

export function parseClassSeriesMetadata(metadata: unknown): ClassSeriesMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as ClassSeriesMetadata;
}

export function resolveClassSeriesOfferingKind(metadata: unknown): ClassSeriesOfferingKind {
  const kind = String(parseClassSeriesMetadata(metadata).kind || "").toLowerCase();
  if (kind === "workshop" || kind === "event") return "workshop";
  return "class";
}

export function metadataForOfferingKind(
  kind: ClassSeriesOfferingKind,
  existing?: ClassSeriesMetadata,
): ClassSeriesMetadata {
  return {
    ...existing,
    kind: kind === "workshop" ? "workshop" : "class",
  };
}

export const CLASS_SERIES_OFFERING_UI = {
  class: {
    pageTitle: "Classes",
    pageDescription: "Create scheduled group sessions customers can register for.",
    createButtonLabel: "Create class",
    listPanelTitle: "All classes",
    listEmptyMessage: "Create scheduled group sessions customers can join.",
    editorBackLabel: "Back to classes",
    publicPathSuffix: "classes",
    registerVerb: "Register",
    occurrenceLabel: "Class session",
  },
  workshop: {
    pageTitle: "Workshops",
    pageDescription: "Create one-time or limited-run sessions customers can register for.",
    createButtonLabel: "Create workshop",
    listPanelTitle: "All workshops",
    listEmptyMessage: "Create one-time or limited-run sessions for customer registration.",
    editorBackLabel: "Back to workshops",
    publicPathSuffix: "workshops",
    registerVerb: "Register",
    occurrenceLabel: "Workshop date",
  },
} as const;

export const CLASS_EDITOR_SECTIONS = [
  "general",
  "schedule",
  "instructor",
  "capacity",
  "pricing",
  "customer",
  "policies",
  "waitlist",
  "admission",
] as const;

export const WORKSHOP_EDITOR_SECTIONS = [
  "general",
  "datetime",
  "location",
  "registration",
  "pricing",
  "customer",
  "policies",
  "admission",
  "confirmation",
] as const;
