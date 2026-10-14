/**
 * Unified brand themes — poster `template_key` is the single visual identity.
 * Hosted pay pages derive legacy `page_theme` tokens from the same key until
 * all surfaces read template_key directly.
 */
import type { PageThemeKey } from "@/lib/reputation/payment-qr/types";
import type { PosterTemplateKey } from "@/lib/reputation/poster-templates";
import { normalizePosterTemplateKey } from "@/lib/reputation/poster-templates";

/** Legacy hosted-page token key derived from poster template (DB `page_theme`). */
export const POSTER_TO_PAGE_THEME: Record<PosterTemplateKey, PageThemeKey> = {
  classic_poster: "modern_blue",
  modern_minimal: "minimal_elegant",
  solid_green: "modern_blue",
  elegant_black: "dark_luxury",
  friendly_green: "modern_blue",
  premium_gold: "dark_luxury",
  cafe_coffee: "minimal_elegant",
  clear_blue: "modern_blue",
  black_white: "bold_professional",
  rustic_wood: "minimal_elegant",
  bold_palette: "floral_pink",
  scan_to_pay: "modern_blue",
  scan_to_tip: "modern_blue",
  pay_and_review: "modern_blue",
};

export function pageThemeFromPosterTemplate(templateKey: string | null | undefined): PageThemeKey {
  const key = normalizePosterTemplateKey(templateKey);
  return POSTER_TO_PAGE_THEME[key] ?? "modern_blue";
}

export type BrandThemeSurface = "poster" | "hosted";

/**
 * Campaign type → center slot on the shared brand shell.
 * - google_review: QR code (print + scan → Google)
 * - payment_review: payment methods on hosted page; QR on print poster
 */
export type BrandThemeCenterMode = "qr" | "payments" | "reviews_only";

export function centerModeForCampaignType(
  campaignType: "google_review" | "payment_review",
  surface: BrandThemeSurface
): BrandThemeCenterMode {
  if (campaignType === "payment_review" && surface === "hosted") return "payments";
  return "qr";
}
