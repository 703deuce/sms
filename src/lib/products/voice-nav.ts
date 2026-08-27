import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileText,
  GitBranch,
  Hash,
  LayoutDashboard,
  MessageSquare,
  PhoneForwarded,
  PhoneMissed,
  Puzzle,
  Settings,
  ShieldCheck,
  ShoppingCart,
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
import { buildSmsPlatformNav, getSmsPlatformPageTitle } from "@/lib/products/sms-platform-nav";

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

function buildCallbackAddon(
  features: WorkspaceFeatureSnapshot | null | undefined,
): NavItem | null {
  const hasCallback = featureActive(features, "callback_requests", false);
  return {
    label: "Callback Requests",
    href: "/voice/callback-requests",
    icon: PhoneForwarded,
    badge: hasCallback ? undefined : "Add-on",
  };
}

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
      label: "Conversations",
      href: "/inbox?product=mctb",
      icon: MessageSquare,
      sectionLabel: "Missed Call Text Back",
    },
    { label: "Missed Calls", href: "/voice/missed-calls", icon: PhoneMissed },
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

function buildAddonNav(
  features: WorkspaceFeatureSnapshot | null | undefined,
  options: { includeVoicemail: boolean },
): NavItem[] {
  const hasTranscription = featureActive(features, "ai_transcription", false);
  const hasVm = featureActive(features, "visual_voicemail", false);
  const items: NavItem[] = [];

  if (options.includeVoicemail) {
    items.push({
      label: "Visual Voicemail",
      href: "/voice/voicemail",
      icon: Voicemail,
      sectionLabel: "Add-ons",
      badge: hasVm ? undefined : "Add-on",
    });
  }

  items.push({
    label: "Transcription",
    href: "/voice/transcription",
    icon: FileText,
    sectionLabel: items.length === 0 ? "Add-ons" : undefined,
    badge: hasTranscription ? undefined : "Add-on",
  });

  return items;
}

/**
 * Unified Transovo customer sidebar — SMS platform first, MCTB automation at the bottom.
 */
export function buildVoiceNav(options: VoiceNavOptions = {}): NavItem[] {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;
  const hasMassTexting = featureActive(features, "mass_texting", false);
  const showSmsPlatform = hasMassTexting || options.hasSms === true;
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

  if (showSmsPlatform) {
    items.push(
      ...buildSmsPlatformNav({
        inboxBadge: options.inboxBadge,
        hasMassTexting,
      }),
    );
  }

  if (!mctbFocused) {
    items.push(...buildLegacyProductNav(features));
  }

  if (!showSmsPlatform) {
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
  } else {
    items.push({
      label: "Buy Numbers",
      href: "/voice/numbers/buy",
      icon: ShoppingCart,
      sectionLabel: "Workspace",
    });
  }

  items.push(...buildAddonNav(features, { includeVoicemail: !showMctbSection }));
  const callbackAddon = buildCallbackAddon(features);
  if (callbackAddon) {
    callbackAddon.sectionLabel = items.some((i) => i.sectionLabel === "Add-ons")
      ? undefined
      : "Add-ons";
    items.push(callbackAddon);
  }

  if (showMctbSection) {
    items.push(...buildMctbNav(options));
  }

  const account: NavItem[] = [
    {
      label: "Business profile",
      href: "/settings/business",
      icon: Settings,
      sectionLabel: showSmsPlatform ? undefined : "Account",
    },
  ];
  if (options.showBillingNav && !showSmsPlatform) {
    account.push({ label: "Billing", href: "/settings/billing", icon: CreditCard });
  }
  items.push(...account);

  return items;
}

export function getVoicePageTitle(pathname: string): string {
  const smsTitle = getSmsPlatformPageTitle(pathname);
  if (smsTitle) return smsTitle;

  if (pathname === "/dashboard" || pathname === "/outcomes") return "";
  if (pathname.startsWith("/voice/try-it")) return "Try It";
  if (pathname.startsWith("/inbox")) return "Inbox";
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
  if (pathname.startsWith("/contact")) return "Help";
  return "";
}

export function buildVoiceMobileNav(options: VoiceNavOptions = {}) {
  const features = options.productFeatures;
  const hasMctb = featureActive(features, "mctb", false);
  const showMctbSection = hasMctb || options.showTryIt;
  const hasMassTexting = featureActive(features, "mass_texting", false);
  const showSmsPlatform = hasMassTexting || options.hasSms === true;
  const mctbFocused = isMctbFocusedCustomerNav();

  const items = [{ label: "Dashboard", href: "/dashboard" }];

  if (showSmsPlatform) {
    if (hasMassTexting) items.push({ label: "SMS", href: "/sms" });
    items.push(
      { label: "Inbox", href: "/inbox" },
      { label: "Campaigns", href: "/campaigns" },
      { label: "Send", href: "/send" },
      { label: "Contacts", href: "/contacts" },
    );
  }

  if (!mctbFocused && featureActive(features, "smart_routing", false)) {
    items.push({ label: "Routing", href: "/smart-routing" });
  }

  if (!showSmsPlatform) {
    items.push({ label: "Analytics", href: "/voice/analytics" });
  }

  if (showMctbSection) {
    items.push(
      { label: "MCTB", href: "/inbox?product=mctb" },
      { label: "Missed", href: "/voice/missed-calls" },
      { label: "Voicemail", href: "/voice/voicemail" },
      { label: "Setup", href: "/voice/setup" },
    );
  } else {
    items.push({ label: "Voicemail", href: "/voice/voicemail" });
  }

  items.push({ label: "Transcription", href: "/voice/transcription" });
  return items;
}
