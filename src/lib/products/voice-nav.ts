import {
  BarChart3,
  GitBranch,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  PhoneForwarded,
  Puzzle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildSmartRoutingNavChildren } from "@/lib/smart-routing/nav-children";
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

/**
 * Transovo inbound platform sidebar — entitlement-aware sections.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", true);
  const hasSr = featureActive(features, "smart_routing", true);
  const hasVm = featureActive(features, "visual_voicemail", false);
  const hasCallback = featureActive(features, "callback_requests", false);

  const main: NavItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Main",
    },
  ];

  if (options.showTryIt && hasMctb) {
    main.push({
      label: "Try It",
      href: "/voice/try-it",
      icon: Sparkles,
    });
  }

  if (hasMctb) {
    main.push(
      {
        label: "Conversations",
        href: "/inbox",
        icon: MessageSquare,
      },
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
    main.push({
      label: "Smart Routing",
      href: "/smart-routing",
      icon: GitBranch,
      children: buildSmartRoutingNavChildren(options.smartRoutingFlowId ?? null),
    });
  }

  if (hasVm) {
    main.push({
      label: "Visual Voicemail",
      href: "/personal/voicemail",
      icon: Voicemail,
    });
  }

  if (hasCallback) {
    main.push({
      label: "Callback Requests",
      href: "/voice/callback-requests",
      icon: PhoneForwarded,
    });
  }

  return [
    ...main,
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
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
  ];
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/inbox")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/setup")) return "Setup";
  if (pathname.startsWith("/voice/callback-requests")) return "Callback Requests";
  if (isSmartRoutingSectionPath(pathname)) {
    if (pathname === "/smart-routing/new") return "Create Flow";
    if (pathname === "/smart-routing/audio") return "Audio Library";
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
  const items = [{ label: "Home", href: "/dashboard" }];
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
  }
  return items;
}
