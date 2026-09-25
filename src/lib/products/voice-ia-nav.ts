import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  PhoneCall,
  SlidersHorizontal,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** Locked permanent six-destination Voice / AI Receptionist IA (customer-facing). */
export const VOICE_IA_ROUTES = {
  overview: "/voice/overview",
  calls: "/voice/calls",
  receptionist: "/voice/receptionist",
  knowledge: "/voice/knowledge",
  callHandling: "/voice/call-handling",
  analytics: "/voice/analytics",
} as const;

export type VoiceIaDestination = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const VOICE_IA_PRIMARY_DESTINATIONS: VoiceIaDestination[] = [
  { label: "Overview", href: VOICE_IA_ROUTES.overview, icon: LayoutDashboard },
  { label: "Calls", href: VOICE_IA_ROUTES.calls, icon: PhoneCall },
  { label: "Receptionist", href: VOICE_IA_ROUTES.receptionist, icon: AudioLines },
  { label: "Business Knowledge", href: VOICE_IA_ROUTES.knowledge, icon: BookOpen },
  { label: "Call Handling", href: VOICE_IA_ROUTES.callHandling, icon: SlidersHorizontal },
  { label: "Analytics", href: VOICE_IA_ROUTES.analytics, icon: BarChart3 },
];

const LEGACY_VOICE_PRIMARY_LABELS = [
  "AI Agent",
  "Agent",
  "Knowledge",
  "Inbound Routing",
  "Operations",
  "Needs Attention",
] as const;

export function buildVoiceIaPrimaryNavItems(options?: {
  sectionLabel?: string;
}): NavItem[] {
  return VOICE_IA_PRIMARY_DESTINATIONS.map((dest, index) => ({
    label: dest.label,
    href: dest.href,
    icon: dest.icon,
    ...(index === 0 && options?.sectionLabel
      ? { sectionLabel: options.sectionLabel, matchExact: true }
      : {}),
  }));
}

/** Primary sidebar parent href for contextual / compatibility Voice routes. */
export function resolveVoiceIaNavParent(pathname: string): string | null {
  if (pathname.startsWith("/voice/needs-attention")) return VOICE_IA_ROUTES.calls;
  if (pathname.startsWith("/voice/operations")) return VOICE_IA_ROUTES.callHandling;
  if (pathname.startsWith("/voice/inbound-routing")) return VOICE_IA_ROUTES.callHandling;
  if (pathname.startsWith("/voice/analytics")) return VOICE_IA_ROUTES.analytics;
  if (pathname.startsWith("/voice/calls")) return VOICE_IA_ROUTES.calls;
  if (pathname.startsWith("/voice/receptionist")) return VOICE_IA_ROUTES.receptionist;
  if (pathname.startsWith("/voice/knowledge")) return VOICE_IA_ROUTES.knowledge;
  if (pathname.startsWith("/voice/call-handling")) return VOICE_IA_ROUTES.callHandling;
  if (pathname === VOICE_IA_ROUTES.overview || pathname.startsWith(`${VOICE_IA_ROUTES.overview}/`)) {
    return VOICE_IA_ROUTES.overview;
  }
  return null;
}

export function getVoiceIaPageTitle(pathname: string): string | null {
  if (pathname === VOICE_IA_ROUTES.overview || pathname.startsWith(`${VOICE_IA_ROUTES.overview}/`)) {
    return "Overview";
  }
  if (pathname.startsWith("/voice/calls") || pathname.startsWith("/voice/needs-attention")) {
    return "Calls";
  }
  if (pathname.startsWith("/voice/receptionist")) return "Receptionist";
  if (pathname.startsWith("/voice/knowledge")) return "Business Knowledge";
  if (
    pathname.startsWith("/voice/call-handling") ||
    pathname.startsWith("/voice/inbound-routing") ||
    pathname.startsWith("/voice/operations")
  ) {
    return "Call Handling";
  }
  if (pathname.startsWith("/voice/analytics")) return "Analytics";
  return null;
}

export function voiceIaPrimaryLabels(navItems: NavItem[]): string[] {
  return navItems
    .filter((item) => VOICE_IA_PRIMARY_DESTINATIONS.some((d) => d.href === item.href))
    .map((item) => item.label);
}

export function assertNoLegacyVoicePrimaryLabels(labels: string[]): void {
  for (const legacy of LEGACY_VOICE_PRIMARY_LABELS) {
    if (labels.includes(legacy)) {
      throw new Error(`Legacy Voice nav label present: ${legacy}`);
    }
  }
}
