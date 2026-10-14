import type { ReportType } from "@/lib/reporting/types";

/** Pull builder params from stored report metadata for HTML rebuilds. */
export function rebuildParamsFromMetadata(meta: Record<string, unknown>): {
  reportType: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  executiveSummary?: string | null;
  sections?: Partial<Record<string, boolean>> | null;
  identityKey?: string | null;
} {
  const payload = (meta.payload as Record<string, unknown> | undefined) ?? {};
  const parameters = (payload.parameters as Record<string, unknown> | undefined) ?? {};
  const reportType = (meta.reportType as ReportType | undefined) ?? "single_scan";

  const keywordId =
    (typeof parameters.keywordId === "string" ? parameters.keywordId : null) ??
    (typeof meta.keywordId === "string" ? meta.keywordId : null);
  const locationId =
    parameters.locationId === null
      ? null
      : typeof parameters.locationId === "string"
        ? parameters.locationId
        : undefined;
  const campaignId =
    (typeof parameters.campaignId === "string" ? parameters.campaignId : null) ??
    (typeof meta.campaignId === "string" ? meta.campaignId : null);
  const gridSize =
    typeof parameters.gridSize === "number"
      ? parameters.gridSize
      : typeof meta.gridSize === "number"
        ? meta.gridSize
        : null;
  const radiusMeters =
    typeof parameters.radiusMeters === "number"
      ? parameters.radiusMeters
      : typeof meta.radiusMeters === "number"
        ? meta.radiusMeters
        : null;
  const selectedCompetitorKeys = Array.isArray(
    (payload as { selectedCompetitorKeys?: unknown }).selectedCompetitorKeys
  )
    ? ((payload as { selectedCompetitorKeys: string[] }).selectedCompetitorKeys)
    : undefined;

  return {
    reportType,
    keywordId,
    locationId,
    campaignId,
    gridSize,
    radiusMeters,
    selectedCompetitorKeys,
    executiveSummary:
      typeof meta.executiveSummary === "string" ? meta.executiveSummary : null,
    sections:
      meta.sections && typeof meta.sections === "object"
        ? (meta.sections as Partial<Record<string, boolean>>)
        : null,
    identityKey: typeof meta.identityKey === "string" ? meta.identityKey : null,
  };
}
