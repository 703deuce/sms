import { createServiceClient } from "@/lib/db/client";
import {
  artifactContentType,
  brandingVersionFromWhiteLabel,
  findReadyArtifact,
  uploadReportArtifact,
} from "@/lib/reporting/artifacts";
import { generateTypedReport } from "@/lib/reporting/generate-report";
import {
  ROLLUP_PDF_TEMPLATE_VERSION,
  renderRollupPdf,
} from "@/lib/reporting/pdf/render-rollup-pdf";
import type { ReportType } from "@/lib/reporting/types";
import { logger } from "@/lib/observability/logger";

export type GenerateRollupArtifactResult = {
  reportId: string;
  kind: "pdf";
  storagePath: string;
  bytes: number;
  reused: boolean;
  downloadPath: string;
};

const ROLLUP_TYPES = new Set<ReportType>(["trend", "location", "maps_campaign"]);

function rollupIdentityKey(params: {
  reportType: ReportType;
  campaignId?: string | null;
  keywordId?: string | null;
  locationId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  brandingVersion: string;
  dataVersion: string;
}): string {
  return [
    "pdf",
    params.reportType,
    params.campaignId ?? "none",
    params.keywordId ?? "none",
    params.locationId ?? "biz",
    params.dateFrom ?? "",
    params.dateTo ?? "",
    ROLLUP_PDF_TEMPLATE_VERSION,
    `brand:${params.brandingVersion.slice(0, 64)}`,
    `data:${params.dataVersion}`,
  ].join(":");
}

export async function generateRollupPdfArtifact(params: {
  businessId: string;
  reportType: ReportType;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  force?: boolean;
}): Promise<GenerateRollupArtifactResult> {
  if (!ROLLUP_TYPES.has(params.reportType)) {
    throw new Error(`PDF artifacts for ${params.reportType} are not supported yet`);
  }

  const started = Date.now();
  const built = await generateTypedReport({
    businessId: params.businessId,
    reportType: params.reportType,
    keywordId: params.keywordId,
    locationId: params.locationId,
    campaignId: params.campaignId,
    gridSize: params.gridSize,
    radiusMeters: params.radiusMeters,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    persist: false,
  });

  const brandingVersion = brandingVersionFromWhiteLabel(built.payload.whiteLabel);
  const dataVersion = built.payload.generatedAt;
  const identityKey = rollupIdentityKey({
    reportType: params.reportType,
    campaignId: params.campaignId,
    keywordId: params.keywordId,
    locationId: params.locationId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    brandingVersion,
    dataVersion,
  });

  if (!params.force) {
    const ready = await findReadyArtifact({
      businessId: params.businessId,
      identityKey,
    });
    if (ready?.storagePath) {
      return {
        reportId: ready.id,
        kind: "pdf",
        storagePath: ready.storagePath,
        bytes: 0,
        reused: true,
        downloadPath: `/api/reports/artifacts/${ready.id}/download`,
      };
    }
  }

  const pdf = await renderRollupPdf(built.payload);
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("reports")
    .select("id")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>identityKey", identityKey)
    .limit(1)
    .maybeSingle();

  let reportId = existing?.id as string | undefined;
  if (!reportId) {
    const { data, error } = await supabase
      .from("reports")
      .insert({
        business_id: params.businessId,
        artifact_kind: "pdf",
        artifact_status: "generating",
        template_version: ROLLUP_PDF_TEMPLATE_VERSION,
        metadata_json: {
          reportType: params.reportType,
          identityKey,
          artifactKind: "pdf",
        },
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create PDF report row");
    reportId = data.id as string;
  } else {
    await supabase
      .from("reports")
      .update({
        artifact_status: "generating",
        artifact_kind: "pdf",
        error_message: null,
        template_version: ROLLUP_PDF_TEMPLATE_VERSION,
      })
      .eq("id", reportId);
  }

  const storagePath = `businesses/${params.businessId}/rollups/${params.reportType}/${reportId}.pdf`;
  await uploadReportArtifact({
    path: storagePath,
    buffer: pdf,
    contentType: artifactContentType("pdf"),
  });

  await supabase
    .from("reports")
    .update({
      storage_path: storagePath,
      artifact_kind: "pdf",
      artifact_status: "ready",
      content_type: artifactContentType("pdf"),
      artifact_bytes: pdf.byteLength,
      generation_ms: Date.now() - started,
      template_version: ROLLUP_PDF_TEMPLATE_VERSION,
      branding_version: brandingVersion,
      data_version: dataVersion,
      error_message: null,
      generated_at: new Date().toISOString(),
      metadata_json: {
        reportType: params.reportType,
        identityKey,
        artifactKind: "pdf",
        templateVersion: ROLLUP_PDF_TEMPLATE_VERSION,
      },
    })
    .eq("id", reportId)
    .eq("business_id", params.businessId);

  logger.info("rollup_pdf_artifact_ready", {
    businessId: params.businessId,
    reportType: params.reportType,
    reportId,
    bytes: pdf.byteLength,
    durationMs: Date.now() - started,
  });

  return {
    reportId,
    kind: "pdf",
    storagePath,
    bytes: pdf.byteLength,
    reused: false,
    downloadPath: `/api/reports/artifacts/${reportId}/download`,
  };
}
