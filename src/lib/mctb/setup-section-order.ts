import { MCTB_ROUTES } from "@/lib/mctb/routes";

/** Canonical Setup section order (Pass 4 IA). */
export const MCTB_SETUP_CANONICAL_SECTION_ORDER = [
  "phone",
  "consent",
  "text-back",
  "recovery",
  "voicemail",
  "notifications",
  "exclusions",
  "links",
  "test",
] as const;

export type MctbSetupCanonicalSectionId = (typeof MCTB_SETUP_CANONICAL_SECTION_ORDER)[number];

export const MCTB_SETUP_SECTION_HREFS: Record<MctbSetupCanonicalSectionId, string> = {
  phone: MCTB_ROUTES.setupPhone,
  consent: MCTB_ROUTES.setupConsent,
  "text-back": MCTB_ROUTES.setupTextBack,
  recovery: MCTB_ROUTES.setupRecovery,
  voicemail: MCTB_ROUTES.setupVoicemail,
  notifications: MCTB_ROUTES.setupNotifications,
  exclusions: MCTB_ROUTES.setupExclusions,
  links: MCTB_ROUTES.setupLinks,
  test: MCTB_ROUTES.setupTest,
};
