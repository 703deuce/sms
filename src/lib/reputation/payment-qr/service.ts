import { pageThemeFromPosterTemplate } from "@/lib/reputation/brand-themes";
import { appUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/db/client";
import { DEFAULT_POSTER_CONFIG } from "@/lib/reputation/poster-config";
import { assertCanCreateQrCampaign } from "@/lib/reputation/qr-campaigns/limits";
import { rowToCampaign } from "@/lib/reputation/qr-campaigns/mapper";
import { resolveWritablePosterTemplateKey } from "@/lib/reputation/qr-campaigns/resolve-template-key";
import {
  generateShortCode,
} from "@/lib/reputation/qr-campaigns/security";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { categorizeUserAgent, detectBotOrPreview } from "@/lib/reputation/qr-campaigns/bot-filter";
import { hashIpForQrScan } from "@/lib/reputation/qr-campaigns/security";
import { getPaymentQrEntitlements } from "./entitlements";
import { rowToPaymentConfig, rowToPaymentMethod, rowToSuggestedAmount, rowToPaymentRequestSession } from "./mapper";
import { validatePaymentMethodInput, buildPaymentDestination } from "./providers";
import type {
  CreatePaymentQrInput,
  CreatePaymentRequestInput,
  PaymentPageConfiguration,
  PaymentPageLoadContext,
  PaymentQrAnalytics,
  PaymentProvider,
  QrEventType,
} from "./types";
import { PAYMENT_PURPOSE_HEADINGS } from "./types";

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

function isMissingTable(message: string): boolean {
  return /does not exist|schema cache|payment_page|review_qr_events/i.test(message);
}

async function allocateUniqueShortCodeLocal(): Promise<string> {
  const supabase = createServiceClient();
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

export function buildPaymentPageUrl(slug: string): string {
  return appUrl(`/p/${encodeURIComponent(slug)}`);
}

export function validatePublicSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(normalized)) {
    throw new Error("Slug must be 2–50 lowercase letters, numbers, or hyphens.");
  }
  return normalized;
}

export async function countPaymentQrCampaigns(
  organizationId: string,
  businessId: string
): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("review_qr_campaigns")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("business_id", businessId)
    .eq("campaign_type", "payment_review")
    .neq("status", "archived");
  return count ?? 0;
}

export async function getPaymentPageBySlug(slug: string): Promise<PaymentPageLoadContext | null> {
  const supabase = createServiceClient();

  // 1) Transaction-specific payment request session
  const sessionRes = await supabase
    .from("payment_request_sessions")
    .select("*")
    .eq("short_code", slug)
    .eq("status", "active")
    .maybeSingle();

  if (sessionRes.error && !isMissingTable(sessionRes.error.message)) {
    throw new Error(sessionRes.error.message);
  }

  if (sessionRes.data) {
    const session = rowToPaymentRequestSession(sessionRes.data as Record<string, unknown>);
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      return null;
    }
    const campaign = await getCampaignById(session.qrCampaignId);
    if (!campaign || campaign.status !== "active") return null;
    const config = await getPaymentConfigByCampaignId(campaign.id);
    if (!config) return null;
    return {
      campaign,
      config,
      requestSession: session,
    };
  }

  // 2) Reusable permanent page (public slug or campaign short code)
  let campaignRow: Record<string, unknown> | null = null;

  const bySlug = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("public_slug", slug)
    .eq("campaign_type", "payment_review")
    .maybeSingle();

  if (bySlug.error && !isMissingTable(bySlug.error.message)) {
    throw new Error(bySlug.error.message);
  }
  if (bySlug.data) campaignRow = bySlug.data as Record<string, unknown>;

  if (!campaignRow) {
    const byCode = await supabase
      .from("review_qr_campaigns")
      .select("*")
      .eq("short_code", slug)
      .eq("campaign_type", "payment_review")
      .maybeSingle();
    if (byCode.error && !isMissingTable(byCode.error.message)) {
      throw new Error(byCode.error.message);
    }
    if (byCode.data) campaignRow = byCode.data as Record<string, unknown>;
  }

  if (!campaignRow) return null;
  const campaign = rowToCampaign(campaignRow);
  if (campaign.status !== "active") return null;

  const config = await getPaymentConfigByCampaignId(campaign.id);
  if (!config) return null;

  return {
    campaign,
    config,
    requestSession: null,
  };
}

async function getCampaignById(campaignId: string): Promise<ReviewQrCampaign | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("review_qr_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  return data ? rowToCampaign(data as Record<string, unknown>) : null;
}

/** @deprecated Use getPaymentPageBySlug returning PaymentPageLoadContext */
export async function getPaymentPageBySlugLegacy(slug: string): Promise<{
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
} | null> {
  const ctx = await getPaymentPageBySlug(slug);
  if (!ctx) return null;
  return { campaign: ctx.campaign, config: ctx.config };
}

export async function getPaymentConfigByCampaignId(
  campaignId: string
): Promise<PaymentPageConfiguration | null> {
  const supabase = createServiceClient();
  const { data: configRow } = await supabase
    .from("payment_page_configurations")
    .select("*")
    .eq("qr_campaign_id", campaignId)
    .maybeSingle();
  if (!configRow) return null;

  const { data: methods } = await supabase
    .from("payment_page_methods")
    .select("*")
    .eq("payment_page_config_id", configRow.id)
    .order("sort_order", { ascending: true });

  const { data: amounts } = await supabase
    .from("payment_page_suggested_amounts")
    .select("*")
    .eq("payment_page_config_id", configRow.id)
    .order("sort_order", { ascending: true });

  return rowToPaymentConfig(
    configRow as Record<string, unknown>,
    (methods ?? []).map((m) => rowToPaymentMethod(m as Record<string, unknown>)),
    (amounts ?? []).map((a) => rowToSuggestedAmount(a as Record<string, unknown>))
  );
}

export async function createPaymentQrCampaign(
  input: CreatePaymentQrInput
): Promise<{ campaign: ReviewQrCampaign; config: PaymentPageConfiguration }> {
  const entitlements = await getPaymentQrEntitlements(input.organizationId);
  const existingCount = await countPaymentQrCampaigns(input.organizationId, input.businessId);
  if (existingCount >= entitlements.maxPages) {
    throw new Error(`Plan limit: maximum ${entitlements.maxPages} payment page(s).`);
  }

  if (input.showReviewPrompt && !entitlements.reviewLinks) {
    throw new Error("Upgrade required to enable review links on payment pages.");
  }
  if (input.publicSlug && !entitlements.customSlug) {
    throw new Error("Upgrade required for custom page slug.");
  }
  if ((input.suggestedAmounts?.length ?? 0) > 0 && !entitlements.suggestedAmounts) {
    throw new Error("Upgrade required for suggested payment amounts.");
  }

  const enabledMethods = input.methods.filter((m) => m.enabled !== false);
  if (enabledMethods.length === 0) {
    throw new Error("Enable at least one payment method.");
  }

  for (const method of enabledMethods) {
    const handle = method.publicHandle ?? method.publicUrl ?? "";
    const result = validatePaymentMethodInput(method.provider, handle);
    if (!result.ok) {
      throw new Error(`${method.provider}: ${result.error}`);
    }
  }

  const publicSlug = input.publicSlug
    ? validatePublicSlug(input.publicSlug)
    : null;

  if (publicSlug) {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("review_qr_campaigns")
      .select("id")
      .eq("public_slug", publicSlug)
      .maybeSingle();
    if (existing) throw new Error("This page slug is already in use.");
  }

  const amountMode = input.amountMode ?? "none";
  const allowCustom =
    amountMode === "custom" || amountMode === "suggested" ? (input.allowCustomAmount ?? true) : false;

  await assertCanCreateQrCampaign({
    organizationId: input.organizationId,
    businessId: input.businessId,
    activating: (input.status ?? "active") === "active",
  });

  const shortCode = await allocateUniqueShortCodeLocal();
  const slugForUrl = publicSlug ?? shortCode;
  const destinationUrl = buildPaymentPageUrl(slugForUrl);

  const purposeHeading =
    input.purpose === "custom" && input.customPurposeLabel
      ? input.customPurposeLabel
      : PAYMENT_PURPOSE_HEADINGS[input.purpose];

  const supabase = createServiceClient();
  const templateKey = await resolveWritablePosterTemplateKey({
    organizationId: input.organizationId,
    requested: input.templateKey,
  });

  const { data: campaignRow, error: campaignError } = await supabase
    .from("review_qr_campaigns")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      owner_user_id: input.ownerUserId ?? null,
      name: input.name.trim() || "Payment QR",
      placement_type: input.placementType ?? "standard_poster",
      destination_url: destinationUrl,
      short_code: shortCode,
      public_slug: publicSlug,
      campaign_type: "payment_review",
      headline: input.headline ?? purposeHeading,
      description: input.description ?? input.title ?? purposeHeading,
      brand_color: input.primaryColor ?? input.brandColor ?? "#2563EB",
      print_format: input.printFormat ?? "letter",
      show_footer: input.showFooter ?? true,
      template_key: templateKey,
      poster_config: input.posterConfig ?? {
        ...DEFAULT_POSTER_CONFIG,
        title: input.headline ?? purposeHeading,
        brandColor: input.primaryColor ?? "#2563EB",
      },
      status: input.status ?? "active",
      source: "app",
      claimed_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (campaignError) throw new Error(campaignError.message);
  const campaign = rowToCampaign(campaignRow as Record<string, unknown>);

  const { data: configRow, error: configError } = await supabase
    .from("payment_page_configurations")
    .insert({
      qr_campaign_id: campaign.id,
      payment_mode: "reusable_page",
      amount_mode: amountMode,
      page_theme: input.pageTheme ?? pageThemeFromPosterTemplate(templateKey),
      purpose: input.purpose,
      custom_purpose_label: input.customPurposeLabel ?? null,
      title: input.title ?? purposeHeading,
      description: input.description ?? null,
      thank_you_message: input.thankYouMessage ?? "Thank you for your support!",
      payment_note: input.paymentNote ?? null,
      logo_url: input.logoUrl ?? null,
      banner_url: input.bannerUrl ?? null,
      primary_color: input.primaryColor ?? "#2563EB",
      secondary_color: input.secondaryColor ?? null,
      allow_custom_amount: allowCustom,
      show_review_prompt: input.showReviewPrompt ?? true,
      show_platform_branding: input.showPlatformBranding ?? !entitlements.removePlatformBranding,
      google_review_url: input.googleReviewUrl ?? null,
      facebook_review_url: input.facebookReviewUrl ?? null,
      website_url: input.websiteUrl ?? null,
      facebook_page_url: input.facebookPageUrl ?? null,
      instagram_url: input.instagramUrl ?? null,
      pinterest_url: input.pinterestUrl ?? null,
      tiktok_url: input.tiktokUrl ?? null,
      youtube_url: input.youtubeUrl ?? null,
      booking_url: input.bookingUrl ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select("*")
    .single();

  if (configError) throw new Error(configError.message);
  const configId = String(configRow.id);

  const methodRows = enabledMethods.map((m, i) => {
    const handle = m.publicHandle ?? m.publicUrl ?? "";
    const validated = validatePaymentMethodInput(m.provider, handle);
    const normalized = validated.ok ? validated.normalized : handle;
    return {
      payment_page_config_id: configId,
      provider: m.provider,
      public_handle: m.provider === "zelle" ? normalized : normalized.replace(/^https?:\/\//, ""),
      public_url: m.publicUrl ?? (normalized.startsWith("http") ? normalized : null),
      instructions: m.instructions ?? null,
      uploaded_qr_image_url: m.uploadedQrImageUrl ?? null,
      enabled: true,
      sort_order: m.sortOrder ?? i,
    };
  });

  const { error: methodsError } = await supabase.from("payment_page_methods").insert(methodRows);
  if (methodsError) throw new Error(methodsError.message);

  if (input.suggestedAmounts?.length) {
    const amountRows = input.suggestedAmounts
      .filter((a) => a.enabled !== false)
      .map((a, i) => ({
        payment_page_config_id: configId,
        amount_cents: a.amountCents,
        label: a.label ?? null,
        enabled: true,
        sort_order: a.sortOrder ?? i,
      }));
    if (amountRows.length) {
      const { error: amountsError } = await supabase
        .from("payment_page_suggested_amounts")
        .insert(amountRows);
      if (amountsError) throw new Error(amountsError.message);
    }
  }

  const config = await getPaymentConfigByCampaignId(campaign.id);
  if (!config) throw new Error("Failed to load payment configuration.");
  return { campaign, config };
}

const DEDUP_WINDOW_MS = 3000;

export async function recordQrEvent(params: {
  campaignId: string;
  organizationId?: string | null;
  businessId?: string | null;
  eventType: QrEventType;
  provider?: PaymentProvider | null;
  amountSelectedCents?: number | null;
  sessionId?: string | null;
  paymentRequestSessionId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
  isPreview?: boolean;
}): Promise<{ recorded: boolean }> {
  const supabase = createServiceClient();
  const { isBot, isPreview } = detectBotOrPreview(params.userAgent ?? undefined);
  const cats = categorizeUserAgent(params.userAgent ?? undefined);
  const ipHash = params.ip ? hashIpForQrScan(params.ip) : null;

  if (params.sessionId) {
    const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from("review_qr_events")
      .select("id")
      .eq("campaign_id", params.campaignId)
      .eq("event_type", params.eventType)
      .eq("session_id", params.sessionId)
      .gte("created_at", since)
      .maybeSingle();
    if (recent) return { recorded: false };
  }

  const { error } = await supabase.from("review_qr_events").insert({
    campaign_id: params.campaignId,
    organization_id: params.organizationId ?? null,
    business_id: params.businessId ?? null,
    payment_request_session_id: params.paymentRequestSessionId ?? null,
    event_type: params.eventType,
    provider: params.provider ?? null,
    amount_selected_cents: params.amountSelectedCents ?? null,
    session_id: params.sessionId ?? null,
    user_agent: params.userAgent?.slice(0, 512) ?? null,
    referrer: params.referrer?.slice(0, 512) ?? null,
    ip_hash: ipHash,
    device_category: cats.deviceCategory,
    is_bot: isBot,
    is_preview: params.isPreview ?? isPreview,
    metadata: params.metadata ?? {},
  });

  if (error) {
    if (isMissingTable(error.message)) return { recorded: false };
    throw new Error(error.message);
  }
  return { recorded: true };
}

export async function getPaymentQrAnalytics(
  campaignId: string,
  days = 30
): Promise<PaymentQrAnalytics> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: eventsError } = await supabase
    .from("review_qr_events")
    .select("*")
    .eq("campaign_id", campaignId)
    .gte("created_at", since)
    .eq("is_bot", false)
    .eq("is_preview", false)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (eventsError && !isMissingTable(eventsError.message)) {
    throw new Error(eventsError.message);
  }

  const rows = events ?? [];
  const sessions = new Set<string>();
  const providerClicks: Record<string, number> = {};
  const amountSelections: Record<number, number> = {};
  let pageViews = 0;
  let paymentLinkClicks = 0;
  let googleReviewClicks = 0;
  let facebookReviewClicks = 0;
  let socialLinkClicks = 0;
  let websiteClicks = 0;
  let bookingLinkClicks = 0;
  let qrDownloads = 0;
  let posterDownloads = 0;

  const PAYMENT_CLICK_EVENTS = new Set([
    "payment_method_clicked",
    "payment_option_clicked",
    "stripe_link_clicked",
    "cash_app_clicked",
    "venmo_clicked",
    "paypal_clicked",
    "zelle_details_viewed",
  ]);

  const PROVIDER_FROM_EVENT: Record<string, string> = {
    stripe_link_clicked: "stripe",
    cash_app_clicked: "cash_app",
    venmo_clicked: "venmo",
    paypal_clicked: "paypal",
    zelle_details_viewed: "zelle",
  };

  for (const row of rows) {
    const eventType = String(row.event_type);
    if (row.session_id) sessions.add(String(row.session_id));

    switch (eventType) {
      case "page_view":
        pageViews++;
        break;
      case "amount_selected":
        if (row.amount_selected_cents) {
          const cents = Number(row.amount_selected_cents);
          amountSelections[cents] = (amountSelections[cents] ?? 0) + 1;
        }
        break;
      case "custom_amount_entered":
        if (row.amount_selected_cents) {
          const cents = Number(row.amount_selected_cents);
          amountSelections[cents] = (amountSelections[cents] ?? 0) + 1;
        }
        break;
      case "google_review_clicked":
        googleReviewClicks++;
        break;
      case "facebook_review_clicked":
        facebookReviewClicks++;
        break;
      case "social_link_clicked":
        socialLinkClicks++;
        break;
      case "website_clicked":
        websiteClicks++;
        socialLinkClicks++;
        break;
      case "booking_link_clicked":
        bookingLinkClicks++;
        socialLinkClicks++;
        break;
      case "qr_downloaded":
        qrDownloads++;
        break;
      case "poster_downloaded":
        posterDownloads++;
        break;
      default:
        if (PAYMENT_CLICK_EVENTS.has(eventType)) {
          paymentLinkClicks++;
          const prov =
            row.provider ? String(row.provider) : PROVIDER_FROM_EVENT[eventType] ?? "unknown";
          providerClicks[prov] = (providerClicks[prov] ?? 0) + 1;
          if (row.amount_selected_cents) {
            const cents = Number(row.amount_selected_cents);
            amountSelections[cents] = (amountSelections[cents] ?? 0) + 1;
          }
        }
        break;
    }
  }

  const { data: campaignRow } = await supabase
    .from("review_qr_campaigns")
    .select("total_scans")
    .eq("id", campaignId)
    .maybeSingle();
  const qrScans = Number(campaignRow?.total_scans ?? 0);

  const safeRate = (a: number, b: number): number | null =>
    b > 0 ? a / b : null;

  return {
    pageViews,
    uniqueVisitors: sessions.size,
    qrScans,
    paymentLinkClicks,
    providerClicks,
    amountSelections,
    googleReviewClicks,
    facebookReviewClicks,
    socialLinkClicks,
    websiteClicks,
    bookingLinkClicks,
    qrDownloads,
    posterDownloads,
    conversionRates: {
      scanToPageView: safeRate(pageViews, qrScans),
      pageViewToPaymentClick: safeRate(paymentLinkClicks, pageViews),
      pageViewToReviewClick: safeRate(googleReviewClicks + facebookReviewClicks, pageViews),
    },
    recentActivity: rows.slice(0, 50).map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      provider: row.provider ? String(row.provider) : null,
      amountSelectedCents: row.amount_selected_cents ? Number(row.amount_selected_cents) : null,
      createdAt: String(row.created_at),
      deviceCategory: row.device_category ? String(row.device_category) : null,
    })),
  };
}

async function allocateUniqueSessionShortCode(): Promise<string> {
  const supabase = createServiceClient();
  for (let i = 0; i < 8; i++) {
    const code = generateShortCode(10);
    const { data } = await supabase
      .from("payment_request_sessions")
      .select("id")
      .eq("short_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  return generateShortCode(14);
}

export async function createPaymentRequestSession(
  input: CreatePaymentRequestInput
): Promise<{
  session: import("./types").PaymentRequestSession;
  publicPageUrl: string;
  trackedQrUrl: string | null;
}> {
  const campaign = await getCampaignById(input.qrCampaignId);
  if (!campaign || campaign.campaignType !== "payment_review") {
    throw new Error("Payment campaign not found.");
  }
  if (campaign.businessId !== input.businessId) {
    throw new Error("Campaign does not belong to this business.");
  }

  const config = await getPaymentConfigByCampaignId(campaign.id);
  if (!config) throw new Error("Payment configuration not found.");

  if (input.amountCents <= 0) throw new Error("Amount must be greater than zero.");

  const supabase = createServiceClient();
  const shortCode = await allocateUniqueSessionShortCode();
  const expiresInDays = input.expiresInDays ?? 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("payment_request_sessions")
    .insert({
      qr_campaign_id: campaign.id,
      organization_id: input.organizationId,
      business_id: input.businessId,
      short_code: shortCode,
      amount_cents: input.amountCents,
      currency: input.currency ?? "USD",
      note: input.note?.trim() || null,
      status: "active",
      expires_at: expiresAt,
      created_by_user_id: input.ownerUserId ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error("Payment requests are not available until the database migration is applied.");
    }
    throw new Error(error.message);
  }

  const session = rowToPaymentRequestSession(data as Record<string, unknown>);
  const publicPageUrl = buildPaymentPageUrl(shortCode);
  const trackedQrUrl =
    campaign.shortCode ? `${appUrl(`/r/${campaign.shortCode}`)}?pay=${encodeURIComponent(shortCode)}` : null;

  return { session, publicPageUrl, trackedQrUrl };
}

export async function resolveProviderDestination(params: {
  slug: string;
  provider: PaymentProvider;
  amountCents?: number;
  note?: string | null;
}): Promise<{
  destinationUrl: string | null;
  fallbackInstructions: string;
  opensInNewTab: boolean;
  manualFlow: boolean;
  amountCents: number | null;
  note: string | null;
}> {
  const page = await getPaymentPageBySlug(params.slug);
  if (!page) throw new Error("Payment page not found.");

  const method = page.config.methods.find((m) => m.enabled && m.provider === params.provider);
  if (!method) throw new Error("Payment method not available.");

  const amountCents =
    page.requestSession?.amountCents ??
    params.amountCents ??
    null;
  const note =
    page.requestSession?.note ?? params.note ?? page.config.paymentNote ?? null;

  const result = buildPaymentDestination(params.provider, {
    publicHandle: method.publicHandle,
    publicUrl: method.publicUrl,
    amountCents: amountCents ?? undefined,
    note,
  });

  return {
    ...result,
    amountCents,
    note,
  };
}
