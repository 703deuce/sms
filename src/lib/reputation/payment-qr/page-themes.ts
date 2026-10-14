export const PAGE_THEME_KEYS = [
  "floral_pink",
  "modern_blue",
  "bold_professional",
  "minimal_elegant",
  "dark_luxury",
] as const;

export type PageThemeKey = (typeof PAGE_THEME_KEYS)[number];

export const PAGE_THEME_LABELS: Record<PageThemeKey, string> = {
  floral_pink: "Floral & Fruity",
  modern_blue: "Clean & Modern",
  bold_professional: "Bold & Professional",
  minimal_elegant: "Minimal & Elegant",
  dark_luxury: "Dark & Creative",
};

export type PageLayoutMode = "light_card" | "dark_sections" | "dark_card";

export type PageThemeTokens = {
  key: PageThemeKey;
  label: string;
  layoutMode: PageLayoutMode;
  pageBg: string;
  cardBg: string;
  headerBg: string;
  headerDecor: "floral" | "wave" | "shield" | "minimal" | "dark";
  primary: string;
  accent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  sectionLabel: string;
  pillBg: string;
  pillBorder: string;
  pillSelectedBg: string;
  pillSelectedBorder: string;
  pillSelectedText: string;
  pillRadius: string;
  buttonRadius: string;
  methodCardBg: string;
  methodCardBorder: string;
  methodDivider: boolean;
  methodIconVariant: "color" | "mono";
  reviewBoxBg: string;
  reviewBoxBorder: string;
  googleReviewBg: string;
  googleReviewText: string;
  facebookReviewBg: string;
  facebookReviewText: string;
  facebookReviewBorder?: string;
  socialPillBg: string;
  socialPillBorder: string;
  socialPillText: string;
  disclaimer: string;
  cardShadow: string;
  cardRadius: string;
  fontFamily: string;
  headingFontFamily: string;
  isDark: boolean;
  serifHeading?: boolean;
  amountLabel: string;
  payLabel: string;
  reviewPrompt: string;
  reviewSubtext: string;
  reviewSectionLabel: string;
  pillShadow?: string;
  taglineColor?: string;
  googleReviewShadow?: string;
  headingSize?: string;
  contentPadding?: string;
};

export const PAGE_THEMES: Record<PageThemeKey, PageThemeTokens> = {
  floral_pink: {
    key: "floral_pink",
    label: "Floral & Fruity",
    layoutMode: "light_card",
    pageBg: "#FFF0F4",
    cardBg: "#FFFFFF",
    headerBg: "#FFF5F8",
    headerDecor: "floral",
    primary: "#D63384",
    accent: "#F8A5C2",
    textPrimary: "#4A1942",
    textSecondary: "#7C3A6B",
    textMuted: "#9D6B8C",
    sectionLabel: "#B07A9A",
    pillBg: "#EC4899",
    pillBorder: "#EC4899",
    pillSelectedBg: "#BE185D",
    pillSelectedBorder: "#BE185D",
    pillSelectedText: "#FFFFFF",
    pillRadius: "9999px",
    buttonRadius: "12px",
    methodCardBg: "#FFFFFF",
    methodCardBorder: "#F8D4E4",
    methodDivider: true,
    methodIconVariant: "color",
    reviewBoxBg: "#FFF8FA",
    reviewBoxBorder: "#F5D0E0",
    googleReviewBg: "#D63384",
    googleReviewText: "#FFFFFF",
    facebookReviewBg: "#FFFFFF",
    facebookReviewText: "#D63384",
    facebookReviewBorder: "#D63384",
    socialPillBg: "#FFFFFF",
    socialPillBorder: "#F5D0E0",
    socialPillText: "#4A1942",
    disclaimer: "#C084A8",
    cardShadow: "0 20px 50px -12px rgba(214, 51, 132, 0.18), 0 8px 20px -8px rgba(0,0,0,0.08)",
    cardRadius: "24px",
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Georgia', 'Times New Roman', serif",
    isDark: false,
    serifHeading: true,
    amountLabel: "Tip amount",
    payLabel: "Pay with",
    reviewPrompt: "Happy with our service?",
    reviewSubtext: "Your feedback helps our local business grow.",
    reviewSectionLabel: "Leave us a review",
    pillShadow: "0 4px 14px rgba(214, 51, 132, 0.22)",
  },
  modern_blue: {
    key: "modern_blue",
    label: "Clean & Modern",
    layoutMode: "light_card",
    pageBg: "#E2E8F0",
    cardBg: "#FFFFFF",
    headerBg: "#2563EB",
    headerDecor: "wave",
    primary: "#2563EB",
    accent: "#3B82F6",
    textPrimary: "#0F172A",
    textSecondary: "#2563EB",
    textMuted: "#64748B",
    sectionLabel: "#94A3B8",
    taglineColor: "#60A5FA",
    pillBg: "#FFFFFF",
    pillBorder: "#BFDBFE",
    pillSelectedBg: "#2563EB",
    pillSelectedBorder: "#2563EB",
    pillSelectedText: "#FFFFFF",
    pillRadius: "9999px",
    buttonRadius: "12px",
    methodCardBg: "#FFFFFF",
    methodCardBorder: "#E2E8F0",
    methodDivider: false,
    methodIconVariant: "color",
    reviewBoxBg: "#FFFFFF",
    reviewBoxBorder: "#E2E8F0",
    googleReviewBg: "#2563EB",
    googleReviewText: "#FFFFFF",
    googleReviewShadow: "0 8px 24px rgba(37, 99, 235, 0.35)",
    facebookReviewBg: "#FFFFFF",
    facebookReviewText: "#2563EB",
    facebookReviewBorder: "#2563EB",
    socialPillBg: "#FFFFFF",
    socialPillBorder: "#E2E8F0",
    socialPillText: "#334155",
    disclaimer: "#94A3B8",
    cardShadow: "0 24px 60px -12px rgba(15, 23, 42, 0.12), 0 12px 32px -8px rgba(37, 99, 235, 0.08)",
    cardRadius: "20px",
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Inter', system-ui, sans-serif",
    headingSize: "1.625rem",
    contentPadding: "20px",
    isDark: false,
    amountLabel: "Tip amount",
    payLabel: "Pay with",
    reviewPrompt: "Enjoyed your experience?",
    reviewSubtext: "Your feedback helps our local business grow.",
    reviewSectionLabel: "Leave us a review",
  },
  bold_professional: {
    key: "bold_professional",
    label: "Bold & Professional",
    layoutMode: "dark_sections",
    pageBg: "#1C1C1C",
    cardBg: "#111111",
    headerBg: "#0A0A0A",
    headerDecor: "shield",
    primary: "#D4AF37",
    accent: "#F0C75E",
    textPrimary: "#F5F5F5",
    textSecondary: "#D4D4D4",
    textMuted: "#A3A3A3",
    sectionLabel: "#A3A3A3",
    pillBg: "#1A1A1A",
    pillBorder: "#3A3A3A",
    pillSelectedBg: "#D4AF37",
    pillSelectedBorder: "#D4AF37",
    pillSelectedText: "#0A0A0A",
    pillRadius: "8px",
    buttonRadius: "8px",
    methodCardBg: "#1A1A1A",
    methodCardBorder: "#333333",
    methodDivider: false,
    methodIconVariant: "color",
    reviewBoxBg: "#111111",
    reviewBoxBorder: "#D4AF37",
    googleReviewBg: "#D4AF37",
    googleReviewText: "#0A0A0A",
    facebookReviewBg: "#1A1A1A",
    facebookReviewText: "#D4AF37",
    facebookReviewBorder: "#D4AF37",
    socialPillBg: "#1A1A1A",
    socialPillBorder: "#3A3A3A",
    socialPillText: "#F5F5F5",
    disclaimer: "#737373",
    cardShadow: "none",
    cardRadius: "16px",
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Inter', system-ui, sans-serif",
    isDark: true,
    amountLabel: "Select amount",
    payLabel: "Pay with",
    reviewPrompt: "Happy with our service?",
    reviewSubtext: "Your feedback helps our local business grow.",
    reviewSectionLabel: "Leave us a review",
  },
  minimal_elegant: {
    key: "minimal_elegant",
    label: "Minimal & Elegant",
    layoutMode: "light_card",
    pageBg: "#EDE6DC",
    cardBg: "#FAF7F2",
    headerBg: "#E5DCD2",
    headerDecor: "minimal",
    primary: "#8B7355",
    accent: "#A69076",
    textPrimary: "#3D3429",
    textSecondary: "#5C5044",
    textMuted: "#8B7D6F",
    sectionLabel: "#8B7D6F",
    pillBg: "#FAF7F2",
    pillBorder: "#C9BAA8",
    pillSelectedBg: "#E8DFD4",
    pillSelectedBorder: "#8B7355",
    pillSelectedText: "#3D3429",
    pillRadius: "9999px",
    buttonRadius: "9999px",
    methodCardBg: "#FAF7F2",
    methodCardBorder: "#D6C9BC",
    methodDivider: true,
    methodIconVariant: "color",
    reviewBoxBg: "#F0EAE3",
    reviewBoxBorder: "#D6C9BC",
    googleReviewBg: "#8B7355",
    googleReviewText: "#FFFFFF",
    facebookReviewBg: "#FAF7F2",
    facebookReviewText: "#8B7355",
    facebookReviewBorder: "#8B7355",
    socialPillBg: "#FAF7F2",
    socialPillBorder: "#D6C9BC",
    socialPillText: "#3D3429",
    disclaimer: "#A69076",
    cardShadow: "0 16px 40px -12px rgba(61, 52, 41, 0.12)",
    cardRadius: "28px",
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Georgia', 'Times New Roman', serif",
    isDark: false,
    serifHeading: true,
    amountLabel: "Select amount",
    payLabel: "Pay with",
    reviewPrompt: "Enjoyed your visit?",
    reviewSubtext: "We would love to hear from you.",
    reviewSectionLabel: "Leave us a review",
  },
  dark_luxury: {
    key: "dark_luxury",
    label: "Dark & Creative",
    layoutMode: "dark_card",
    pageBg: "#050505",
    cardBg: "#121212",
    headerBg: "#0A0A0A",
    headerDecor: "dark",
    primary: "#D4AF37",
    accent: "#F5D76E",
    textPrimary: "#F5F5F5",
    textSecondary: "#D4D4D4",
    textMuted: "#A3A3A3",
    sectionLabel: "#A3A3A3",
    pillBg: "#1A1A1A",
    pillBorder: "#2E2E2E",
    pillSelectedBg: "#D4AF37",
    pillSelectedBorder: "#D4AF37",
    pillSelectedText: "#0A0A0A",
    pillRadius: "9999px",
    buttonRadius: "9999px",
    methodCardBg: "#1A1A1A",
    methodCardBorder: "#2E2E2E",
    methodDivider: false,
    methodIconVariant: "color",
    reviewBoxBg: "#1A1A1A",
    reviewBoxBorder: "#2E2E2E",
    googleReviewBg: "#D4AF37",
    googleReviewText: "#0A0A0A",
    facebookReviewBg: "#262626",
    facebookReviewText: "#F5F5F5",
    socialPillBg: "#1A1A1A",
    socialPillBorder: "#2E2E2E",
    socialPillText: "#E5E5E5",
    disclaimer: "#737373",
    cardShadow: "0 24px 60px -16px rgba(212, 175, 55, 0.12), 0 8px 24px -8px rgba(0,0,0,0.5)",
    cardRadius: "24px",
    fontFamily: "'Inter', system-ui, sans-serif",
    headingFontFamily: "'Inter', system-ui, sans-serif",
    isDark: true,
    amountLabel: "Select amount",
    payLabel: "Pay with",
    reviewPrompt: "Happy with our service?",
    reviewSubtext: "Your feedback helps our local business grow.",
    reviewSectionLabel: "Leave us a review",
  },
};

export function getPageTheme(key: string | null | undefined): PageThemeTokens {
  if (key && PAGE_THEME_KEYS.includes(key as PageThemeKey)) {
    return PAGE_THEMES[key as PageThemeKey];
  }
  return PAGE_THEMES.modern_blue;
}
