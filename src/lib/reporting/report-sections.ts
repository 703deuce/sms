export type ReportSectionId =
  | "cover"
  | "executive_summary"
  | "maps_overview"
  | "maps_grid"
  | "comparison"
  | "trend"
  | "keyword_summary"
  | "competitors"
  | "ai_visibility"
  | "review_snapshot"
  | "work_completed"
  | "freelancer_notes"
  | "next_steps"
  | "footer";

export type ReportSectionsConfig = Partial<Record<ReportSectionId, boolean>>;

export const DEFAULT_REPORT_SECTIONS: Record<ReportSectionId, boolean> = {
  cover: true,
  executive_summary: true,
  maps_overview: true,
  maps_grid: true,
  comparison: true,
  trend: true,
  keyword_summary: true,
  competitors: true,
  ai_visibility: false,
  review_snapshot: true,
  work_completed: false,
  freelancer_notes: false,
  next_steps: false,
  footer: true,
};

export const REPORT_SECTION_LABELS: Record<ReportSectionId, string> = {
  cover: "Cover",
  executive_summary: "Executive summary",
  maps_overview: "Google Maps overview",
  maps_grid: "Maps grid",
  comparison: "Before-and-after comparison",
  trend: "Historical trend",
  keyword_summary: "Keyword summary",
  competitors: "Competitor visibility",
  ai_visibility: "AI visibility",
  review_snapshot: "Review snapshot",
  work_completed: "Work completed",
  freelancer_notes: "Freelancer notes",
  next_steps: "Next steps",
  footer: "Contact/footer",
};

export function resolveReportSections(
  partial?: ReportSectionsConfig | null
): Record<ReportSectionId, boolean> {
  return { ...DEFAULT_REPORT_SECTIONS, ...(partial ?? {}) };
}

export function isSectionEnabled(
  sections: ReportSectionsConfig | null | undefined,
  id: ReportSectionId
): boolean {
  return resolveReportSections(sections)[id];
}
