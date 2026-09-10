/** Customer-facing offering kind for ClassSeries rows (workshops use event-style registration). */
export type ClassSeriesOfferingKind = "class" | "workshop";

/** Extended ClassSeries metadata persisted in `class_series.metadata` JSON. */
export type ClassSeriesMetadata = {
  kind?: ClassSeriesOfferingKind | "event";
  visibility?: "public" | "hidden";
  imageUrl?: string;
  category?: string;
  priceCents?: number;
  isFree?: boolean;
  packageProductIds?: string[];
  membershipProductIds?: string[];
  memberOnly?: boolean;
  waitlistEnabled?: boolean;
  waitlistAutoPromote?: boolean;
  waitlistOfferExpiresHours?: number;
  intakeFormId?: string;
  cancellationPolicy?: string;
  termsUrl?: string;
  admissionEnabled?: boolean;
  confirmationMessage?: string;
  registrationOpensAt?: string;
  registrationClosesAt?: string;
  timezone?: string;
  showRemainingSpots?: boolean;
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
    occurrenceLabel: "Workshop session",
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
