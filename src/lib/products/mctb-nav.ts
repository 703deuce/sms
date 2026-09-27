import {
  BarChart3,
  BookOpen,
  CreditCard,
  Home,
  LayoutDashboard,
  MessageSquare,
  PhoneCall,
  PhoneMissed,
  Plug,
  SlidersHorizontal,
  AudioLines,
  Settings,
  Sparkles,
  Users,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { isVoiceProductCustomerVisible } from "@/lib/products/launch-product-availability";

export type MctbNavOptions = {
  inboxBadge?: number;
  /** Workspace voice / AI receptionist entitlement — shows AI Receptionist nav group + Calls. */
  hasVoice?: boolean;
  hasNumbers?: boolean;
};

const MCTB_SECTION = "Missed Call Text Back";
const AI_RECEPTIONIST_SECTION = "AI Receptionist";
const SHARED_SECTION = "Shared";

/** Canonical MCTB product-local navigation — AI Receptionist + MCTB groups + shared links. */
export function buildMctbV1Nav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;
  const items: NavItem[] = [];

  if (options.hasVoice && isVoiceProductCustomerVisible()) {
    items.push(
      {
        label: "Overview",
        href: "/voice/overview",
        icon: LayoutDashboard,
        sectionLabel: AI_RECEPTIONIST_SECTION,
        matchExact: true,
      },
      { label: "Calls", href: "/voice/calls", icon: PhoneCall },
      {
        label: "Receptionist",
        href: "/voice/receptionist",
        icon: AudioLines,
      },
      { label: "Business Knowledge", href: "/voice/knowledge", icon: BookOpen },
      {
        label: "Call Handling",
        href: "/voice/call-handling",
        icon: SlidersHorizontal,
      },
      { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
    );
  }

  items.push(
    {
      label: "Overview",
      href: MCTB_ROUTES.home,
      icon: LayoutDashboard,
      sectionLabel: MCTB_SECTION,
      matchExact: true,
    },
    {
      label: "Missed Calls",
      href: MCTB_ROUTES.missedCalls,
      icon: PhoneMissed,
    },
    {
      label: "Inbox",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
    {
      label: "AI Recovery",
      href: MCTB_ROUTES.aiRecovery,
      icon: Sparkles,
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
      label: "Setup",
      href: MCTB_ROUTES.setup,
      icon: SlidersHorizontal,
    },
    {
      label: "Integrations",
      href: MCTB_ROUTES.integrations,
      icon: Plug,
      sectionLabel: SHARED_SECTION,
    },
  );

  if (options.hasNumbers) {
    items.push({
      label: "Numbers",
      href: "/voice/numbers",
      icon: Users,
    });
  }

  items.push(
    {
      label: "Billing",
      href: "/settings/billing",
      icon: CreditCard,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
    },
  );

  return items;
}

/** Bottom nav for mobile — primary MCTB destinations (compact; full IA via sidebar). */
export function buildMctbV1MobileNav(options: MctbNavOptions = {}): NavItem[] {
  const badge = options.inboxBadge ?? 0;
  const items: NavItem[] = [
    { label: "Home", href: MCTB_ROUTES.home, icon: Home },
    { label: "Missed", href: MCTB_ROUTES.missedCalls, icon: PhoneMissed },
    {
      label: "Inbox",
      href: MCTB_ROUTES.conversations,
      icon: MessageSquare,
      badge: badge > 0 ? badge : undefined,
    },
  ];

  if (options.hasVoice && isVoiceProductCustomerVisible()) {
    items.push({ label: "Calls", href: "/voice/calls", icon: PhoneCall });
  }

  items.push({ label: "Setup", href: MCTB_ROUTES.setup, icon: SlidersHorizontal });

  return items;
}

export function getMctbPageTitle(pathname: string): string {
  if (pathname === "/voice/overview" || pathname.startsWith("/voice/overview/")) {
    return "Overview";
  }
  if (pathname.startsWith("/voice/calls")) return "Calls";
  if (pathname.startsWith("/voice/knowledge")) return "Business Knowledge";
  if (pathname.startsWith("/voice/receptionist")) return "Receptionist";
  if (pathname.startsWith("/voice/call-handling") || pathname.startsWith("/voice/inbound-routing")) {
    return "Call Handling";
  }
  if (pathname.startsWith("/voice/needs-attention")) return "Calls";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/settings/billing")) return "Billing";

  if (pathname === MCTB_ROUTES.home) return "Missed Call Text Back";
  if (pathname === MCTB_ROUTES.missedCalls) return "";
  if (pathname.startsWith(MCTB_ROUTES.missedCalls)) return "Missed Calls";
  if (pathname === MCTB_ROUTES.voicemail) return "";
  if (pathname.startsWith("/mctb/voicemail")) return "Voicemail";
  if (pathname === MCTB_ROUTES.analytics) return "";
  if (pathname.startsWith(MCTB_ROUTES.analytics) || pathname.startsWith("/analytics/mctb")) {
    return "Analytics";
  }
  if (pathname.startsWith(MCTB_ROUTES.aiRecovery)) return "AI Recovery";
  if (pathname.startsWith(MCTB_ROUTES.aiLeadRecovery)) return "AI Recovery";
  if (pathname.startsWith(MCTB_ROUTES.voiceAgent)) return "Receptionist";
  if (pathname.startsWith(MCTB_ROUTES.setup)) return "Setup";
  if (pathname.startsWith(MCTB_ROUTES.numbers)) return "Numbers";
  if (pathname.startsWith(MCTB_ROUTES.complianceConsent)) return "Consent Log";
  if (pathname.startsWith("/onboarding/mctb")) return "Setup";
  if (pathname.startsWith("/conversations") || pathname.startsWith("/mctb/conversations")) {
    return "Inbox";
  }
  if (pathname.startsWith(MCTB_ROUTES.payments)) return "Payments";
  if (pathname === MCTB_ROUTES.integrations || pathname.startsWith("/integrations")) return "Integrations";

  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/voicemail")) return "Voicemail";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";
  if (pathname.startsWith("/voice/try-it")) return "Test";
  if (pathname.startsWith("/voice/schedule")) return "Recovery Controls";

  return "";
}

/** Shared workspace routes that should keep the stored MCTB shell (not Appointments). */
export function isMctbSharedWorkspacePath(pathname: string): boolean {
  if (pathname === "/payments" || pathname.startsWith("/payments/")) return true;
  if (pathname === "/integrations" || pathname.startsWith("/integrations/")) return true;
  if (pathname === "/settings/billing" || pathname.startsWith("/settings/billing/")) return true;
  return false;
}
