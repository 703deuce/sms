import { createServiceClient } from "@/lib/db/client";
import { publicReportShareUrl } from "@/lib/app-url";
import { generateShareToken, hashShareToken } from "@/lib/reporting/share-token";
import type { ReportType } from "@/lib/reporting/types";

/** Stable identity for share reuse / idempotent enqueue (no time bucket). */
export function shareIdentityKey(params: {
  reportType: ReportType;
  scanBatchId?: string | null;
  keywordId?: string | null;
  locationId?: string | null;
  campaignId?: string | null;
  gridSize?: number | null;
  radiusMeters?: number | null;
  selectedCompetitorKeys?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
}): string {
  const periodKey =
    params.dateFrom || params.dateTo
      ? `${params.dateFrom ?? ""}..${params.dateTo ?? ""}`
      : "all";
  switch (params.reportType) {
    case "single_scan":
      return `single_scan:${params.scanBatchId ?? "na"}`;
    case "competitor": {
      const keys = [...(params.selectedCompetitorKeys ?? [])].sort().join(",") || "default";
      return `competitor:${params.scanBatchId ?? "na"}:${keys}`;
    }
    case "trend":
      return [
        "trend",
        params.keywordId ?? "kw",
        params.locationId ?? "biz",
        params.gridSize ?? "g",
        params.radiusMeters ?? "r",
        periodKey,
      ].join(":");
    case "location":
      return `location:${periodKey}`;
    case "keyword":
      return [
        "keyword",
        params.keywordId ?? "kw",
        params.gridSize ?? "g",
        params.radiusMeters ?? "r",
      ].join(":");
    case "maps_campaign":
      return `maps_campaign:${params.campaignId ?? "default"}:${periodKey}`;
    case "reviews":
      return "reviews";
    case "review_campaign":
      return `review_campaign:${params.campaignId ?? "na"}`;
    default:
      return String(params.reportType);
  }
}

function isShareExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false; // null = never expires
  const ms = new Date(expiresAt).getTime();
  return Number.isFinite(ms) && ms <= Date.now();
}

export async function findReusableShare(params: {
  businessId: string;
  reportType: string;
  identityKey: string;
  /** When true, never return a ready row (force rebuild). */
  force?: boolean;
}): Promise<{
  reportId: string;
  shareToken: string;
  shareUrl: string;
  status: "ready" | "generating";
} | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, share_token, share_expires_at, html_content, artifact_status, publish_status, generated_at"
    )
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .not("share_token", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.share_token) return null;
  const publishStatus = String(data.publish_status ?? "published");
  if (publishStatus === "draft" || publishStatus === "archived") return null;
  if (isShareExpired(data.share_expires_at as string | null)) return null;

  const artifactStatus = String(data.artifact_status ?? "");
  if (artifactStatus === "generating") {
    return {
      reportId: data.id as string,
      shareToken: data.share_token as string,
      shareUrl: publicReportShareUrl(data.share_token as string),
      status: "generating",
    };
  }
  if (params.force) return null;
  if (data.html_content) {
    return {
      reportId: data.id as string,
      shareToken: data.share_token as string,
      shareUrl: publicReportShareUrl(data.share_token as string),
      status: "ready",
    };
  }
  return null;
}

/** Create or revive a generating share row for this identity. */
export async function createGeneratingShareRecord(params: {
  businessId: string;
  reportType: ReportType;
  identityKey: string;
  scanBatchId?: string | null;
  campaignId?: string | null;
  publishStatus?: "draft" | "published" | null;
}): Promise<{ reportId: string; shareToken: string; shareUrl: string }> {
  const publishStatus = params.publishStatus === "draft" ? "draft" : "published";
  const supabase = createServiceClient();
  const shareToken = generateShareToken();
  const shareTokenHash = hashShareToken(shareToken);
  const shareExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Prefer an in-flight generating row for the same identity (idempotent double-click).
  const { data: inflight } = await supabase
    .from("reports")
    .select("id, share_token")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .eq("artifact_status", "generating")
    .not("share_token", "is", null)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inflight?.id && inflight.share_token) {
    return {
      reportId: inflight.id as string,
      shareToken: inflight.share_token as string,
      shareUrl: publicReportShareUrl(inflight.share_token as string),
    };
  }

  // Revive any existing identity row (revoked/archived/expired/failed) so the
  // unique (business, reportType, identityKey) index never blocks re-share.
  const { data: existing } = await supabase
    .from("reports")
    .select("id, metadata_json")
    .eq("business_id", params.businessId)
    .eq("metadata_json->>reportType", params.reportType)
    .eq("metadata_json->>identityKey", params.identityKey)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scanBatchId =
    params.reportType === "single_scan" || params.reportType === "competitor"
      ? params.scanBatchId ?? null
      : null;

  const nextMeta = {
    ...((existing?.metadata_json as Record<string, unknown>) ?? {}),
    reportType: params.reportType,
    identityKey: params.identityKey,
    artifactKind: "html_share",
    campaignId: params.campaignId ?? null,
  };

  if (existing?.id) {
    const { data: revived, error: reviveErr } = await supabase
      .from("reports")
      .update({
        share_token: shareToken,
        share_token_hash: shareTokenHash,
        share_expires_at: shareExpiresAt,
        share_password_hash: null,
        share_view_count: 0,
        share_last_viewed_at: null,
        html_content: null,
        artifact_kind: "html_share",
        artifact_status: "generating",
        publish_status: publishStatus,
        error_message: null,
        scan_batch_id: scanBatchId,
        metadata_json: nextMeta,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("business_id", params.businessId)
      .select("id")
      .single();
    if (reviveErr || !revived) {
      throw new Error(reviveErr?.message ?? "Failed to revive share record");
    }
    return {
      reportId: revived.id as string,
      shareToken,
      shareUrl: publicReportShareUrl(shareToken),
    };
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      business_id: params.businessId,
      scan_batch_id: scanBatchId,
      share_token: shareToken,
      share_token_hash: shareTokenHash,
      share_expires_at: shareExpiresAt,
      html_content: null,
      artifact_kind: "html_share",
      artifact_status: "generating",
      publish_status: publishStatus,
      metadata_json: nextMeta,
    })
    .select("id")
    .single();

  if (error || !data) {
    // Unique race — revive whatever now owns the identity.
    const { data: raced } = await supabase
      .from("reports")
      .select("id")
      .eq("business_id", params.businessId)
      .eq("metadata_json->>reportType", params.reportType)
      .eq("metadata_json->>identityKey", params.identityKey)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (raced?.id) {
      const { data: revived, error: reviveErr } = await supabase
        .from("reports")
        .update({
          share_token: shareToken,
          share_token_hash: shareTokenHash,
          share_expires_at: shareExpiresAt,
          html_content: null,
          artifact_status: "generating",
          publish_status: publishStatus,
          error_message: null,
          metadata_json: nextMeta,
          generated_at: new Date().toISOString(),
        })
        .eq("id", raced.id)
        .select("id")
        .single();
      if (!reviveErr && revived) {
        return {
          reportId: revived.id as string,
          shareToken,
          shareUrl: publicReportShareUrl(shareToken),
        };
      }
    }
    throw new Error(error?.message ?? "Failed to create share record");
  }

  return {
    reportId: data.id as string,
    shareToken,
    shareUrl: publicReportShareUrl(shareToken),
  };
}
