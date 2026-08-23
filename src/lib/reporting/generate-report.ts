import { generateShareToken, hashShareToken } from "@/lib/reporting/share-token";
import { createServiceClient } from "@/lib/db/client";
import { buildCompetitorReport } from "@/lib/reporting/build-competitor";
import { buildKeywordReport } from "@/lib/reporting/build-keyword";
import { buildLocationReport } from "@/lib/reporting/build-location";
import { buildMapsCampaignReport } from "@/lib/reporting/build-maps-campaign";
import { buildReviewCampaignReport } from "@/lib/reporting/build-review-campaign";
import { buildReviewsReport } from "@/lib/reporting/build-reviews";
import { buildSingleScanReport } from "@/lib/reporting/build-single-scan";
import { buildTrendReport } from "@/lib/reporting/build-trend";
import { renderReportHtml } from "@/lib/reporting/render-html";
import type {
  AnyReportPayload,
  ReportType,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

export type GenerateReportParams = {
  businessId: string;
  scanBatchId?: string;
  reportType?: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  whiteLabel?: Partial<WhiteLabelConfig>;
  /** When false, build HTML/payload without upserting a shareable report row. */
  persist?: boolean;
  /** Prefer updating this generating share row (async share flow). */
  reportId?: string | null;
  /** Preserve an already-issued share token when filling a generating row. */
  shareToken?: string | null;
  /**
   * Stable share identity from create-time. When set (async share flow), must win
   * over recomputed keys so worker updates don't rewrite competitor:…:default → top-5.
   */
  identityKey?: string | null;
  executiveSummary?: string | null;
  sections?: Partial<Record<string, boolean>> | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  workCompleted?: string | null;
  freelancerNotes?: string | null;
  nextSteps?: string | null;
  periodLabel?: string | null;
  /** Initial publish status when creating/updating the share row. */
  publishStatus?: "draft" | "published" | null;
};

export type GenerateReportResult = {
  reportId: string | null;
  shareToken: string | null;
  html: string;
  payload: AnyReportPayload;
};

type ReportMeta = {
  reportType?: string;
  identityKey?: string;
};

/** Drop bulky fields from metadata_json while keeping KPI/identity useful. */
function slimReportPayloadForMetadata(payload: AnyReportPayload): AnyReportPayload {
  if (payload.reportType === "single_scan") {
    return {
      ...payload,
      heatmap: {
        gridSize: payload.heatmap.gridSize,
        cells: [],
      },
      competitors: payload.competitors.slice(0, 25).map((c) => ({
        ...c,
        address: c.address ? c.address.slice(0, 120) : c.address,
      })),
    };
  }
  if (payload.reportType === "competitor") {
    return {
      ...payload,
      competitors: payload.competitors.slice(0, 40),
    };
  }
  return payload;
}

function reportIdentityKey(
  payload: AnyReportPayload,
  params: GenerateReportParams
): string {
  switch (payload.reportType) {
    case "single_scan":
      return `single_scan:${payload.parameters.scanId}`;
    case "competitor":
      // Use post-default selection from the payload (builder fills top 5 when empty).
      return `competitor:${payload.parameters.scanId}:${[...payload.selectedCompetitorKeys]
        .sort()
        .join(",")}`;
    case "trend":
      return [
        "trend",
        params.keywordId ?? payload.parameters.keyword,
        payload.parameters.locationId ?? "biz",
        payload.parameters.gridSize,
        payload.parameters.radiusMeters,
      ].join(":");
    case "location":
      return "location";
    case "keyword":
      return [
        "keyword",
        payload.parameters.keywordId ?? payload.parameters.keyword,
        payload.parameters.gridSize,
        payload.parameters.radiusMeters,
      ].join(":");
    case "maps_campaign":
      return `maps_campaign:${params.campaignId ?? payload.parameters.campaignId ?? "default"}`;
    case "reviews":
      return "reviews";
    case "review_campaign":
      return `review_campaign:${payload.parameters.campaignId}`;
    default: {
      const _exhaustive: never = payload;
      return String((_exhaustive as AnyReportPayload).reportType);
    }
  }
}

/** Persist scan_batch_id only when the report is fundamentally about that scan. */
function persistScanBatchId(payload: AnyReportPayload): string | null {
  if (payload.reportType === "single_scan" || payload.reportType === "competitor") {
    return payload.parameters.scanId;
  }
  return null;
}

async function resolveExistingShare(
  supabase: ReturnType<typeof createServiceClient>,
  params: {
    businessId: string;
    reportType: string;
    identityKey: string;
  }
): Promise<{ existingReportId: string | null; shareToken: string; shareExpiresAt: string }> {
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Exact reportType + identityKey match — never collapse across campaigns/types.
  const { data: existingReports } = await supabase
    .from("reports")
    .select("id, share_token, share_expires_at, metadata_json")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .order("generated_at", { ascending: false })
    .limit(1);

  const matched = (existingReports ?? [])[0] ?? null;

  const existingExpiresAt = matched?.share_expires_at
    ? new Date(matched.share_expires_at as string).getTime()
    : null;
  const existingExpired =
    existingExpiresAt !== null &&
    Number.isFinite(existingExpiresAt) &&
    existingExpiresAt <= Date.now();
  const shareToken =
    matched?.share_token && !existingExpired
      ? (matched.share_token as string)
      : generateShareToken();

  return {
    existingReportId: (matched?.id as string | undefined) ?? null,
    shareToken,
    shareExpiresAt,
  };
}

async function persistReport(params: {
  businessId: string;
  html: string;
  payload: AnyReportPayload;
  identityKey: string;
  reportId?: string | null;
  preferShareToken?: string | null;
  publishStatus?: "draft" | "published" | null;
}): Promise<GenerateReportResult> {
  const supabase = createServiceClient();
  const scanBatchId = persistScanBatchId(params.payload);
  const resolved = await resolveExistingShare(supabase, {
    businessId: params.businessId,
    reportType: params.payload.reportType,
    identityKey: params.identityKey,
  });
  const existingReportId = params.reportId ?? resolved.existingReportId;
  const shareToken = params.preferShareToken || resolved.shareToken;
  const shareExpiresAt = resolved.shareExpiresAt;

  // Keep metadata lean — full heatmap cells + HTML already live in html_content.
  // Oversized metadata_json has caused share/export instability on large grids.
  const slimPayload = slimReportPayloadForMetadata(params.payload);
  const execSummary =
    "executiveSummary" in params.payload
      ? (params.payload as { executiveSummary?: string | null }).executiveSummary
      : null;
  const sections =
    "sections" in params.payload
      ? (params.payload as { sections?: Partial<Record<string, boolean>> | null })
          .sections
      : null;

  let prevMeta: Record<string, unknown> = {};
  if (existingReportId) {
    const { data: prev } = await supabase
      .from("reports")
      .select("metadata_json")
      .eq("id", existingReportId)
      .eq("business_id", params.businessId)
      .maybeSingle();
    prevMeta = (prev?.metadata_json as Record<string, unknown>) ?? {};
  }

  const workCompleted =
    typeof params.payload.workCompleted === "string"
      ? params.payload.workCompleted
      : typeof prevMeta.workCompleted === "string"
        ? prevMeta.workCompleted
        : null;
  const freelancerNotes =
    typeof params.payload.freelancerNotes === "string"
      ? params.payload.freelancerNotes
      : typeof prevMeta.freelancerNotes === "string"
        ? prevMeta.freelancerNotes
        : null;
  const nextSteps =
    typeof params.payload.nextSteps === "string"
      ? params.payload.nextSteps
      : typeof prevMeta.nextSteps === "string"
        ? prevMeta.nextSteps
        : null;

  const metadata = {
    ...prevMeta,
    reportType: params.payload.reportType,
    identityKey: params.identityKey,
    payload: slimPayload,
    generatedAt: params.payload.generatedAt,
    artifactKind: "html_share",
    ...(typeof execSummary === "string"
      ? { executiveSummary: execSummary }
      : typeof prevMeta.executiveSummary === "string"
        ? { executiveSummary: prevMeta.executiveSummary }
        : {}),
    ...(sections
      ? { sections }
      : prevMeta.sections
        ? { sections: prevMeta.sections }
        : {}),
    ...(workCompleted != null ? { workCompleted } : {}),
    ...(freelancerNotes != null ? { freelancerNotes } : {}),
    ...(nextSteps != null ? { nextSteps } : {}),
    ...(params.payload.reportType === "maps_campaign" ||
    params.payload.reportType === "review_campaign"
      ? {
          campaignId:
            (params.payload as { parameters?: { campaignId?: string | null } })
              .parameters?.campaignId ??
            prevMeta.campaignId ??
            null,
        }
      : {}),
  } satisfies ReportMeta & Record<string, unknown>;

  const publishStatus = params.publishStatus === "draft" ? "draft" : "published";

  if (existingReportId) {
    const { data: report, error } = await supabase
      .from("reports")
      .update({
        share_token: shareToken,
        share_token_hash: hashShareToken(shareToken),
        share_expires_at: shareExpiresAt,
        html_content: params.html,
        metadata_json: metadata,
        generated_at: new Date().toISOString(),
        scan_batch_id: scanBatchId,
        artifact_kind: "html_share",
        artifact_status: "ready",
        publish_status: publishStatus,
        error_message: null,
      })
      .eq("id", existingReportId)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (error || !report) throw new Error(error?.message ?? "Failed to update report");
    return {
      reportId: report.id,
      shareToken,
      html: params.html,
      payload: params.payload,
    };
  }

  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: scanBatchId,
      share_token: shareToken,
        share_token_hash: hashShareToken(shareToken),
      share_expires_at: shareExpiresAt,
      html_content: params.html,
      metadata_json: metadata,
      artifact_kind: "html_share",
      artifact_status: "ready",
      publish_status: publishStatus,
    })
    .select("id")
    .single();

  // Concurrent create of the same identity — fall back to update the winner row.
  if (error && /duplicate|unique/i.test(error.message)) {
    const retry = await resolveExistingShare(supabase, {
      businessId: params.businessId,
      reportType: params.payload.reportType,
      identityKey: params.identityKey,
    });
    if (!retry.existingReportId) {
      throw new Error(error.message);
    }
    const { data: updated, error: updateErr } = await supabase
      .from("reports")
      .update({
        share_token: retry.shareToken,
        share_expires_at: retry.shareExpiresAt,
        html_content: params.html,
        metadata_json: metadata,
        generated_at: new Date().toISOString(),
        scan_batch_id: scanBatchId,
        artifact_kind: "html_share",
        artifact_status: "ready",
        error_message: null,
      })
      .eq("id", retry.existingReportId)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (updateErr || !updated) throw new Error(updateErr?.message ?? "Failed to update report");
    return {
      reportId: updated.id,
      shareToken: retry.shareToken,
      html: params.html,
      payload: params.payload,
    };
  }

  if (error || !report) throw new Error(error?.message ?? "Failed to create report");
  return {
    reportId: report.id,
    shareToken,
    html: params.html,
    payload: params.payload,
  };
}

export async function buildTypedReportPayload(
  params: GenerateReportParams
): Promise<AnyReportPayload> {
  const reportType = params.reportType ?? "single_scan";

  if (reportType === "single_scan") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for single_scan reports");
    return buildSingleScanReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "trend") {
    return buildTrendReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      locationId: params.locationId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }

  if (reportType === "competitor") {
    if (!params.scanBatchId) throw new Error("scanBatchId is required for competitor reports");
    return buildCompetitorReport({
      businessId: params.businessId,
      scanBatchId: params.scanBatchId,
      selectedCompetitorKeys: params.selectedCompetitorKeys,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "location") {
    return buildLocationReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }

  if (reportType === "keyword") {
    return buildKeywordReport({
      businessId: params.businessId,
      keywordId: params.keywordId,
      gridSize: params.gridSize,
      radiusMeters: params.radiusMeters,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "maps_campaign") {
    return buildMapsCampaignReport({
      businessId: params.businessId,
      campaignId: params.campaignId,
      whiteLabel: params.whiteLabel,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    });
  }

  if (reportType === "reviews") {
    return buildReviewsReport({
      businessId: params.businessId,
      whiteLabel: params.whiteLabel,
    });
  }

  if (reportType === "review_campaign") {
    if (!params.campaignId) {
      throw new Error("campaignId is required for review_campaign reports");
    }
    return buildReviewCampaignReport({
      businessId: params.businessId,
      campaignId: params.campaignId,
      whiteLabel: params.whiteLabel,
    });
  }

  throw new Error(`Report type "${reportType}" is not implemented yet`);
}

export async function generateTypedReport(
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  const { withReportGenerationTimeout } = await import("@/lib/reporting/report-timeout");
  const { enrichReportPayload } = await import("@/lib/reporting/enrich-report");
  return withReportGenerationTimeout(async () => {
    let payload = await buildTypedReportPayload(params);
    if (
      params.executiveSummary != null ||
      params.sections != null
    ) {
      payload = {
        ...payload,
        ...(params.executiveSummary != null
          ? { executiveSummary: params.executiveSummary }
          : {}),
        ...(params.sections != null ? { sections: params.sections } : {}),
      } as AnyReportPayload;
    }
    // Always merge approved summary/sections from the report row when regenerating.
    if (params.reportId) {
      const supabase = createServiceClient();
      const { data: existing } = await supabase
        .from("reports")
        .select("metadata_json")
        .eq("id", params.reportId)
        .eq("business_id", params.businessId)
        .maybeSingle();
      const meta = (existing?.metadata_json as Record<string, unknown>) ?? {};
      const fromMetaSummary =
        typeof meta.executiveSummary === "string" ? meta.executiveSummary : null;
      const fromMetaSections =
        meta.sections && typeof meta.sections === "object"
          ? (meta.sections as Partial<Record<string, boolean>>)
          : null;
      payload = {
        ...payload,
        executiveSummary:
          params.executiveSummary ??
          (payload as { executiveSummary?: string | null }).executiveSummary ??
          fromMetaSummary,
        sections:
          params.sections ??
          (payload as { sections?: Partial<Record<string, boolean>> | null }).sections ??
          fromMetaSections,
        workCompleted:
          params.workCompleted ??
          (typeof meta.workCompleted === "string" ? meta.workCompleted : null),
        freelancerNotes:
          params.freelancerNotes ??
          (typeof meta.freelancerNotes === "string" ? meta.freelancerNotes : null),
        nextSteps:
          params.nextSteps ??
          (typeof meta.nextSteps === "string" ? meta.nextSteps : null),
      } as AnyReportPayload;
    }

    payload = await enrichReportPayload(payload, {
      executiveSummary: params.executiveSummary,
      sections: params.sections ?? payload.sections,
      workCompleted: params.workCompleted,
      freelancerNotes: params.freelancerNotes,
      nextSteps: params.nextSteps,
      periodLabel: params.periodLabel,
    });

    const html = renderReportHtml(payload);
    const identityKey = params.identityKey?.trim() || reportIdentityKey(payload, params);

    if (params.persist === false) {
      return {
        reportId: null,
        shareToken: null,
        html,
        payload,
      };
    }

    return persistReport({
      businessId: params.businessId,
      html,
      payload,
      identityKey,
      reportId: params.reportId,
      preferShareToken: params.shareToken,
      publishStatus: params.publishStatus,
    });
  });
}

/** Backward-compatible entry: defaults to single_scan and requires scanBatchId. */
export async function generateReport(params: {
  businessId: string;
  scanBatchId: string;
  reportType?: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<{ reportId: string; shareToken: string; html: string }> {
  const result = await generateTypedReport({
    ...params,
    reportType: params.reportType ?? "single_scan",
  });
  if (!result.reportId || !result.shareToken) {
    throw new Error("Failed to persist report");
  }
  return {
    reportId: result.reportId,
    shareToken: result.shareToken,
    html: result.html,
  };
}
