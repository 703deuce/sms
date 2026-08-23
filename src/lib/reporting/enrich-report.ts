import { loadAiVisibilityReportSection } from "@/lib/reporting/ai-visibility-section";
import { buildComparisonSection } from "@/lib/reporting/comparison-heatmaps";
import { isSectionEnabled } from "@/lib/reporting/report-sections";
import type { AnyReportPayload, ReportCommonFields } from "@/lib/reporting/types";

export type EnrichReportOptions = {
  includeAiVisibility?: boolean;
  workCompleted?: string | null;
  freelancerNotes?: string | null;
  nextSteps?: string | null;
  periodLabel?: string | null;
  executiveSummary?: string | null;
  sections?: Partial<Record<string, boolean>> | null;
};

/**
 * Attach AI Visibility + narrative fields. Comparison heatmaps are left to
 * builders that know baseline/current scan IDs; this only fills missing AI.
 */
export async function enrichReportPayload<T extends AnyReportPayload>(
  payload: T,
  options: EnrichReportOptions = {}
): Promise<T> {
  const sections = options.sections ?? payload.sections ?? null;
  const wantAi =
    options.includeAiVisibility === true ||
    (options.includeAiVisibility !== false &&
      isSectionEnabled(sections, "ai_visibility"));

  let aiVisibility = payload.aiVisibility ?? null;
  if (wantAi && !aiVisibility) {
    try {
      aiVisibility = await loadAiVisibilityReportSection(payload.business.id);
    } catch {
      aiVisibility = null;
    }
  }

  const common: ReportCommonFields = {
    executiveSummary: options.executiveSummary ?? payload.executiveSummary ?? null,
    sections,
    aiVisibility,
    comparison: payload.comparison ?? null,
    workCompleted: options.workCompleted ?? payload.workCompleted ?? null,
    freelancerNotes: options.freelancerNotes ?? payload.freelancerNotes ?? null,
    nextSteps: options.nextSteps ?? payload.nextSteps ?? null,
    periodLabel: options.periodLabel ?? payload.periodLabel ?? null,
  };

  return { ...payload, ...common };
}

/** Prefer an existing comparison; otherwise build from explicit scan IDs. */
export async function attachComparisonIfNeeded(
  payload: AnyReportPayload,
  params: {
    businessId: string;
    baselineScanId?: string | null;
    currentScanId?: string | null;
    mode?: "baseline" | "prior_period";
    keywordId?: string | null;
  }
): Promise<AnyReportPayload> {
  if (payload.comparison) return payload;
  if (!params.baselineScanId || !params.currentScanId) return payload;
  if (params.baselineScanId === params.currentScanId) return payload;
  try {
    const comparison = await buildComparisonSection({
      businessId: params.businessId,
      baselineScanId: params.baselineScanId,
      currentScanId: params.currentScanId,
      mode: params.mode,
      keywordId: params.keywordId,
    });
    if (!comparison) return payload;
    return { ...payload, comparison };
  } catch {
    return payload;
  }
}
