import type { PageThemeKey } from "./page-themes";

export type { PageThemeKey };

export const PAYMENT_PROVIDERS = [
  "stripe",
  "venmo",
  "cash_app",
  "paypal",
  "zelle",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Hosted /p/ page — payment methods section heading */
export const HOSTED_PAYMENT_SECTION_HEADING = "Choose how you'd like to pay";

/** Short legal line below primary content on hosted pages */
export const HOSTED_PAYMENT_DISCLAIMER =
  "Payments are completed through the selected provider. Local SEO Express does not process or verify external payments.";

export const PAYMENT_PURPOSES = [
  "pay",
  "tip",
  "donate",
  "pay_invoice",
  "leave_deposit",
  "support_us",
  "custom",
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  pay: "Pay",
  tip: "Tip",
  donate: "Donate",
  pay_invoice: "Pay invoice",
  leave_deposit: "Leave deposit",
  support_us: "Support us",
  custom: "Custom",
};

export const PAYMENT_PURPOSE_HEADINGS: Record<PaymentPurpose, string> = {
  pay: "Choose how you'd like to pay",
  tip: "Leave a tip",
  donate: "Donate",
  pay_invoice: "Pay your invoice",
  leave_deposit: "Leave a deposit",
  support_us: "Support us",
  custom: "Pay or tip",
};

/** @deprecated Use amount_mode. Kept for DB backward compatibility. */
export const PAYMENT_MODES = ["reusable_page", "request_only"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const AMOUNT_MODES = ["none", "custom", "suggested"] as const;
export type AmountMode = (typeof AMOUNT_MODES)[number];

export const AMOUNT_MODE_LABELS: Record<AmountMode, string> = {
  none: "No amount on page",
  custom: "Customer enters amount",
  suggested: "Suggested amounts",
};

export const QR_EVENT_TYPES = [
  "page_view",
  "qr_scan",
  "amount_selected",
  "custom_amount_entered",
  "payment_method_clicked",
  "stripe_link_clicked",
  "cash_app_clicked",
  "venmo_clicked",
  "paypal_clicked",
  "zelle_details_viewed",
  "zelle_email_copied",
  "zelle_amount_copied",
  "google_review_clicked",
  "facebook_review_clicked",
  "social_link_clicked",
  "website_clicked",
  "booking_link_clicked",
  "qr_downloaded",
  "poster_downloaded",
  // Legacy events (still accepted for old records)
  "payment_option_viewed",
  "payment_option_clicked",
  "external_payment_returned",
  "review_prompt_viewed",
  "stripe_checkout_started",
  "stripe_payment_completed",
  "stripe_payment_failed",
] as const;
export type QrEventType = (typeof QR_EVENT_TYPES)[number];

export const PROVIDER_CLICK_EVENTS: Record<PaymentProvider, QrEventType> = {
  stripe: "stripe_link_clicked",
  cash_app: "cash_app_clicked",
  venmo: "venmo_clicked",
  paypal: "paypal_clicked",
  zelle: "zelle_details_viewed",
};

export type PaymentProviderCapabilities = {
  supportsExternalLink: boolean;
  supportsPrefilledAmount: boolean;
  supportsPrefilledNote: boolean;
  supportsVerifiedCompletion: boolean;
};

/** @deprecated Legacy session URLs still resolve; UI no longer creates these. */
export type PaymentRequestSession = {
  id: string;
  qrCampaignId: string;
  organizationId: string | null;
  businessId: string | null;
  shortCode: string;
  amountCents: number;
  currency: string;
  note: string | null;
  status: "active" | "expired" | "cancelled";
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentPageLoadContext = {
  campaign: import("@/lib/reputation/qr-campaigns/types").ReviewQrCampaign;
  config: PaymentPageConfiguration;
  /** @deprecated */
  requestSession: PaymentRequestSession | null;
};

export type PaymentPageMethod = {
  id: string;
  provider: PaymentProvider;
  publicHandle: string | null;
  publicUrl: string | null;
  instructions: string | null;
  uploadedQrImageUrl: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentSuggestedAmount = {
  id: string;
  amountCents: number;
  label: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type PaymentPageConfiguration = {
  id: string;
  qrCampaignId: string;
  /** @deprecated */
  paymentMode: PaymentMode;
  amountMode: AmountMode;
  pageTheme: PageThemeKey;
  purpose: PaymentPurpose;
  customPurposeLabel: string | null;
  title: string | null;
  description: string | null;
  thankYouMessage: string | null;
  paymentNote: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  secondaryColor: string | null;
  allowCustomAmount: boolean;
  showReviewPrompt: boolean;
  showPlatformBranding: boolean;
  googleReviewUrl: string | null;
  facebookReviewUrl: string | null;
  websiteUrl: string | null;
  facebookPageUrl: string | null;
  instagramUrl: string | null;
  pinterestUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  bookingUrl: string | null;
  phone: string | null;
  email: string | null;
  methods: PaymentPageMethod[];
  suggestedAmounts: PaymentSuggestedAmount[];
  createdAt: string;
  updatedAt: string;
};

export type PaymentQrAnalytics = {
  pageViews: number;
  uniqueVisitors: number;
  qrScans: number;
  paymentLinkClicks: number;
  providerClicks: Record<string, number>;
  amountSelections: Record<number, number>;
  googleReviewClicks: number;
  facebookReviewClicks: number;
  socialLinkClicks: number;
  websiteClicks: number;
  bookingLinkClicks: number;
  qrDownloads: number;
  posterDownloads: number;
  conversionRates: {
    scanToPageView: number | null;
    pageViewToPaymentClick: number | null;
    pageViewToReviewClick: number | null;
  };
  recentActivity: Array<{
    id: string;
    eventType: string;
    provider: string | null;
    amountSelectedCents: number | null;
    createdAt: string;
    deviceCategory: string | null;
  }>;
};

export type CreatePaymentQrInput = {
  organizationId: string;
  businessId: string;
  ownerUserId?: string | null;
  name: string;
  placementType?: string;
  publicSlug?: string | null;
  purpose: PaymentPurpose;
  customPurposeLabel?: string | null;
  title?: string | null;
  description?: string | null;
  thankYouMessage?: string | null;
  paymentNote?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string | null;
  amountMode?: AmountMode;
  pageTheme?: PageThemeKey;
  allowCustomAmount?: boolean;
  showReviewPrompt?: boolean;
  showPlatformBranding?: boolean;
  googleReviewUrl?: string | null;
  facebookReviewUrl?: string | null;
  websiteUrl?: string | null;
  facebookPageUrl?: string | null;
  instagramUrl?: string | null;
  pinterestUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
  bookingUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  methods: Array<{
    provider: PaymentProvider;
    publicHandle?: string | null;
    publicUrl?: string | null;
    instructions?: string | null;
    uploadedQrImageUrl?: string | null;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  suggestedAmounts?: Array<{
    amountCents: number;
    label?: string | null;
    enabled?: boolean;
    sortOrder?: number;
  }>;
  headline?: string;
  brandColor?: string;
  templateKey?: string;
  printFormat?: "a4" | "a5" | "letter";
  showFooter?: boolean;
  posterConfig?: Record<string, unknown>;
  status?: "active" | "paused" | "draft";
};

export type CreatePaymentRequestInput = {
  organizationId: string;
  businessId: string;
  qrCampaignId: string;
  ownerUserId?: string | null;
  amountCents: number;
  currency?: string;
  note?: string | null;
  expiresInDays?: number;
};
