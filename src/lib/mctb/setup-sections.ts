import { MCTB_ROUTES } from "@/lib/mctb/routes";

export type MctbSetupSectionId =
  | "overview"
  | "phone"
  | "missed-call-rules"
  | "consent"
  | "text-back"
  | "recovery"
  | "voicemail"
  | "notifications"
  | "exclusions"
  | "links"
  | "test";

export type MctbSetupSection = {
  id: MctbSetupSectionId;
  label: string;
  href: string;
  description: string;
};

/** Permanent Setup workspace sections (horizontal nav) — canonical Pass 4 order. */
export const MCTB_SETUP_SECTIONS: MctbSetupSection[] = [
  {
    id: "overview",
    label: "Overview",
    href: MCTB_ROUTES.setup,
    description: "Setup status and section shortcuts",
  },
  {
    id: "phone",
    label: "Phone & Forwarding",
    href: MCTB_ROUTES.setupPhone,
    description: "Business line, forwarding, and messaging sender",
  },
  {
    id: "missed-call-rules",
    label: "Missed-call rules",
    href: MCTB_ROUTES.setupMissedCallRules,
    description: "Which call outcomes create missed-call events",
  },
  {
    id: "consent",
    label: "Consent",
    href: MCTB_ROUTES.setupConsent,
    description: "How permission to text is established",
  },
  {
    id: "text-back",
    label: "Text Back",
    href: MCTB_ROUTES.setupTextBack,
    description: "First recovery message and delivery timing",
  },
  {
    id: "recovery",
    label: "Recovery",
    href: MCTB_ROUTES.setupRecovery,
    description: "Pause, triggers, cooldown, and duplicate protection",
  },
  {
    id: "voicemail",
    label: "Voicemail",
    href: MCTB_ROUTES.setupVoicemail,
    description: "Voicemail greeting and behavior",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: MCTB_ROUTES.setupNotifications,
    description: "Team email alerts for recovery events",
  },
  {
    id: "exclusions",
    label: "Exclusions",
    href: MCTB_ROUTES.setupExclusions,
    description: "Numbers that should not receive recovery texts",
  },
  {
    id: "links",
    label: "Links",
    href: MCTB_ROUTES.setupLinks,
    description: "Request form and shared customer links",
  },
  {
    id: "test",
    label: "Test",
    href: MCTB_ROUTES.setupTest,
    description: "Verify forwarding and recovery",
  },
];

export function resolveMctbSetupSectionId(pathname: string): MctbSetupSectionId {
  if (pathname === MCTB_ROUTES.setup || pathname === `${MCTB_ROUTES.setup}/`) {
    return "overview";
  }
  if (pathname.startsWith(MCTB_ROUTES.setupPhone)) return "phone";
  if (pathname.startsWith(MCTB_ROUTES.setupMissedCallRules)) return "missed-call-rules";
  if (pathname.startsWith(MCTB_ROUTES.setupConsent)) return "consent";
  if (pathname.startsWith(MCTB_ROUTES.setupTextBack)) return "text-back";
  if (
    pathname.startsWith(MCTB_ROUTES.setupRecovery) ||
    pathname.startsWith("/mctb/setup/follow-up") ||
    pathname.startsWith("/mctb/setup/business-hours")
  ) {
    return "recovery";
  }
  if (pathname.startsWith(MCTB_ROUTES.setupVoicemail)) return "voicemail";
  if (pathname.startsWith(MCTB_ROUTES.setupNotifications)) return "notifications";
  if (pathname.startsWith(MCTB_ROUTES.setupExclusions)) return "exclusions";
  if (pathname.startsWith(MCTB_ROUTES.setupLinks)) return "links";
  if (pathname.startsWith(MCTB_ROUTES.setupTest)) return "test";
  if (pathname.startsWith(MCTB_ROUTES.setupStart)) return "overview";
  return "overview";
}
