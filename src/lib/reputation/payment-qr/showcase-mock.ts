import type { PageThemeKey, PaymentPageConfiguration } from "./types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";

export const MOCK_CAMPAIGN: ReviewQrCampaign = {
  id: "preview",
  organizationId: null,
  businessId: "preview",
  ownerUserId: null,
  campaignType: "payment_review",
  publicSlug: "thelocalshop",
  name: "The Local Shop — Counter",
  placementType: "counter_sign",
  customPlacementLabel: null,
  destinationUrl: "",
  shortCode: "abc123xyz",
  headline: "Pay The Local Shop",
  description: "Choose your payment method below",
  brandColor: "#2563EB",
  secondaryColor: null,
  templateKey: "scan_to_pay",
  printFormat: "letter",
  showFooter: true,
  posterConfig: {
    title: "Scan to pay",
    description: "Venmo, Cash App, PayPal, or Zelle",
    brandColor: "#2563EB",
    showFooter: true,
    format: "letter",
    selectedPhrases: [],
  },
  status: "active",
  claimedAt: null,
  source: "app",
  migratedFromLinkId: null,
  totalScans: 148,
  estimatedUniqueScans: 112,
  botScans: 3,
  lastScannedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const MOCK_CONFIG: PaymentPageConfiguration = {
  id: "preview",
  qrCampaignId: "preview",
  paymentMode: "reusable_page",
  amountMode: "suggested",
  pageTheme: "modern_blue",
  purpose: "pay",
  customPurposeLabel: null,
  title: "Pay The Local Shop",
  description: "Service beyond the tap",
  thankYouMessage: "Thank you for your support!",
  paymentNote: null,
  logoUrl: null,
  bannerUrl: null,
  primaryColor: "#2563EB",
  secondaryColor: null,
  allowCustomAmount: true,
  showReviewPrompt: true,
  showPlatformBranding: true,
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJpreview",
  facebookReviewUrl: "https://facebook.com/thelocalshop/reviews",
  websiteUrl: "https://thelocalshop.com",
  facebookPageUrl: "https://facebook.com/thelocalshop",
  instagramUrl: "https://instagram.com/thelocalshop",
  pinterestUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  bookingUrl: null,
  phone: "(703) 555-0142",
  email: "hello@thelocalshop.com",
  methods: [
    {
      id: "0",
      provider: "stripe",
      publicHandle: null,
      publicUrl: "https://buy.stripe.com/preview",
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 0,
    },
    {
      id: "1",
      provider: "venmo",
      publicHandle: "thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "2",
      provider: "cash_app",
      publicHandle: "$thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "3",
      provider: "paypal",
      publicHandle: "thelocalshop",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 3,
    },
    {
      id: "4",
      provider: "zelle",
      publicHandle: "pay@thelocalshop.com",
      publicUrl: null,
      instructions: null,
      uploadedQrImageUrl: null,
      enabled: true,
      sortOrder: 4,
    },
  ],
  suggestedAmounts: [
    { id: "15", amountCents: 1500, label: "15%", enabled: true, sortOrder: 0 },
    { id: "18", amountCents: 1800, label: "18%", enabled: true, sortOrder: 1 },
    { id: "20", amountCents: 2000, label: "20%", enabled: true, sortOrder: 2 },
    { id: "25", amountCents: 2500, label: "25%", enabled: true, sortOrder: 3 },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const TEMPLATE_SHOWCASE: Array<{
  theme: PageThemeKey;
  businessName: string;
  galleryNumber: number;
  blurb: string;
  configPatch: Partial<PaymentPageConfiguration>;
}> = [
  {
    theme: "floral_pink",
    galleryNumber: 1,
    blurb: "Soft florals & pink accents",
    businessName: "Bloom & Co.",
    configPatch: {
      title: "Wedding Studio",
      description: "Floral design & event styling",
    },
  },
  {
    theme: "modern_blue",
    galleryNumber: 2,
    blurb: "Clean waves & modern blue",
    businessName: "PureFlow Plumbing",
    configPatch: {
      title: "Pay securely",
      description: "Service beyond the tap",
    },
  },
  {
    theme: "bold_professional",
    galleryNumber: 3,
    blurb: "Bold dark sections",
    businessName: "Summit Legal",
    configPatch: {
      title: "Professional services",
      description: "Trusted counsel for your business",
    },
  },
  {
    theme: "minimal_elegant",
    galleryNumber: 4,
    blurb: "Minimal serif elegance",
    businessName: "Luxe Salon",
    configPatch: {
      title: "Pay securely",
      description: "Elevated hair & beauty care",
    },
  },
  {
    theme: "dark_luxury",
    galleryNumber: 5,
    blurb: "Dark luxury gold accents",
    businessName: "Majestic Catering",
    configPatch: {
      title: "Reserve & pay",
      description: "Premium event catering",
    },
  },
];

/** Slim config for template-picker thumbnails (matches poster thumb pattern). */
export function buildThumbPreviewConfig(
  theme: PageThemeKey,
  patch: Partial<PaymentPageConfiguration> = {}
): PaymentPageConfiguration {
  const venmo = MOCK_CONFIG.methods.find((m) => m.provider === "venmo");
  const paypal = MOCK_CONFIG.methods.find((m) => m.provider === "paypal");
  return {
    ...MOCK_CONFIG,
    ...patch,
    pageTheme: theme,
    methods: [venmo, paypal].filter(Boolean) as PaymentPageConfiguration["methods"],
    suggestedAmounts: MOCK_CONFIG.suggestedAmounts.slice(0, 4),
    googleReviewUrl: MOCK_CONFIG.googleReviewUrl,
    facebookReviewUrl: null,
    websiteUrl: null,
    facebookPageUrl: null,
    instagramUrl: null,
    pinterestUrl: null,
    bookingUrl: null,
    phone: null,
    email: null,
  };
}

export const MOCK_REQUEST_SESSION = {
  id: "session-preview",
  qrCampaignId: "preview",
  organizationId: null,
  businessId: "preview",
  shortCode: "req125abc",
  amountCents: 12500,
  currency: "USD",
  note: "Garage cleanout",
  status: "active" as const,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
