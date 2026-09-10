/** Customer-facing offering kind for ClassSeries rows (workshops use event-style registration). */
export type ClassSeriesOfferingKind = "class" | "workshop";

export function resolveClassSeriesOfferingKind(metadata: unknown): ClassSeriesOfferingKind {
  if (!metadata || typeof metadata !== "object") return "class";
  const kind = String((metadata as { kind?: string }).kind || "").toLowerCase();
  if (kind === "workshop" || kind === "event") return "workshop";
  return "class";
}

export function metadataForOfferingKind(kind: ClassSeriesOfferingKind): Record<string, string> {
  return { kind: kind === "workshop" ? "workshop" : "class" };
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
  },
  workshop: {
    pageTitle: "Workshops",
    pageDescription: "Create one-time or limited-run sessions customers can register for.",
    createButtonLabel: "Create workshop",
    listPanelTitle: "All workshops",
    listEmptyMessage: "Create one-time or limited-run sessions for customer registration.",
    editorBackLabel: "Back to workshops",
    publicPathSuffix: "classes",
  },
} as const;
