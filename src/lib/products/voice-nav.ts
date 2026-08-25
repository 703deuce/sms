import {
  BarChart3,
  ClipboardCheck,
  CreditCard,
  FileText,
  GitBranch,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneForwarded,
  PhoneMissed,
  Printer,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Voicemail,
  Clock,
  ShoppingCart,
  Users,
  Activity,
  BadgeCheck,
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

function buildLegacyProductNav(
  features: WorkspaceFeatureSnapshot | null | undefined,
): NavItem[] {
  const hasSr = featureActive(features, "smart_routing", false);
  const hasCf = featureActive(features, "call_forwarding", false);
  const hasCallback = featureActive(features, "callback_requests", false);
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

  items.push({
    label: "Callback Requests",
    href: "/voice/callback-requests",
    icon: PhoneForwarded,
    badge: hasCallback ? undefined : "Add-on",
  });

  return items;
}

/**
 * Transovo voice sidebar — MCTB-focused customer nav by default.
 * Legacy product routes remain in the codebase; hidden from nav when focused mode is on.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;
  const hasVm = featureActive(features, "visual_voicemail", false);
  const hasTranscription = featureActive(features, "ai_transcription", false);
  const hasFax = featureActive(features, "fax", false);
  const hasVerify = featureActive(features, "verify", false);
  const mctbFocused = isMctbFocusedCustomerNav();

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

  if (!mctbFocused) {
    items.push(...buildLegacyProductNav(features));
  }

  if (hasFax || options.showTryIt) {
    items.push({
      label: "Fax",
      href: "/fax",
      icon: Printer,
      sectionLabel: "Products",
      matchExact: true,
    });
  }

  items.push({
    label: "Verify",
    href: "/verify",
    icon: BadgeCheck,
    sectionLabel: hasFax ? undefined : "Products",
    badge: hasVerify ? undefined : "Credits",
    matchExact: true,
  });

  items.push({
    label: "Visual Voicemail",
    href: "/voice/voicemail",
    icon: Voicemail,
    sectionLabel: "Add-ons",
    badge: hasVm ? undefined : "Add-on",
  });
  items.push({
    label: "Transcription",
    href: "/voice/transcription",
    icon: FileText,
    badge: hasTranscription ? undefined : "Add-on",
  });

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
  if (pathname.startsWith("/voice/transcription")) return "Transcription";
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
  if (pathname.startsWith("/fax")) {
    if (pathname === "/fax/send") return "Send Fax";
    if (pathname === "/fax/inbox") return "Inbox";
    if (pathname === "/fax/sent") return "Sent";
    if (pathname === "/fax/numbers") return "Fax Numbers";
    if (pathname === "/fax/settings") return "Fax Settings";
    return "Fax";
  }
  if (pathname.startsWith("/verify")) {
    if (pathname === "/verify/single") return "Single Verify";
    if (pathname === "/verify/bulk") return "Bulk Verify";
    if (pathname === "/verify/jobs") return "Verification Jobs";
    if (pathname === "/verify/billing") return "Verify Billing";
    return "Verify";
  }
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;
  const mctbFocused = isMctbFocusedCustomerNav();

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

  if (!mctbFocused && featureActive(features, "smart_routing", false)) {
    items.push({ label: "Routing", href: "/smart-routing" });
  }

  items.push(
    { label: "Analytics", href: "/voice/analytics" },
    { label: "Voicemail", href: "/voice/voicemail" },
    { label: "Transcription", href: "/voice/transcription" },
  );
  return items;
}
