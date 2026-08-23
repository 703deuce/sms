/**
 * QR poster template registry.
 * `classic_poster` is the free default. The 10 Pro gallery templates match the product mockup.
 */

export const CLASSIC_POSTER_TEMPLATE = "classic_poster" as const;

export const PREMIUM_POSTER_TEMPLATE_KEYS = [
  "modern_minimal",
  "solid_green",
  "elegant_black",
  "friendly_green",
  "premium_gold",
  "cafe_coffee",
  "clear_blue",
  "black_white",
  "rustic_wood",
  "bold_palette",
] as const;

export type PremiumPosterTemplateKey = (typeof PREMIUM_POSTER_TEMPLATE_KEYS)[number];
export const PAYMENT_POSTER_TEMPLATE_KEYS = [
  "scan_to_pay",
  "scan_to_tip",
  "pay_and_review",
] as const;

export type PaymentPosterTemplateKey = (typeof PAYMENT_POSTER_TEMPLATE_KEYS)[number];
export type PosterTemplateKey =
  | typeof CLASSIC_POSTER_TEMPLATE
  | PremiumPosterTemplateKey
  | PaymentPosterTemplateKey;

export type PosterTemplateMeta = {
  key: PosterTemplateKey;
  label: string;
  /** Short blurb under the thumbnail */
  blurb: string;
  /** Suggested default headline when first selecting this template */
  suggestedTitle: string;
  /** Suggested description */
  suggestedDescription: string;
  /** Swatch / accent shown on the picker card */
  accent: string;
  /** Whether this requires a paid (non-trial) plan */
  premium: boolean;
  /** 1–10 gallery number for Pro templates (mockup order) */
  galleryNumber?: number;
};

export const POSTER_TEMPLATES: PosterTemplateMeta[] = [
  {
    key: "classic_poster",
    label: "Classic Green",
    blurb: "Default free poster",
    suggestedTitle: "Rate us on Google",
    suggestedDescription: "We value your feedback!",
    accent: "#137752",
    premium: false,
  },
  {
    key: "modern_minimal",
    label: "Modern Minimal",
    blurb: "Marble · green bar",
    suggestedTitle: "Review Us on Google",
    suggestedDescription: "Your feedback is important to us.",
    accent: "#137752",
    premium: true,
    galleryNumber: 1,
  },
  {
    key: "solid_green",
    label: "Bold Green",
    blurb: "Solid green · curve",
    suggestedTitle: "LOVE OUR SERVICE?",
    suggestedDescription: "Review Us on Google",
    accent: "#137752",
    premium: true,
    galleryNumber: 2,
  },
  {
    key: "elegant_black",
    label: "Elegant Black",
    blurb: "Black · gold frame",
    suggestedTitle: "Thank You",
    suggestedDescription: "for your visit",
    accent: "#C9A227",
    premium: true,
    galleryNumber: 3,
  },
  {
    key: "friendly_green",
    label: "Friendly Green",
    blurb: "White · green wave",
    suggestedTitle: "How was your experience?",
    suggestedDescription: "Scan to leave a Google review",
    accent: "#137752",
    premium: true,
    galleryNumber: 4,
  },
  {
    key: "premium_gold",
    label: "Premium Gold",
    blurb: "Black · gold foil",
    suggestedTitle: "SHARE YOUR EXPERIENCE WITH US",
    suggestedDescription: "Scan to leave a review",
    accent: "#D4AF37",
    premium: true,
    galleryNumber: 5,
  },
  {
    key: "cafe_coffee",
    label: "Cafe Coffee Shop",
    blurb: "Photo background",
    suggestedTitle: "HOW WAS YOUR Experience?",
    suggestedDescription: "We'd love your feedback",
    accent: "#8B5E3C",
    premium: true,
    galleryNumber: 6,
  },
  {
    key: "clear_blue",
    label: "Clear Blue",
    blurb: "White · blue waves",
    suggestedTitle: "WE APPRECIATE YOU!",
    suggestedDescription: "Scan to leave a Google review",
    accent: "#1D4ED8",
    premium: true,
    galleryNumber: 7,
  },
  {
    key: "black_white",
    label: "Black & White",
    blurb: "Triangle corners",
    suggestedTitle: "HELP US GET BETTER",
    suggestedDescription: "Scan to leave a review",
    accent: "#0B1220",
    premium: true,
    galleryNumber: 8,
  },
  {
    key: "rustic_wood",
    label: "Rustic Wood",
    blurb: "Wood plank photo",
    suggestedTitle: "Thank You!",
    suggestedDescription: "For choosing us",
    accent: "#5C4033",
    premium: true,
    galleryNumber: 9,
  },
  {
    key: "bold_palette",
    label: "Geo Colorful",
    blurb: "Colorful shapes",
    suggestedTitle: "LOVED OUR SERVICE?",
    suggestedDescription: "Leave us a quick Google review",
    accent: "#E11D48",
    premium: true,
    galleryNumber: 10,
  },
  {
    key: "scan_to_pay",
    label: "Scan to pay",
    blurb: "Payment QR poster",
    suggestedTitle: "Scan to pay",
    suggestedDescription: "Venmo, Cash App, PayPal, or Zelle",
    accent: "#2563EB",
    premium: false,
  },
  {
    key: "scan_to_tip",
    label: "Scan to tip",
    blurb: "Tip QR poster",
    suggestedTitle: "Leave a tip",
    suggestedDescription: "Scan to tip our team",
    accent: "#2563EB",
    premium: false,
  },
  {
    key: "pay_and_review",
    label: "Pay and review",
    blurb: "Pay + review poster",
    suggestedTitle: "Pay and review",
    suggestedDescription: "Scan to pay, then share your experience",
    accent: "#16A34A",
    premium: false,
  },
];

/** Pro gallery only — mockup order 1–10 */
export const GALLERY_POSTER_TEMPLATES = POSTER_TEMPLATES.filter(
  (t): t is PosterTemplateMeta & { galleryNumber: number } => typeof t.galleryNumber === "number"
).sort((a, b) => a.galleryNumber - b.galleryNumber);

export function isPosterTemplateKey(value: string | null | undefined): value is PosterTemplateKey {
  return POSTER_TEMPLATES.some((t) => t.key === value);
}

export function normalizePosterTemplateKey(value: string | null | undefined): PosterTemplateKey {
  if (isPosterTemplateKey(value)) return value;
  return CLASSIC_POSTER_TEMPLATE;
}

export function getPosterTemplate(key: string | null | undefined): PosterTemplateMeta {
  const normalized = normalizePosterTemplateKey(key);
  return POSTER_TEMPLATES.find((t) => t.key === normalized) ?? POSTER_TEMPLATES[0]!;
}

export function isPremiumPosterTemplate(key: string | null | undefined): boolean {
  return getPosterTemplate(key).premium;
}
