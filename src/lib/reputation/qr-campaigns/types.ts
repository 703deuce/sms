import type { PosterConfig } from "@/lib/reputation/poster-config";

export const QR_PLACEMENT_TYPES = [
  "standard_poster",
  "front_desk",
  "counter_sign",
  "table_tent",
  "receipt_insert",
  "invoice",
  "business_card",
  "technician_leave_behind",
  "company_vehicle",
  "window_sign",
  "email_signature",
  "custom",
] as const;

export type QrPlacementType = (typeof QR_PLACEMENT_TYPES)[number];

export const QR_PLACEMENT_LABELS: Record<QrPlacementType, string> = {
  standard_poster: "Standard poster",
  front_desk: "Front desk",
  counter_sign: "Counter sign",
  table_tent: "Table tent",
  receipt_insert: "Receipt insert",
  invoice: "Invoice",
  business_card: "Business card",
  technician_leave_behind: "Technician leave-behind",
  company_vehicle: "Company vehicle",
  window_sign: "Window sign",
  email_signature: "Email signature",
  custom: "Custom placement",
};

export type QrCampaignStatus = "active" | "paused" | "draft" | "archived";
export type QrPrintFormat = "a4" | "a5" | "letter" | "qr_only";
export type QrCampaignType = "google_review" | "payment_review";

export type ReviewQrCampaign = {
  id: string;
  organizationId: string | null;
  businessId: string | null;
  ownerUserId: string | null;
  campaignType: QrCampaignType;
  publicSlug: string | null;
  name: string;
  placementType: QrPlacementType;
  customPlacementLabel: string | null;
  destinationUrl: string;
  shortCode: string;
  headline: string;
  description: string;
  brandColor: string;
  secondaryColor: string | null;
  templateKey: string;
  printFormat: QrPrintFormat;
  showFooter: boolean;
  posterConfig: PosterConfig;
  status: QrCampaignStatus;
  claimedAt: string | null;
  source: "app" | "public" | "migrated";
  migratedFromLinkId: string | null;
  totalScans: number;
  estimatedUniqueScans: number;
  botScans: number;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present only right after public create (plaintext claim token). */
  claimToken?: string;
};

export type ReviewQrScan = {
  id: string;
  campaignId: string;
  scannedAt: string;
  deviceCategory: string | null;
  browserCategory: string | null;
  osCategory: string | null;
  isBot: boolean;
  isPreview: boolean;
  counted: boolean;
};

export type QrCampaignAnalytics = {
  campaign: ReviewQrCampaign;
  trackedUrl: string;
  totalScans: number;
  estimatedUniqueScans: number;
  scansToday: number;
  scans7d: number;
  scans30d: number;
  botScans: number;
  deviceBreakdown: { mobile: number; desktop: number; tablet: number; other: number };
  daily: Array<{ date: string; totalScans: number; estimatedUniqueScans: number }>;
  newReviewsInPeriod: number | null;
  estimatedScanToReviewRatio: number | null;
  previousPeriodScans: number;
  correlationNote: string;
};

export type CreateQrCampaignInput = {
  organizationId: string;
  businessId: string;
  ownerUserId?: string | null;
  name: string;
  placementType?: QrPlacementType;
  customPlacementLabel?: string | null;
  destinationUrl: string;
  headline?: string;
  description?: string;
  brandColor?: string;
  printFormat?: QrPrintFormat;
  showFooter?: boolean;
  templateKey?: string;
  posterConfig?: PosterConfig;
  status?: QrCampaignStatus;
  source?: "app" | "public" | "migrated";
};
