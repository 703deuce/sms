import { buildAccountNavItems } from "@/lib/products/account-nav";
import { AI_AFTER_HOURS_DISPLAY_NAME } from "@/lib/products/ai-after-hours";
import {
  buildVoiceIaPrimaryNavItems,
  getVoiceIaPageTitle,
  VOICE_IA_PRIMARY_DESTINATIONS,
} from "@/lib/products/voice-ia-nav";
import { Users } from "lucide-react";
import type { NavItem } from "@/lib/nav";

export type AiAfterHoursNavOptions = {
  /** @deprecated Agent list nav removed — canonical Receptionist is /voice/receptionist */
  primaryVoiceAgentId?: string | null;
};

/**
 * Standalone AI After Hours / AI Receptionist product shell — same six-destination Voice IA as bundled MCTB.
 */
export function buildAiAfterHoursNav(_options: AiAfterHoursNavOptions = {}): NavItem[] {
  const items: NavItem[] = buildVoiceIaPrimaryNavItems({
    sectionLabel: AI_AFTER_HOURS_DISPLAY_NAME,
  });

  items.push({
    label: "Numbers",
    href: "/voice/numbers",
    icon: Users,
    sectionLabel: "Manage",
    matchExact: true,
  });

  items.push(...buildAccountNavItems());
  return items;
}

export function getAiAfterHoursPageTitle(pathname: string): string | null {
  const voiceTitle = getVoiceIaPageTitle(pathname);
  if (voiceTitle) return voiceTitle;
  if (pathname.startsWith("/voice/numbers")) return "Numbers";
  return null;
}

/** Compact mobile bar — subset of permanent Voice IA (full IA via sidebar / More). */
export function buildAiAfterHoursMobileNav(): NavItem[] {
  const pick = (label: string) =>
    VOICE_IA_PRIMARY_DESTINATIONS.find((d) => d.label === label)!;
  return [
    pick("Overview"),
    pick("Calls"),
    pick("Receptionist"),
    pick("Business Knowledge"),
  ].map((d) => ({ label: d.label, href: d.href, icon: d.icon }));
}
