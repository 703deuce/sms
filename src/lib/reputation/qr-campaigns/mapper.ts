import { DEFAULT_POSTER_CONFIG, parsePosterConfig } from "@/lib/reputation/poster-config";
import type {
  QrCampaignStatus,
  QrPlacementType,
  QrPrintFormat,
  ReviewQrCampaign,
} from "./types";

// ReviewQrCampaign includes campaignType + publicSlug

export function rowToCampaign(row: Record<string, unknown>): ReviewQrCampaign {
  const poster = parsePosterConfig(row.poster_config) ?? {
    ...DEFAULT_POSTER_CONFIG,
    title: String(row.headline ?? DEFAULT_POSTER_CONFIG.title),
    description: String(row.description ?? DEFAULT_POSTER_CONFIG.description),
    brandColor: String(row.brand_color ?? DEFAULT_POSTER_CONFIG.brandColor),
    showFooter: row.show_footer !== false,
    format: (String(row.print_format ?? "letter") as QrPrintFormat) === "qr_only"
      ? "letter"
      : (String(row.print_format ?? "letter") as "a4" | "a5" | "letter"),
  };

  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    businessId: row.business_id ? String(row.business_id) : null,
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    campaignType: (String(row.campaign_type ?? "google_review") as ReviewQrCampaign["campaignType"]),
    publicSlug: row.public_slug ? String(row.public_slug) : null,
    name: String(row.name ?? "QR Campaign"),
    placementType: String(row.placement_type ?? "standard_poster") as QrPlacementType,
    customPlacementLabel: row.custom_placement_label
      ? String(row.custom_placement_label)
      : null,
    destinationUrl: String(row.destination_url ?? ""),
    shortCode: String(row.short_code ?? ""),
    headline: String(row.headline ?? poster.title),
    description: String(row.description ?? poster.description),
    brandColor: String(row.brand_color ?? poster.brandColor),
    secondaryColor: row.secondary_color ? String(row.secondary_color) : null,
    templateKey: String(row.template_key ?? "classic_poster"),
    printFormat: String(row.print_format ?? "letter") as QrPrintFormat,
    showFooter: row.show_footer !== false,
    posterConfig: poster,
    status: String(row.status ?? "active") as QrCampaignStatus,
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
    source: (String(row.source ?? "app") as ReviewQrCampaign["source"]),
    migratedFromLinkId: row.migrated_from_link_id
      ? String(row.migrated_from_link_id)
      : null,
    totalScans: Number(row.total_scans ?? 0),
    estimatedUniqueScans: Number(row.estimated_unique_scans ?? 0),
    botScans: Number(row.bot_scans ?? 0),
    lastScannedAt: row.last_scanned_at ? String(row.last_scanned_at) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
