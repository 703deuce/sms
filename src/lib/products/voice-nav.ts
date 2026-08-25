import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
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
  Activity,
  Bell,
  ShoppingCart,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { isSmartRoutingSectionPath } from "@/lib/smart-routing/display";
import {
  type WorkspaceFeatureSnapshot,
  type TransovoProductFeature,
} from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { buildSmartRoutingNavChildren } from "@/lib/smart-routing/nav-children";

export type VoiceNavOptions = {
  primaryVoiceAgentId?: string | null;
  showTryIt?: boolean;
  smartRoutingFlowId?: string | null;
  productFeatures?: WorkspaceFeatureSnapshot | null;
  showBillingNav?: boolean;
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

/** Flat Smart Routing links for the voice sidebar. */
function buildSmartRoutingNavItems(firstSectionLabel?: string): NavItem[] {
  const pages: NavItem[] = buildSmartRoutingNavChildren().map((item) => ({
    ...item,
    icon: SR_NAV_ICONS[item.href] ?? LayoutDashboard,
  }));
  if (firstSectionLabel && pages[0]) {
    pages[0] = { ...pages[0], sectionLabel: firstSectionLabel };
  }
  return pages;
}

/**
 * Transovo inbound platform sidebar — product bands:
 * Dashboard → Missed Call Text Back → Smart Routing → Add-ons → Manage → Account.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const hasSr = featureActive(features, "smart_routing", false);
  const hasCf = featureActive(features, "call_forwarding", false);
  const hasVm = featureActive(features, "visual_voicemail", false);
  const hasCallback = featureActive(features, "callback_requests", false);

  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Dashboard",
      matchExact: true,
    },
    {
      label: "Needs Attention",
      href: "/voice/needs-attention",
      icon: Bell,
    },
  ];

  if (hasMctb) {
    items.push({
      label: "Conversations",
      href: "/inbox",
      icon: MessageSquare,
      sectionLabel: "Missed Call Text Back",
    });
    items.push(
      {
        label: "Missed Calls",
        href: "/voice/missed-calls",
        icon: PhoneMissed,
      },
      {
        label: "Consent log",
        href: "/voice/consent-log",
        icon: ClipboardCheck,
      },
      {
        label: "Configure",
        href: "/voice/setup",
        icon: SlidersHorizontal,
      },
    );
    if (options.showTryIt) {
      items.push({
        label: "Try It",
        href: "/voice/try-it",
        icon: Sparkles,
      });
    }
  }

  if (hasSr) {
    items.push(...buildSmartRoutingNavItems("Smart Routing"));
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

  items.push({
    label: "Visual Voicemail",
    href: "/voice/voicemail",
    icon: Voicemail,
    sectionLabel: "Add-ons",
    badge: hasVm ? undefined : "Add-on",
  });
  items.push({
    label: "Callback Requests",
    href: "/voice/callback-requests",
    icon: PhoneForwarded,
    badge: hasCallback ? undefined : "Add-on",
  });

  const manage: NavItem[] = [
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Hash,
      sectionLabel: "Manage",
      matchExact: true,
    },
    {
      label: "Buy Numbers",
      href: "/voice/numbers/buy",
      icon: ShoppingCart,
    },
    {
      label: "Messaging Compliance",
      href: "/compliance",
      icon: ShieldCheck,
    },
    {
      label: "Analytics",
      href: "/voice/analytics",
      icon: BarChart3,
    },
  ];

  items.push(...manage);

  const account: NavItem[] = [
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
  ];
  if (options.showBillingNav) {
    account.push({
      label: "Billing",
      href: "/settings/billing",
      icon: CreditCard,
    });
  }
  items.push(...account);

  return items;
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/inbox")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/consent-log")) return "Consent log";
  if (pathname.startsWith("/voice/setup")) return "Configure";
  if (pathname.startsWith("/voice/callback-requests")) return "Callback Requests";
  if (pathname.startsWith("/voice/needs-attention")) return "Needs Attention";
  if (pathname === "/voice/analytics") return "Analytics";
  if (pathname.startsWith("/voice/reports")) return "Overall Reports";
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
    return "Visual Voicemail";
  }
  if (pathname === "/voice/numbers/buy") return "Buy Numbers";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/compliance")) return "Messaging Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/call-forwarding/outbound")) return "Outbound calling";
  if (pathname.startsWith("/call-forwarding/hours")) return "Business hours";
  if (pathname.startsWith("/call-forwarding/setup")) return "Setup";
  if (pathname.startsWith("/call-forwarding")) return "Call Forwarding";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const hasSr = featureActive(features, "smart_routing", false);

  const items = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Attention", href: "/voice/needs-attention" },
  ];
  if (options.showTryIt && hasMctb) {
    items.push({ label: "Try It", href: "/voice/try-it" });
  }
  if (hasMctb) {
    items.push(
      { label: "Chats", href: "/inbox" },
      { label: "Missed", href: "/voice/missed-calls" },
      { label: "Consent", href: "/voice/consent-log" },
      { label: "Configure", href: "/voice/setup" },
    );
  }
  if (hasSr) {
    items.push({ label: "Routing", href: "/smart-routing" });
  }
  items.push({ label: "Analytics", href: "/voice/analytics" });
  items.push({ label: "Voicemail", href: "/voice/voicemail" });
  items.push({ label: "Callbacks", href: "/voice/callback-requests" });
  return items;
}
