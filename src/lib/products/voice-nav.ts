import { buildAccountNavItems } from "@/lib/products/account-nav";
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Clock,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  PhoneForwarded,
  PhoneMissed,
  SlidersHorizontal,
  Sparkles,
  Users,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { isSmartRoutingSectionPath } from "@/lib/smart-routing/display";
import {
  type WorkspaceFeatureSnapshot,
  type TransovoProductFeature,
} from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { buildSmartRoutingNavChildren } from "@/lib/smart-routing/nav-children";
import { isMctbFocusedCustomerNav } from "@/lib/products/mctb-focused-nav";
import { getSmsPlatformPageTitle } from "@/lib/products/sms-platform-nav";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  smartRoutingFlowId?: string | null;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  showBillingNav?: boolean;
  inboxBadge?: number;
  /** Legacy SMS product entitlement or Mass Texting — shows SMS platform nav. */
  hasSms?: boolean;
};

function featureActive(
  features: WorkspaceFeatureSnapshot | null | undefined,
  key: TransovoProductFeature,
  fallback = true,
): boolean {
  if (!features) return fallback;
  return isActiveEntitlement(features[key]);
}

const SR_NAV_ICONS: Record<string, NavItem["icon"]> = {
  "/smart-routing": LayoutDashboard,
  "/smart-routing/ai": Sparkles,
  "/smart-routing/flows": GitBranch,
  "/smart-routing/destinations": Users,
  "/smart-routing/hours": Clock,
  "/smart-routing/activity": Activity,
  "/smart-routing/analytics": BarChart3,
  "/smart-routing/callback": PhoneForwarded,
  "/smart-routing/setup": SlidersHorizontal,
};

function buildLegacyProductNav(
  features: WorkspaceFeatureSnapshot | null | undefined,
): NavItem[] {
  const hasSr = featureActive(features, "smart_routing", false);
  const hasCf = featureActive(features, "call_forwarding", false);
  const items: NavItem[] = [];

  if (hasSr) {
    const pages: NavItem[] = buildSmartRoutingNavChildren().map((item) => ({
      ...item,
      icon: SR_NAV_ICONS[item.href] ?? LayoutDashboard,
    }));
    if (pages[0]) {
      pages[0] = { ...pages[0], sectionLabel: "Smart Routing" };
    }
    items.push(...pages);
  }

  if (hasCf) {
    items.push({
      label: "Call Forwarding",
      href: "/call-forwarding",
      icon: PhoneForwarded,
      sectionLabel: hasSr ? undefined : "Call Forwarding",
      matchExact: true,
    });
    items.push(
      { label: "Setup", href: "/call-forwarding/setup", icon: SlidersHorizontal },
      { label: "Business hours", href: "/call-forwarding/hours", icon: Clock },
      { label: "Outbound calling", href: "/call-forwarding/outbound", icon: PhoneForwarded },
    );
  }

  return items;
}

function buildMctbNav(options: VoiceNavOptions): NavItem[] {
  const items: NavItem[] = [
    {
      label: "Missed Calls",
      href: "/voice/missed-calls",
      icon: PhoneMissed,
      sectionLabel: "Missed Call Text Back",
    },
    { label: "Voicemail", href: "/voice/voicemail", icon: Voicemail },
    { label: "Consent Log", href: "/voice/consent-log", icon: ClipboardCheck },
    { label: "Text Back Setup", href: "/voice/setup", icon: SlidersHorizontal },
    { label: "Schedule", href: "/voice/schedule", icon: Clock },
  ];
  if (options.showTryIt) {
    items.push({ label: "Try It", href: "/voice/try-it", icon: Sparkles });
  }
  return items;
}

/**
 * MCTB + Smart Routing sidebar — separate from Mass SMS platform nav.
 */
export function buildMctbShellNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;
  const mctbFocused = isMctbFocusedCustomerNav();

  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/voice/missed-calls",
      icon: LayoutDashboard,
      sectionLabel: "Overview",
      matchExact: true,
    },
  ];

  if (!mctbFocused) {
    items.push(...buildLegacyProductNav(features));
  }

  if (showMctbSection) {
    items.push(...buildMctbNav(options));
  }

  if (!showMctbSection) {
    items.push(
      {
        label: "Numbers",
        href: "/voice/numbers",
        icon: Users,
        sectionLabel: "Manage",
        matchExact: true,
      },
      { label: "Messaging Compliance", href: "/compliance", icon: ClipboardCheck },
      { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
    );
  }

  items.push(...buildAccountNavItems());

  return items;
}

/**
 * @deprecated Prefer buildMctbShellNav or buildSmsPlatformNav via product shell tabs.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  return buildMctbShellNav(options);
}

export function getVoicePageTitle(pathname: string): string {
  const smsTitle = getSmsPlatformPageTitle(pathname);
  if (smsTitle) return smsTitle;

  if (pathname === "/dashboard" || pathname === "/outcomes") return "Dashboard";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/conversations")) return "Conversations";
  if (pathname.startsWith("/inbox")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";
  if (pathname.startsWith("/voice/setup")) return "Text Back Setup";
  if (pathname.startsWith("/voice/schedule")) return "Schedule";
  if (pathname.startsWith("/voice/transcription")) return "Transcription";
  if (pathname.startsWith("/voice/callback-requests")) return "Callback Requests";
  if (pathname.startsWith("/voice/needs-attention")) return "Needs Attention";
  if (pathname === "/voice/analytics") return "Analytics";
  if (pathname.startsWith("/voice/reports")) return "Analytics";
  if (pathname === "/smart-routing/analytics") return "Analytics";
  if (isSmartRoutingSectionPath(pathname)) {
    if (pathname === "/smart-routing/ai") return "AI Routing Assistant";
    if (pathname === "/smart-routing/flows") return "Call Flows";
    if (pathname === "/smart-routing/destinations") return "People & Destinations";
    if (pathname === "/smart-routing/hours") return "Business Hours";
    if (pathname === "/smart-routing/callback") return "Business Call Back";
    if (pathname === "/smart-routing/activity") return "Activity";
    if (pathname === "/smart-routing/new") return "Create Flow";
    if (pathname === "/smart-routing/audio") return "Audio Library";
    if (pathname === "/smart-routing/setup") return "Routing Setup";
    return "";
  }
  if (pathname.startsWith("/voice/voicemail") || pathname.startsWith("/personal/voicemail")) {
    return "Voicemail";
  }
  if (pathname === "/voice/numbers/buy" || pathname === "/numbers/buy") return "Buy Numbers";
  if (pathname.startsWith("/voice/numbers") || pathname.startsWith("/numbers")) return "Numbers";
  if (pathname.startsWith("/compliance")) return "Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/business")) return "Business Profile";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings/workspaces")) return "Workspace";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/call-forwarding/outbound")) return "Outbound calling";
  if (pathname.startsWith("/call-forwarding/hours")) return "Business hours";
  if (pathname.startsWith("/call-forwarding/setup")) return "Setup";
  if (pathname.startsWith("/call-forwarding")) return "Call Forwarding";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildMassSmsMobileNav() {
  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Campaigns", href: "/campaigns" },
    { label: "Inbox", href: "/conversations" },
    { label: "Contacts", href: "/contacts" },
  ];
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;

  const items = [{ label: "Missed", href: "/voice/missed-calls" }];

  if (showMctbSection) {
    items.push(
      { label: "Setup", href: "/voice/setup" },
      { label: "Consent", href: "/voice/consent-log" },
    );
  }

  if (options.showTryIt) {
    items.push({ label: "Try It", href: "/voice/try-it" });
  }

  return items.slice(0, 4);
}
