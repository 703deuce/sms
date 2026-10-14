export type PosterConfig = {
  title: string;
  description: string;
  brandColor: string;
  showFooter: boolean;
  format: "a4" | "a5" | "letter";
  selectedPhrases: string[];
};

export const DEFAULT_POSTER_CONFIG: PosterConfig = {
  title: "Rate us on Google",
  description: "We value your feedback!",
  brandColor: "#16A34A",
  showFooter: true,
  format: "a4",
  selectedPhrases: [],
};

export const POSTER_BRAND_COLORS = [
  "#16A34A",
  "#10b981",
  "#0f766e",
  "#4f6ef7",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#1e293b",
  "#64748b",
];

export function parsePosterConfig(raw: unknown): PosterConfig {
  const o = (raw ?? {}) as Partial<PosterConfig>;
  return {
    title: o.title ?? DEFAULT_POSTER_CONFIG.title,
    description: o.description ?? DEFAULT_POSTER_CONFIG.description,
    brandColor: o.brandColor ?? DEFAULT_POSTER_CONFIG.brandColor,
    showFooter: o.showFooter ?? DEFAULT_POSTER_CONFIG.showFooter,
    format: o.format ?? DEFAULT_POSTER_CONFIG.format,
    selectedPhrases: Array.isArray(o.selectedPhrases) ? o.selectedPhrases : [],
  };
}
