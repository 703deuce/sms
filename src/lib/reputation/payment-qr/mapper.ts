import type {
  AmountMode,
  PaymentMode,
  PaymentPageConfiguration,
  PaymentPageMethod,
  PaymentRequestSession,
  PaymentSuggestedAmount,
  PaymentPurpose,
  PaymentProvider,
  PageThemeKey,
} from "./types";
import { PAGE_THEME_KEYS } from "./page-themes";

export function rowToPaymentRequestSession(row: Record<string, unknown>): PaymentRequestSession {
  return {
    id: String(row.id),
    qrCampaignId: String(row.qr_campaign_id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    businessId: row.business_id ? String(row.business_id) : null,
    shortCode: String(row.short_code),
    amountCents: Number(row.amount_cents ?? 0),
    currency: String(row.currency ?? "USD"),
    note: row.note ? String(row.note) : null,
    status: String(row.status ?? "active") as PaymentRequestSession["status"],
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export function rowToPaymentMethod(row: Record<string, unknown>): PaymentPageMethod {
  return {
    id: String(row.id),
    provider: String(row.provider) as PaymentProvider,
    publicHandle: row.public_handle ? String(row.public_handle) : null,
    publicUrl: row.public_url ? String(row.public_url) : null,
    instructions: row.instructions ? String(row.instructions) : null,
    uploadedQrImageUrl: row.uploaded_qr_image_url ? String(row.uploaded_qr_image_url) : null,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToSuggestedAmount(row: Record<string, unknown>): PaymentSuggestedAmount {
  return {
    id: String(row.id),
    amountCents: Number(row.amount_cents ?? 0),
    label: row.label ? String(row.label) : null,
    enabled: row.enabled !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function rowToPaymentConfig(
  row: Record<string, unknown>,
  methods: PaymentPageMethod[] = [],
  suggestedAmounts: PaymentSuggestedAmount[] = []
): PaymentPageConfiguration {
  const amountMode = String(row.amount_mode ?? "none") as AmountMode;
  return {
    id: String(row.id),
    qrCampaignId: String(row.qr_campaign_id),
    paymentMode: (String(row.payment_mode ?? "reusable_page") as PaymentMode),
    amountMode,
    pageTheme: (() => {
      const raw = String(row.page_theme ?? "modern_blue");
      return PAGE_THEME_KEYS.includes(raw as PageThemeKey)
        ? (raw as PageThemeKey)
        : "modern_blue";
    })(),
    purpose: String(row.purpose ?? "pay") as PaymentPurpose,
    customPurposeLabel: row.custom_purpose_label ? String(row.custom_purpose_label) : null,
    title: row.title ? String(row.title) : null,
    description: row.description ? String(row.description) : null,
    thankYouMessage: row.thank_you_message ? String(row.thank_you_message) : null,
    paymentNote: row.payment_note ? String(row.payment_note) : null,
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    bannerUrl: row.banner_url ? String(row.banner_url) : null,
    primaryColor: String(row.primary_color ?? "#2563EB"),
    secondaryColor: row.secondary_color ? String(row.secondary_color) : null,
    allowCustomAmount: row.allow_custom_amount !== false,
    showReviewPrompt: Boolean(row.show_review_prompt),
    showPlatformBranding: row.show_platform_branding !== false,
    googleReviewUrl: row.google_review_url ? String(row.google_review_url) : null,
    facebookReviewUrl: row.facebook_review_url ? String(row.facebook_review_url) : null,
    websiteUrl: row.website_url ? String(row.website_url) : null,
    facebookPageUrl: row.facebook_page_url ? String(row.facebook_page_url) : null,
    instagramUrl: row.instagram_url ? String(row.instagram_url) : null,
    pinterestUrl: row.pinterest_url ? String(row.pinterest_url) : null,
    tiktokUrl: row.tiktok_url ? String(row.tiktok_url) : null,
    youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
    bookingUrl: row.booking_url ? String(row.booking_url) : null,
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    methods,
    suggestedAmounts,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
