import { appUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { DEFAULT_POSTER_CONFIG } from "@/lib/reputation/poster-config";
import { buildGoogleReviewUrl } from "@/lib/reputation/review-requests";
import { writeSecurityAuditEvent } from "@/lib/security/audit-log";
import { categorizeUserAgent, detectBotOrPreview } from "./bot-filter";
import { assertCanCreateQrCampaign } from "./limits";
import { resolveWritablePosterTemplateKey } from "./resolve-template-key";
import { rowToCampaign } from "./mapper";
import {
  assertAllowedQrDestination,
  generateClaimToken,
  generateShortCode,
  hashClaimToken,
  hashIpForQrScan,
} from "./security";
import type {
  CreateQrCampaignInput,
  QrCampaignAnalytics,
  QrCampaignStatus,
  ReviewQrCampaign,
} from "./types";

const UNIQUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const ANON_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ANON_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

function isMissingTable(message: string): boolean {
  return /does not exist|schema cache|review_qr_/i.test(message);
}

export function buildQrTrackedUrl(shortCode: string): string {
  return appUrl(`/r/${shortCode}`);
}

async function allocateUniqueShortCode(
  supabase: ReturnType<typeof createServiceClient>
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = generateShortCode();
    const { data } = await supabase
      .from("review_qr_campaigns")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return generateShortCode(16);
}

async function audit(
  eventType: string,
  message: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("review_qr_audit_events").insert({
    campaign_id: (payload.campaignId as string) ?? null,
    organization_id: (payload.organizationId as string) ?? null,
    business_id: (payload.businessId as string) ?? null,
    actor_user_id: (payload.actorUserId as string) ?? null,
    event_type: eventType,
    message,
    payload,
  });
  await writeSecurityAuditEvent({
    action: `qr_${eventType}`,
    organizationId: (payload.organizationId as string) ?? null,
    actorUserId: (payload.actorUserId as string) ?? null,
    resourceType: "review_qr_campaign",
    resourceId: (payload.campaignId as string) ?? null,
    meta: { message, ...payload },
  }).catch(() => undefined);
}

export async function createQrCampaign(
  input: CreateQrCampaignInput
): Promise<ReviewQrCampaign> {
  const destinationUrl = assertAllowedQrDestination(input.destinationUrl);
  const activating = (input.status ?? "active") === "active";
  await assertCanCreateQrCampaign({
    organizationId: input.organizationId,
    businessId: input.businessId,
    activating,
  });

  const supabase = createServiceClient();
  const shortCode = await allocateUniqueShortCode(supabase);
  const templateKey = await resolveWritablePosterTemplateKey({
    organizationId: input.organizationId,
    requested: input.templateKey,
  });
  const posterConfig = input.posterConfig ?? {
    ...DEFAULT_POSTER_CONFIG,
    title: input.headline ?? DEFAULT_POSTER_CONFIG.title,
    description: input.description ?? DEFAULT_POSTER_CONFIG.description,
    brandColor: input.brandColor ?? DEFAULT_POSTER_CONFIG.brandColor,
    showFooter: input.showFooter ?? true,
    format:
      input.printFormat && input.printFormat !== "qr_only"
        ? input.printFormat
        : "letter",
  };

  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      owner_user_id: input.ownerUserId ?? null,
      name: input.name.trim() || "QR Campaign",
      placement_type: input.placementType ?? "standard_poster",
      custom_placement_label: input.customPlacementLabel ?? null,
      destination_url: destinationUrl,
      short_code: shortCode,
      headline: input.headline ?? posterConfig.title,
      description: input.description ?? posterConfig.description,
      brand_color: input.brandColor ?? posterConfig.brandColor,
      print_format: input.printFormat ?? "letter",
      show_footer: input.showFooter ?? true,
      template_key: templateKey,
      poster_config: posterConfig,
      status: input.status ?? "active",
      source: input.source ?? "app",
      claimed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const campaign = rowToCampaign(data as Record<string, unknown>);
  await audit("campaign_created", "QR campaign created", {
    campaignId: campaign.id,
    organizationId: input.organizationId,
    businessId: input.businessId,
    actorUserId: input.ownerUserId,
    shortCode,
  });
  return campaign;
}

/** Public generator: anonymous project with claim token. */
export async function createAnonymousQrProject(input: {
  businessName: string;
  destinationUrl: string;
  headline?: string;
  description?: string;
  brandColor?: string;
  printFormat?: "a4" | "a5" | "letter";
}): Promise<ReviewQrCampaign> {
  const destinationUrl = assertAllowedQrDestination(input.destinationUrl);
  const supabase = createServiceClient();
  const shortCode = await allocateUniqueShortCode(supabase);
  const claimToken = generateClaimToken();
  const expires = new Date(Date.now() + ANON_TOKEN_TTL_MS).toISOString();
  const posterConfig = {
    ...DEFAULT_POSTER_CONFIG,
    title: input.headline ?? "Leave a review",
    description: input.description ?? "Scan with your phone",
    brandColor: input.brandColor ?? "#16A34A",
    format: input.printFormat ?? "letter",
  };

  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .insert({
      organization_id: null,
      business_id: null,
      name: `${input.businessName.trim() || "Business"} QR Poster`,
      placement_type: "standard_poster",
      destination_url: destinationUrl,
      short_code: shortCode,
      headline: posterConfig.title,
      description: posterConfig.description,
      brand_color: posterConfig.brandColor,
      print_format: posterConfig.format,
      show_footer: true,
      poster_config: posterConfig,
      status: "active",
      source: "public",
      anonymous_token_hash: hashClaimToken(claimToken),
      anonymous_token_expires_at: expires,
      claimed_at: null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const campaign = rowToCampaign(data as Record<string, unknown>);
  campaign.claimToken = claimToken;
  await audit("anonymous_created", "Anonymous QR project created", {
    campaignId: campaign.id,
    shortCode,
  });
  return campaign;
}

export async function claimAnonymousQrProject(params: {
  claimToken: string;
  organizationId: string;
  businessId: string;
  ownerUserId: string;
}): Promise<ReviewQrCampaign> {
  const supabase = createServiceClient();
  const tokenHash = hashClaimToken(params.claimToken);
  const { data: row, error } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("anonymous_token_hash", tokenHash)
    .is("claimed_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("This QR project was already claimed or the claim link expired.");

  const expires = row.anonymous_token_expires_at
    ? Date.parse(String(row.anonymous_token_expires_at))
    : 0;
  if (expires && Date.now() > expires) {
    throw new Error("This claim link has expired. Generate a new QR code.");
  }

  await assertCanCreateQrCampaign({
    organizationId: params.organizationId,
    businessId: params.businessId,
    activating: String(row.status) === "active",
  });

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await supabase
    .from("review_qr_campaigns")
    .update({
      organization_id: params.organizationId,
      business_id: params.businessId,
      owner_user_id: params.ownerUserId,
      claimed_at: now,
      anonymous_token_hash: null,
      anonymous_token_expires_at: null,
      updated_at: now,
    })
    .eq("id", row.id)
    .is("claimed_at", null)
    .select("*")
    .maybeSingle();

  if (upErr) throw new Error(upErr.message);
  if (!updated) throw new Error("Could not claim this QR project.");

  const campaign = rowToCampaign(updated as Record<string, unknown>);
  await audit("campaign_claimed", "Anonymous QR project claimed", {
    campaignId: campaign.id,
    organizationId: params.organizationId,
    businessId: params.businessId,
    actorUserId: params.ownerUserId,
  });
  return campaign;
}

export async function getQrCampaignByShortCode(
  shortCode: string
): Promise<ReviewQrCampaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("short_code", shortCode)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) return null;
    throw new Error(error.message);
  }
  return data ? rowToCampaign(data as Record<string, unknown>) : null;
}

export async function getQrCampaignForBusiness(params: {
  campaignId: string;
  businessId: string;
  organizationId: string;
}): Promise<ReviewQrCampaign | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("id", params.campaignId)
    .eq("business_id", params.businessId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) return null;
    throw new Error(error.message);
  }
  return data ? rowToCampaign(data as Record<string, unknown>) : null;
}

export async function listQrCampaigns(params: {
  organizationId: string;
  businessId: string;
  status?: QrCampaignStatus | "all";
  placementType?: string;
  q?: string;
}): Promise<ReviewQrCampaign[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("organization_id", params.organizationId)
    .eq("business_id", params.businessId)
    .order("created_at", { ascending: false });

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  } else {
    query = query.neq("status", "archived");
  }
  if (params.placementType) query = query.eq("placement_type", params.placementType);

  const { data, error } = await query;
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }

  let rows = (data ?? []).map((r) => rowToCampaign(r as Record<string, unknown>));
  const q = params.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.placementType.includes(q) ||
        (c.customPlacementLabel ?? "").toLowerCase().includes(q)
    );
  }
  return rows;
}

export async function updateQrCampaign(params: {
  campaignId: string;
  businessId: string;
  organizationId: string;
  actorUserId?: string;
  patch: Partial<{
    name: string;
    placementType: ReviewQrCampaign["placementType"];
    customPlacementLabel: string | null;
    destinationUrl: string;
    headline: string;
    description: string;
    brandColor: string;
    printFormat: ReviewQrCampaign["printFormat"];
    showFooter: boolean;
    posterConfig: ReviewQrCampaign["posterConfig"];
    status: QrCampaignStatus;
    templateKey: string;
  }>;
}): Promise<ReviewQrCampaign> {
  const existing = await getQrCampaignForBusiness(params);
  if (!existing) throw new Error("QR campaign not found.");

  if (params.patch.status === "active" && existing.status !== "active") {
    await assertCanCreateQrCampaign({
      organizationId: params.organizationId,
      businessId: params.businessId,
      activating: true,
    });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.patch.name != null) update.name = params.patch.name.trim();
  if (params.patch.placementType != null) update.placement_type = params.patch.placementType;
  if (params.patch.customPlacementLabel !== undefined) {
    update.custom_placement_label = params.patch.customPlacementLabel;
  }
  if (params.patch.destinationUrl != null) {
    update.destination_url = assertAllowedQrDestination(params.patch.destinationUrl);
  }
  if (params.patch.headline != null) update.headline = params.patch.headline;
  if (params.patch.description != null) update.description = params.patch.description;
  if (params.patch.brandColor != null) update.brand_color = params.patch.brandColor;
  if (params.patch.printFormat != null) update.print_format = params.patch.printFormat;
  if (params.patch.showFooter != null) update.show_footer = params.patch.showFooter;
  if (params.patch.posterConfig != null) update.poster_config = params.patch.posterConfig;
  if (params.patch.status != null) update.status = params.patch.status;
  if (params.patch.templateKey != null) {
    update.template_key = await resolveWritablePosterTemplateKey({
      organizationId: params.organizationId,
      requested: params.patch.templateKey,
    });
  }

  // Keep poster_config title/description/color in sync when top-level fields change.
  if (
    params.patch.headline != null ||
    params.patch.description != null ||
    params.patch.brandColor != null ||
    params.patch.showFooter != null ||
    params.patch.printFormat != null
  ) {
    const cfg = {
      ...existing.posterConfig,
      ...(params.patch.posterConfig ?? {}),
      title: params.patch.headline ?? existing.headline,
      description: params.patch.description ?? existing.description,
      brandColor: params.patch.brandColor ?? existing.brandColor,
      showFooter: params.patch.showFooter ?? existing.showFooter,
      format:
        (params.patch.printFormat ?? existing.printFormat) === "qr_only"
          ? existing.posterConfig.format
          : ((params.patch.printFormat ?? existing.printFormat) as "a4" | "a5" | "letter"),
    };
    update.poster_config = cfg;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .update(update)
    .eq("id", params.campaignId)
    .eq("business_id", params.businessId)
    .eq("organization_id", params.organizationId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (params.patch.destinationUrl && params.patch.destinationUrl !== existing.destinationUrl) {
    await audit("destination_changed", "QR destination URL updated", {
      campaignId: params.campaignId,
      organizationId: params.organizationId,
      businessId: params.businessId,
      actorUserId: params.actorUserId,
      from: existing.destinationUrl,
      to: params.patch.destinationUrl,
    });
  }
  if (params.patch.status && params.patch.status !== existing.status) {
    await audit(
      params.patch.status === "paused" ? "campaign_paused" : "campaign_status_changed",
      `QR campaign status → ${params.patch.status}`,
      {
        campaignId: params.campaignId,
        organizationId: params.organizationId,
        businessId: params.businessId,
        actorUserId: params.actorUserId,
        status: params.patch.status,
      }
    );
  }

  return rowToCampaign(data as Record<string, unknown>);
}

export async function duplicateQrCampaign(params: {
  campaignId: string;
  businessId: string;
  organizationId: string;
  ownerUserId?: string;
}): Promise<ReviewQrCampaign> {
  const existing = await getQrCampaignForBusiness(params);
  if (!existing) throw new Error("QR campaign not found.");
  return createQrCampaign({
    organizationId: params.organizationId,
    businessId: params.businessId,
    ownerUserId: params.ownerUserId,
    name: `${existing.name} (copy)`,
    placementType: existing.placementType,
    customPlacementLabel: existing.customPlacementLabel,
    destinationUrl: existing.destinationUrl,
    headline: existing.headline,
    description: existing.description,
    brandColor: existing.brandColor,
    printFormat: existing.printFormat === "qr_only" ? "letter" : existing.printFormat,
    showFooter: existing.showFooter,
    templateKey: existing.templateKey,
    posterConfig: existing.posterConfig,
    status: "active",
    source: "app",
  });
}

/**
 * Resolve QR short code for /r/{token}. Returns destination or null.
 * Records scan synchronously (fast path) before redirect.
 */
export async function resolveAndRecordQrScan(params: {
  shortCode: string;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  visitorId?: string;
}): Promise<{ destinationUrl: string | null; inactive: boolean; notFound: boolean }> {
  const campaign = await getQrCampaignByShortCode(params.shortCode);
  if (!campaign) return { destinationUrl: null, inactive: false, notFound: true };
  if (campaign.status !== "active") {
    return { destinationUrl: null, inactive: true, notFound: false };
  }

  if (campaign.campaignType === "payment_review") {
    const slug = campaign.publicSlug ?? campaign.shortCode;
    const destinationUrl = appUrl(`/p/${encodeURIComponent(slug)}`);
    await recordQrScanEvent({
      campaign,
      ip: params.ip,
      userAgent: params.userAgent,
      referrer: params.referrer,
      visitorId: params.visitorId,
    });
    return { destinationUrl, inactive: false, notFound: false };
  }

  let destinationUrl: string;
  try {
    destinationUrl = assertAllowedQrDestination(campaign.destinationUrl);
  } catch {
    return { destinationUrl: null, inactive: false, notFound: false };
  }
  // Await insert so we don't lose scans; keep work minimal for a fast redirect.
  await recordQrScanEvent({
    campaign,
    ip: params.ip,
    userAgent: params.userAgent,
    referrer: params.referrer,
    visitorId: params.visitorId,
  });
  return { destinationUrl, inactive: false, notFound: false };
}

export async function recordQrScanEvent(params: {
  campaign: ReviewQrCampaign;
  ip?: string;
  userAgent?: string;
  referrer?: string;
  visitorId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const { isBot, isPreview } = detectBotOrPreview(params.userAgent);
  const cats = categorizeUserAgent(params.userAgent);
  const ipHash = params.ip ? hashIpForQrScan(params.ip) : null;
  const now = new Date();
  const counted = !isBot && !isPreview;

  let isUnique = false;
  if (counted && ipHash) {
    const since = new Date(now.getTime() - UNIQUE_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("review_qr_scans")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", params.campaign.id)
      .eq("ip_hash", ipHash)
      .eq("counted", true)
      .gte("scanned_at", since);
    isUnique = (count ?? 0) === 0;
  } else if (counted) {
    isUnique = true;
  }

  await supabase.from("review_qr_scans").insert({
    campaign_id: params.campaign.id,
    organization_id: params.campaign.organizationId,
    business_id: params.campaign.businessId,
    scanned_at: now.toISOString(),
    ip_hash: ipHash,
    user_agent: params.userAgent?.slice(0, 500) ?? null,
    referrer: params.referrer?.slice(0, 500) ?? null,
    device_category: cats.deviceCategory,
    browser_category: cats.browserCategory,
    os_category: cats.osCategory,
    visitor_id: params.visitorId?.slice(0, 80) ?? null,
    is_bot: isBot,
    is_preview: isPreview,
    counted,
  });

  const campPatch: Record<string, unknown> = {
    updated_at: now.toISOString(),
  };
  if (counted) {
    campPatch.total_scans = params.campaign.totalScans + 1;
    campPatch.last_scanned_at = now.toISOString();
    if (isUnique) {
      campPatch.estimated_unique_scans = params.campaign.estimatedUniqueScans + 1;
    }
  } else {
    campPatch.bot_scans = params.campaign.botScans + 1;
  }

  await supabase
    .from("review_qr_campaigns")
    .update(campPatch)
    .eq("id", params.campaign.id);

  if (counted) {
    await upsertDailyStat({
      campaignId: params.campaign.id,
      organizationId: params.campaign.organizationId,
      businessId: params.campaign.businessId,
      date: now.toISOString().slice(0, 10),
      deviceCategory: cats.deviceCategory,
      isUnique,
    });
  }
}

async function upsertDailyStat(params: {
  campaignId: string;
  organizationId: string | null;
  businessId: string | null;
  date: string;
  deviceCategory: string;
  isUnique: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("review_qr_daily_stats")
    .select("*")
    .eq("campaign_id", params.campaignId)
    .eq("stat_date", params.date)
    .maybeSingle();

  const mobile = params.deviceCategory === "mobile" ? 1 : 0;
  const desktop = params.deviceCategory === "desktop" ? 1 : 0;
  const tablet = params.deviceCategory === "tablet" ? 1 : 0;
  const other = mobile || desktop || tablet ? 0 : 1;

  if (!existing) {
    await supabase.from("review_qr_daily_stats").insert({
      campaign_id: params.campaignId,
      organization_id: params.organizationId,
      business_id: params.businessId,
      stat_date: params.date,
      total_scans: 1,
      estimated_unique_scans: params.isUnique ? 1 : 0,
      mobile_scans: mobile,
      desktop_scans: desktop,
      tablet_scans: tablet,
      other_scans: other,
    });
    return;
  }

  await supabase
    .from("review_qr_daily_stats")
    .update({
      total_scans: Number(existing.total_scans ?? 0) + 1,
      estimated_unique_scans:
        Number(existing.estimated_unique_scans ?? 0) + (params.isUnique ? 1 : 0),
      mobile_scans: Number(existing.mobile_scans ?? 0) + mobile,
      desktop_scans: Number(existing.desktop_scans ?? 0) + desktop,
      tablet_scans: Number(existing.tablet_scans ?? 0) + tablet,
      other_scans: Number(existing.other_scans ?? 0) + other,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
}

async function countReviewsInRange(params: {
  businessId: string;
  fromIso: string;
  toIso: string;
}): Promise<number | null> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("business_reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .gte("published_at", params.fromIso)
    .lte("published_at", params.toIso);
  if (error) {
    if (isMissingTable(error.message)) return null;
    // Fallback column name
    const retry = await supabase
      .from("business_reviews")
      .select("id", { count: "exact", head: true })
      .eq("business_id", params.businessId)
      .gte("review_date", params.fromIso.slice(0, 10))
      .lte("review_date", params.toIso.slice(0, 10));
    if (retry.error) return null;
    return retry.count ?? 0;
  }
  return count ?? 0;
}

export async function getQrCampaignAnalytics(params: {
  campaignId: string;
  businessId: string;
  organizationId: string;
  days?: number;
}): Promise<QrCampaignAnalytics> {
  const campaign = await getQrCampaignForBusiness(params);
  if (!campaign) throw new Error("QR campaign not found.");

  const days = Math.min(Math.max(params.days ?? 30, 1), 365);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const prevFrom = new Date(from.getTime() - days * 86400000);
  const supabase = createServiceClient();

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const d7 = new Date(to.getTime() - 7 * 86400000);

  const { data: scans } = await supabase
    .from("review_qr_scans")
    .select("scanned_at, device_category, counted, is_bot")
    .eq("campaign_id", params.campaignId)
    .gte("scanned_at", prevFrom.toISOString())
    .order("scanned_at", { ascending: true });

  const counted = (scans ?? []).filter((s) => s.counted && !s.is_bot);
  const inPeriod = counted.filter((s) => Date.parse(String(s.scanned_at)) >= from.getTime());
  const prevPeriod = counted.filter((s) => {
    const t = Date.parse(String(s.scanned_at));
    return t >= prevFrom.getTime() && t < from.getTime();
  });

  const scansToday = counted.filter(
    (s) => Date.parse(String(s.scanned_at)) >= dayStart.getTime()
  ).length;
  const scans7d = counted.filter(
    (s) => Date.parse(String(s.scanned_at)) >= d7.getTime()
  ).length;

  const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0, other: 0 };
  for (const s of inPeriod) {
    const d = String(s.device_category ?? "other");
    if (d === "mobile") deviceBreakdown.mobile++;
    else if (d === "desktop") deviceBreakdown.desktop++;
    else if (d === "tablet") deviceBreakdown.tablet++;
    else deviceBreakdown.other++;
  }

  const { data: dailyRows } = await supabase
    .from("review_qr_daily_stats")
    .select("stat_date, total_scans, estimated_unique_scans")
    .eq("campaign_id", params.campaignId)
    .gte("stat_date", fromIso.slice(0, 10))
    .order("stat_date", { ascending: true });

  const daily = (dailyRows ?? []).map((r) => ({
    date: String(r.stat_date),
    totalScans: Number(r.total_scans ?? 0),
    estimatedUniqueScans: Number(r.estimated_unique_scans ?? 0),
  }));

  const newReviewsInPeriod = campaign.businessId
    ? await countReviewsInRange({
        businessId: campaign.businessId,
        fromIso,
        toIso,
      })
    : null;

  const periodScans = inPeriod.length;
  const estimatedScanToReviewRatio =
    newReviewsInPeriod != null && periodScans > 0
      ? Number((newReviewsInPeriod / periodScans).toFixed(3))
      : null;

  const correlationNote =
    newReviewsInPeriod == null
      ? "Review history is not available for this business yet. Showing QR scan analytics only."
      : `${periodScans} people scanned this QR code and your business received ${newReviewsInPeriod} new reviews during the same period. This is correlation, not verified attribution.`;

  return {
    campaign,
    trackedUrl: buildQrTrackedUrl(campaign.shortCode),
    totalScans: campaign.totalScans,
    estimatedUniqueScans: campaign.estimatedUniqueScans,
    scansToday,
    scans7d,
    scans30d: periodScans,
    botScans: campaign.botScans,
    deviceBreakdown,
    daily,
    newReviewsInPeriod,
    estimatedScanToReviewRatio,
    previousPeriodScans: prevPeriod.length,
    correlationNote,
  };
}

export async function getDefaultOrMigrateQrCampaign(params: {
  organizationId: string;
  businessId: string;
  ownerUserId?: string;
}): Promise<ReviewQrCampaign | null> {
  const existing = await listQrCampaigns({
    organizationId: params.organizationId,
    businessId: params.businessId,
  });
  if (existing[0]) return existing[0];

  // Migrate from legacy review_request_links poster if present.
  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("review_request_links")
    .select("*")
    .eq("business_id", params.businessId)
    .eq("organization_id", params.organizationId)
    .eq("is_active", true)
    .maybeSingle();

  const business = await getBusiness(params.businessId, params.organizationId);
  const placeId = business?.place_id ?? (link?.place_id as string | null) ?? null;
  const destination =
    (link?.review_url as string | undefined) ||
    (placeId ? buildGoogleReviewUrl(placeId) : null);
  if (!destination || !isSafeDestination(destination)) return null;

  const poster = (link?.poster_config as Record<string, unknown> | null) ?? {};
  try {
    const created = await createQrCampaign({
      organizationId: params.organizationId,
      businessId: params.businessId,
      ownerUserId: params.ownerUserId,
      name: "Default QR Poster",
      placementType: "standard_poster",
      destinationUrl: destination,
      headline: String(poster.title ?? "Love our service?"),
      description: String(poster.description ?? "Scan to leave a quick Google review"),
      brandColor: String(poster.brandColor ?? "#16A34A"),
      printFormat: (poster.format as "a4" | "a5" | "letter") ?? "letter",
      showFooter: poster.showFooter !== false,
      posterConfig: {
        ...DEFAULT_POSTER_CONFIG,
        ...poster,
        title: String(poster.title ?? DEFAULT_POSTER_CONFIG.title),
        description: String(poster.description ?? DEFAULT_POSTER_CONFIG.description),
        brandColor: String(poster.brandColor ?? DEFAULT_POSTER_CONFIG.brandColor),
        showFooter: poster.showFooter !== false,
        format: (poster.format as "a4" | "a5" | "letter") ?? "letter",
        selectedPhrases: Array.isArray(poster.selectedPhrases)
          ? (poster.selectedPhrases as string[])
          : [],
      },
      source: "migrated",
    });

    if (link?.id) {
      await supabase
        .from("review_qr_campaigns")
        .update({ migrated_from_link_id: link.id })
        .eq("id", created.id);
    }
    return { ...created, migratedFromLinkId: link?.id ? String(link.id) : null };
  } catch {
    return null;
  }
}

function isSafeDestination(url: string): boolean {
  try {
    assertAllowedQrDestination(url);
    return true;
  } catch {
    return false;
  }
}

export async function getBusinessQrSummary(params: {
  organizationId: string;
  businessId: string;
}): Promise<{
  scansThisMonth: number;
  estimatedUniqueScans: number;
  mostActivePlacement: string | null;
  campaignCount: number;
}> {
  const campaigns = await listQrCampaigns(params);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("review_qr_scans")
    .select("id", { count: "exact", head: true })
    .eq("business_id", params.businessId)
    .eq("counted", true)
    .eq("is_bot", false)
    .gte("scanned_at", monthStart.toISOString());

  const top = [...campaigns].sort((a, b) => b.totalScans - a.totalScans)[0];
  return {
    scansThisMonth: count ?? 0,
    estimatedUniqueScans: campaigns.reduce((s, c) => s + c.estimatedUniqueScans, 0),
    mostActivePlacement: top
      ? top.customPlacementLabel || top.name
      : null,
    campaignCount: campaigns.length,
  };
}

/** Cleanup abandoned anonymous projects past retention (keeps those with scans). */
export async function cleanupAbandonedAnonymousQrProjects(): Promise<number> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - ANON_RETENTION_MS).toISOString();
  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .select("id, total_scans")
    .is("claimed_at", null)
    .not("anonymous_token_hash", "is", null)
    .lt("created_at", cutoff)
    .eq("total_scans", 0);

  if (error) {
    if (isMissingTable(error.message)) return 0;
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((r) => String(r.id));
  if (!ids.length) return 0;
  await supabase.from("review_qr_campaigns").delete().in("id", ids);
  return ids.length;
}

export async function adminListQrCampaigns(params: {
  q?: string;
  limit?: number;
}): Promise<ReviewQrCampaign[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 100);
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }
  let rows = (data ?? []).map((r) => rowToCampaign(r as Record<string, unknown>));
  const q = params.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortCode.toLowerCase().includes(q) ||
        c.destinationUrl.toLowerCase().includes(q) ||
        (c.organizationId ?? "").includes(q)
    );
  }
  return rows;
}

export async function adminPauseQrCampaign(campaignId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("review_qr_campaigns")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  await audit("admin_paused", "Admin paused QR campaign", { campaignId });
}
