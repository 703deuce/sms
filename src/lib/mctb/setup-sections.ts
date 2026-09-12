import { MCTB_ROUTES } from "@/lib/mctb/routes";

export type MctbSetupSectionId =
  | "overview"
  | "phone"
  | "recovery"
  | "consent"
  | "voicemail"
  | "notifications"
  | "exclusions"
  | "test";

export type MctbSetupSection = {
  id: MctbSetupSectionId;
  label: string;
  href: string;
  description: string;
};

/** Permanent Setup workspace sections (horizontal nav). */
export const MCTB_SETUP_SECTIONS: MctbSetupSection[] = [
  {
    id: "overview",
    label: "Overview",
    href: MCTB_ROUTES.setup,
    description: "Operational status and quick links",
  },
  {
    id: "phone",
    label: "Phone & Forwarding",
    href: MCTB_ROUTES.setupPhone,
    description: "Business line, carrier, and forwarding verification",
  },
  {
    id: "recovery",
    label: "Recovery",
    href: MCTB_ROUTES.setupRecovery,
    description: "Missed-call triggers, cooldown, pause, and recovery eligibility",
  },
  {
    id: "consent",
    label: "Consent",
    href: MCTB_ROUTES.setupConsent,
    description: "Press 1 vs existing consent",
  },
  {
    id: "voicemail",
    label: "Voicemail",
    href: MCTB_ROUTES.setupVoicemail,
    description: "Greeting and voicemail fallback",
  },
  {
    id: "notifications",
    label: "Notifications",
    href: MCTB_ROUTES.setupNotifications,
    description: "Alerts and handoff",
  },
  {
    id: "exclusions",
    label: "Exclusions",
    href: MCTB_ROUTES.setupExclusions,
    description: "Do-not-text numbers",
  },
  {
    id: "test",
    label: "Test",
    href: MCTB_ROUTES.setupTest,
    description: "Live test and diagnostics",
  },
];

const RECOVERY_PREFIXES = [
  "/mctb/setup/recovery",
  "/mctb/setup/missed-call-rules",
  "/mctb/setup/text-back",
  "/mctb/setup/links",
  "/mctb/setup/follow-up",
  "/mctb/setup/business-hours",
];

export function resolveMctbSetupSectionId(pathname: string): MctbSetupSectionId {
  if (pathname === MCTB_ROUTES.setup || pathname === `${MCTB_ROUTES.setup}/`) {
    return "overview";
  }
  if (pathname.startsWith(MCTB_ROUTES.setupPhone)) return "phone";
  if (RECOVERY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "recovery";
  }
  if (pathname.startsWith(MCTB_ROUTES.setupConsent)) return "consent";
  if (pathname.startsWith(MCTB_ROUTES.setupVoicemail)) return "voicemail";
  if (pathname.startsWith(MCTB_ROUTES.setupNotifications)) return "notifications";
  if (pathname.startsWith(MCTB_ROUTES.setupExclusions)) return "exclusions";
  if (pathname.startsWith(MCTB_ROUTES.setupTest)) return "test";
  if (pathname.startsWith(MCTB_ROUTES.setupStart)) return "overview";
  return "overview";
}
