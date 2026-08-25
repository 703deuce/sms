import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneMissed,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Clock,
  ShoppingCart,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
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

/** Transovo voice sidebar — MCTB-only production navigation. */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;

  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      sectionLabel: "Dashboard",
      matchExact: true,
    },
  ];

  if (showMctbSection) {
    items.push({
      label: "Conversations",
      href: "/inbox",
      icon: MessageSquare,
      sectionLabel: "Missed Call Text Back",
    });
    items.push(
      { label: "Missed Calls", href: "/voice/missed-calls", icon: PhoneMissed },
      { label: "Consent Log", href: "/voice/consent-log", icon: ClipboardCheck },
      { label: "Text Back Setup", href: "/voice/setup", icon: SlidersHorizontal },
      { label: "Schedule", href: "/voice/schedule", icon: Clock },
    );
    if (options.showTryIt) {
      items.push({ label: "Try It", href: "/voice/try-it", icon: Sparkles });
    }
  }

  items.push(
    {
      label: "Numbers",
      href: "/voice/numbers",
      icon: Hash,
      sectionLabel: "Manage",
      matchExact: true,
    },
    { label: "Buy Numbers", href: "/voice/numbers/buy", icon: ShoppingCart },
    { label: "Messaging Compliance", href: "/compliance", icon: ShieldCheck },
    { label: "Analytics", href: "/voice/analytics", icon: BarChart3 },
  );

  const account: NavItem[] = [
    {
      label: "Settings",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: "Account",
    },
  ];
  if (options.showBillingNav) {
    account.push({ label: "Billing", href: "/settings/billing", icon: CreditCard });
  }
  items.push(...account);

  return items;
}

export function getVoicePageTitle(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/inbox")) return "Conversations";
  if (pathname.startsWith("/voice/missed-calls")) return "Missed Calls";
  if (pathname.startsWith("/voice/consent-log")) return "Consent Log";
  if (pathname.startsWith("/voice/setup")) return "Text Back Setup";
  if (pathname.startsWith("/voice/schedule")) return "Schedule";
  if (pathname === "/voice/analytics") return "Analytics";
  if (pathname === "/voice/numbers/buy") return "Buy Numbers";
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  if (pathname.startsWith("/compliance")) return "Messaging Compliance";
  if (pathname.startsWith("/integrations")) return "Integrations";
  if (pathname.startsWith("/settings/billing")) return "Billing";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;

  const items = [{ label: "Dashboard", href: "/dashboard" }];

  if (showMctbSection) {
    items.push(
      { label: "Chats", href: "/inbox" },
      { label: "Missed", href: "/voice/missed-calls" },
      { label: "Consent", href: "/voice/consent-log" },
      { label: "Setup", href: "/voice/setup" },
      { label: "Schedule", href: "/voice/schedule" },
    );
    if (options.showTryIt) {
      items.push({ label: "Try It", href: "/voice/try-it" });
    }
  }

  items.push(
    { label: "Analytics", href: "/voice/analytics" },
    { label: "Numbers", href: "/voice/numbers" },
  );
  return items;
}
