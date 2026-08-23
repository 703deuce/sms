import { createServiceClient } from "@/lib/db/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  artifactContentType,
  artifactFileExtension,
  SINGLE_SCAN_PDF_TEMPLATE_VERSION,
  type CompetitorLimit,
  type ReportArtifactKind,
} from "@/lib/reporting/pdf/constants";
import { assertSafeArtifactStoragePath } from "@/lib/reporting/artifact-path";

export { assertSafeArtifactStoragePath } from "@/lib/reporting/artifact-path";

const REPORTS_BUCKET = "reports";

export function artifactStoragePath(params: {
  businessId: string;
  scanBatchId: string;
  kind: ReportArtifactKind;
  reportId: string;
}): string {
  const ext = artifactFileExtension(params.kind);
  return `businesses/${params.businessId}/scans/${params.scanBatchId}/${params.kind}/${params.reportId}.${ext}`;
}

export function brandingVersionFromWhiteLabel(wl: {
  companyName?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  footerText?: string | null;
  hidePlatformBranding?: boolean;
}): string {
  return [
    wl.companyName ?? "",
    wl.logoUrl ?? "",
    wl.accentColor ?? "",
    wl.footerText ?? "",
    wl.hidePlatformBranding ? "1" : "0",
  ].join("|");
}

export function artifactIdentityKey(params: {
  kind: ReportArtifactKind;
  scanBatchId: string;
  competitorLimit?: CompetitorLimit;
  brandingVersion: string;
  dataVersion: string;
}): string {
  const limit = params.competitorLimit ?? 20;
  return [
    params.kind,
    "single_scan",
    params.scanBatchId,
    SINGLE_SCAN_PDF_TEMPLATE_VERSION,
    `comp:${limit}`,
    `brand:${params.brandingVersion.slice(0, 64)}`,
    `data:${params.dataVersion}`,
  ].join(":");
}

export async function findReadyArtifact(params: {
  businessId: string;
  identityKey: string;
}): Promise<{
  id: string;
  storagePath: string | null;
  contentType: string | null;
  artifactKind: string | null;
} | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("reports")
    .select("id, storage_path, content_type, artifact_kind, artifact_status")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>identityKey", params.identityKey)
    .eq("artifact_status", "ready")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id as string,
    storagePath: (data.storage_path as string | null) ?? null,
    contentType: (data.content_type as string | null) ?? null,
    artifactKind: (data.artifact_kind as string | null) ?? null,
  };
}

export async function uploadReportArtifact(params: {
  path: string;
  buffer: Buffer;
  contentType: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(REPORTS_BUCKET).upload(params.path, params.buffer, {
    contentType: params.contentType,
    upsert: true,
  });
  if (error) throw new Error(`Artifact upload failed: ${error.message}`);
}

export async function createSignedArtifactUrl(params: {
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  assertSafeArtifactStoragePath(params.path);
  const { data, error } = await supabaseAdmin.storage
    .from(REPORTS_BUCKET)
    .createSignedUrl(params.path, params.expiresInSeconds ?? 600);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Failed to create signed URL");
  }
  return data.signedUrl;
}

export async function markArtifactReady(params: {
  reportId: string;
  businessId: string;
  storagePath: string;
  kind: ReportArtifactKind;
  bytes: number;
  generationMs: number;
  identityKey: string;
  scanBatchId: string;
  brandingVersion: string;
  dataVersion: string;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("reports")
    .update({
      storage_path: params.storagePath,
      artifact_kind: params.kind,
      artifact_status: "ready",
      content_type: artifactContentType(params.kind),
      artifact_bytes: params.bytes,
      generation_ms: params.generationMs,
      template_version: SINGLE_SCAN_PDF_TEMPLATE_VERSION,
      branding_version: params.brandingVersion,
      data_version: params.dataVersion,
      error_message: null,
      generated_at: new Date().toISOString(),
      scan_batch_id: params.scanBatchId,
      metadata_json: {
        reportType: "single_scan",
        identityKey: params.identityKey,
        artifactKind: params.kind,
        templateVersion: SINGLE_SCAN_PDF_TEMPLATE_VERSION,
      },
    })
    .eq("id", params.reportId)
    .eq("business_id", params.businessId);
}

export { artifactContentType };
