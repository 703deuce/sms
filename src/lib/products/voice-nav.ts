import {
  BarChart3,
  GitBranch,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneForwarded,
  PhoneMissed,
  Puzzle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Voicemail,
  Clock,
  Users,
  Music,
  Activity,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { isSmartRoutingSectionPath } from "@/lib/smart-routing/display";
import {
  type WorkspaceFeatureSnapshot,
  type TransovoProductFeature,
} from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  smartRoutingFlowId?: string | null;
  productFeatures?: WorkspaceFeatureSnapshot | null;
};

function featureActive(
  features: WorkspaceFeatureSnapshot | null | undefined,
  key: TransovoProductFeature,
  fallback = true,
): boolean {
  if (!features) return fallback;
  return isActiveEntitlement(features[key]);
}

/** Flat Smart Routing links for the voice sidebar (all pages visible under the section). */
function buildSmartRoutingNavItems(firstSectionLabel?: string): NavItem[] {
  const pages: NavItem[] = [
    { label: "Overview", href: "/smart-routing", icon: LayoutDashboard },
    { label: "AI Routing Assistant", href: "/smart-routing/ai", icon: Sparkles },
    { label: "Call Flows", href: "/smart-routing/flows", icon: GitBranch },
    { label: "People & Destinations", href: "/smart-routing/destinations", icon: Users },
    { label: "Business Hours", href: "/smart-routing/hours", icon: Clock },
    { label: "Business Callback", href: "/smart-routing/callback", icon: PhoneForwarded },
    { label: "Audio", href: "/smart-routing/audio", icon: Music },
    { label: "Activity", href: "/smart-routing/activity", icon: Activity },
    { label: "Setup", href: "/smart-routing/setup", icon: SlidersHorizontal },
  ];
  if (firstSectionLabel) {
    pages[0] = { ...pages[0], sectionLabel: firstSectionLabel };
  }
  return pages;
}

/**
 * Transovo inbound platform sidebar — product bands:
 * Dashboard → Missed Call Text Back → Smart Routing → Manage → Account.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", true);
  const hasSr = featureActive(features, "smart_routing", true);
  const hasVm = featureActive(features, "visual_voicemail", false);
  const hasCallback = featureActive(features, "callback_requests", false);

  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  if (hasMctb) {
    items.push({
      label: "Conversations",
      href: "/inbox",
      icon: MessageSquare,
      sectionLabel: "Missed Call Text Back",
    });
    if (options.showTryIt) {
      items.push({
        label: "Try It",
        href: "/voice/try-it",
        icon: Sparkles,
      });
    }
    items.push(
      {
        label: "Missed Calls",
        href: "/voice/missed-calls",
        icon: PhoneMissed,
      },
      {
        label: "Setup",
        href: "/voice/setup",
        icon: SlidersHorizontal,
      },
    );
  }

  if (hasSr) {
    items.push(...buildSmartRoutingNavItems("Smart Routing"));
    items.push({
      label: "Routing Analytics",
      href: "/smart-routing/analytics",
      icon: BarChart3,
    });
  }

  items.push({
    label: "Visual Voicemail",
    href: hasVm ? "/personal/voicemail" : "/settings/billing?upgrade=visual_voicemail",
    icon: Voicemail,
    sectionLabel: "Add-ons",
    badge: hasVm ? undefined : "Add-on",
  });
  items.push({
    label: "Callback Requests",
    href: hasCallback ? "/voice/callback-requests" : "/settings/billing?upgrade=callback_requests",
    icon: PhoneForwarded,
    badge: hasCallback ? undefined : "Add-on",
  });

  const manage: NavItem[] = [
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Hash,
      sectionLabel: "Manage",
    },
    {
      label: "Messaging Compliance",
      href: "/compliance",
      icon: ShieldCheck,
    },
    { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
    { label: "Integrations", href: "/integrations", icon: Puzzle },
  ];

  items.push(...manage);

  items.push({
    label: "Settings",
    href: "/settings/business",
    icon: Settings,
    sectionLabel: "Account",
  });

  return items;
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/inbox")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/callback-requests")) return "Callback Requests";
  if (pathname === "/smart-routing/analytics") return "Routing Analytics";
  if (isSmartRoutingSectionPath(pathname)) {
    if (pathname === "/smart-routing/ai") return "AI Routing Assistant";
    if (pathname === "/smart-routing/flows") return "Call Flows";
    if (pathname === "/smart-routing/destinations") return "People & Destinations";
    if (pathname === "/smart-routing/hours") return "Business Hours";
    if (pathname === "/smart-routing/callback") return "Business Callback";
    if (pathname === "/smart-routing/activity") return "Activity";
    if (pathname === "/smart-routing/new") return "Create Flow";
    if (pathname === "/smart-routing/audio") return "Audio Library";
    if (pathname === "/smart-routing/setup") return "Smart Routing Setup";
    return "";
  }
  if (pathname.startsWith("/personal/voicemail")) return "Visual Voicemail";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  if (pathname.startsWith("/compliance")) return "Messaging Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", true);
  const hasSr = featureActive(features, "smart_routing", true);
  const items = [{ label: "Dashboard", href: "/dashboard" }];
  if (options.showTryIt && hasMctb) {
    items.push({ label: "Try It", href: "/voice/try-it" });
  }
  if (hasMctb) {
    items.push(
      { label: "Chats", href: "/inbox" },
      { label: "Missed", href: "/voice/missed-calls" },
      { label: "Setup", href: "/voice/setup" },
    );
  }
  if (hasSr) {
    items.push({ label: "Routing", href: "/smart-routing" });
    items.push({ label: "SR Analytics", href: "/smart-routing/analytics" });
  }
  items.push({ label: "Voicemail", href: "/personal/voicemail" });
  return items;
}
