import {
  BarChart3,
  Bell,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Phone,
  PhoneMissed,
  Voicemail,
  MessageCircle,
  Shield,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

export type MctbNavOptions = {
  inboxBadge?: number;
  /** @deprecated Voice hidden at launch — kept for bundled shell compatibility. */
  hasVoice?: boolean;
  hasNumbers?: boolean;
};

const ACTIVITY_SECTION = "Activity";
const CONFIGURE_SECTION = "Configure";

/** Canonical launch MCTB product-local navigation. */
export function buildMctbV1Nav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;

  return [
    {
      label: "Overview",
      href: MCTB_ROUTES.home,
      icon: LayoutDashboard,
      matchExact: true,
    },
    {
      label: "Getting Started",
      href: "/getting-started",
      icon: ListChecks,
      matchExact: true,
    },
    {
      label: "Missed Calls",
      href: MCTB_ROUTES.missedCalls,
      icon: PhoneMissed,
      sectionLabel: ACTIVITY_SECTION,
    },
    {
      label: "Conversations",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "Voicemail",
      href: MCTB_ROUTES.voicemail,
      icon: Voicemail,
    },
    {
      label: "Analytics",
      href: MCTB_ROUTES.analytics,
      icon: BarChart3,
    },
    {
      label: "Missed-Call Recovery",
      href: MCTB_ROUTES.missedCallRecovery,
      icon: Shield,
      sectionLabel: CONFIGURE_SECTION,
    },
    {
      label: "Text Back",
      href: MCTB_ROUTES.textBack,
      icon: MessageCircle,
    },
    {
      label: "Notifications",
      href: MCTB_ROUTES.notifications,
      icon: Bell,
    },
    {
      label: "Phone & Forwarding",
      href: MCTB_ROUTES.phone,
      icon: Phone,
    },
    {
      label: "Help",
      href: "/help",
      icon: HelpCircle,
    },
  ];
}

/** Bottom nav for mobile — primary MCTB destinations (compact; full IA via sidebar). */
export function buildMctbV1MobileNav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;
  return [
    { label: "Home", href: MCTB_ROUTES.home, icon: Home },
    { label: "Missed", href: MCTB_ROUTES.missedCalls, icon: PhoneMissed },
    {
      label: "Chats",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    { label: "Configure", href: MCTB_ROUTES.missedCallRecovery, icon: Shield },
  ];
}

export function getMctbPageTitle(pathname: string): string {
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/getting-started")) return "Getting Started";
  if (pathname.startsWith("/help")) return "Help";

  if (pathname === MCTB_ROUTES.home) return "Missed Call Text Back";
  if (pathname === MCTB_ROUTES.missedCalls) return "";
  if (pathname.startsWith(MCTB_ROUTES.missedCalls)) return "Missed Calls";
  if (pathname.startsWith(MCTB_ROUTES.missedCallRecovery)) return "Missed-Call Recovery";
  if (pathname.startsWith(MCTB_ROUTES.textBack)) return "Text Back";
  if (pathname.startsWith(MCTB_ROUTES.notifications)) return "Notifications";
  if (pathname.startsWith(MCTB_ROUTES.phone)) return "Phone & Forwarding";
  if (pathname === MCTB_ROUTES.voicemail) return "";
  if (pathname.startsWith("/mctb/voicemail")) return "Voicemail";
  if (pathname === MCTB_ROUTES.analytics) return "";
  if (pathname.startsWith(MCTB_ROUTES.analytics) || pathname.startsWith("/analytics/mctb")) {
    return "Analytics";
  }
  if (pathname.startsWith(MCTB_ROUTES.aiRecovery)) return "AI Recovery";
  if (pathname.startsWith(MCTB_ROUTES.aiLeadRecovery)) return "AI Recovery";
  if (pathname.startsWith(MCTB_ROUTES.setup)) return "Setup";
  if (pathname.startsWith(MCTB_ROUTES.numbers)) return "Phone & Forwarding";
  if (pathname.startsWith(MCTB_ROUTES.complianceConsent)) return "Consent Log";
  if (pathname.startsWith("/onboarding/mctb")) return "Setup";
  if (pathname.startsWith("/conversations") || pathname.startsWith("/mctb/conversations")) {
    return "Conversations";
  }

  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/voicemail")) return "Voicemail";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";

  return "";
}

/** Shared workspace routes that should keep the stored MCTB shell (not Appointments). */
export function isMctbSharedWorkspacePath(pathname: string): boolean {
  if (pathname === "/payments" || pathname.startsWith("/payments/")) return true;
  if (pathname === "/integrations" || pathname.startsWith("/integrations/")) return true;
  if (pathname === "/settings/billing" || pathname.startsWith("/settings/billing/")) return true;
  return false;
}
