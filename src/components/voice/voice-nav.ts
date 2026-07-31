export type VoiceNavItem = { label: string; href: string };

export type VoiceSection = {
  key: string;
  label: string;
  items: VoiceNavItem[];
};

export const voiceAgentsSection: VoiceSection = {
  key: "agents",
  label: "Agents",
  items: [
    { label: "Agents", href: "/voice/agents" },
    { label: "Knowledge", href: "/voice/knowledge" },
    { label: "Tools", href: "/voice/tools" },
    { label: "Calendars", href: "/voice/calendars" },
    { label: "Testing", href: "/voice/testing" },
  ],
};

export const voicePhoneSection: VoiceSection = {
  key: "phone",
  label: "Phone & routing",
  items: [
    { label: "Phone numbers", href: "/voice/numbers" },
    { label: "Inbound routing", href: "/voice/inbound-routing" },
  ],
};

export const voiceActivitySection: VoiceSection = {
  key: "activity",
  label: "Calls",
  items: [
    { label: "Calls", href: "/voice/calls" },
    { label: "Conversations", href: "/voice/conversations" },
  ],
};

export const voiceInsightsSection: VoiceSection = {
  key: "insights",
  label: "Analytics",
  items: [
    { label: "Analytics", href: "/voice/analytics" },
    { label: "Usage & billing", href: "/voice/billing" },
  ],
};

const sectionMatchers: Array<{ match: (pathname: string) => boolean; section: VoiceSection }> = [
  {
    match: (p) =>
      p.startsWith("/voice/agents") ||
      p === "/voice/knowledge" ||
      p === "/voice/tools" ||
      p === "/voice/calendars" ||
      p === "/voice/testing",
    section: voiceAgentsSection,
  },
  {
    match: (p) => p === "/voice/numbers" || p === "/voice/inbound-routing",
    section: voicePhoneSection,
  },
  {
    match: (p) => p.startsWith("/voice/calls") || p === "/voice/conversations",
    section: voiceActivitySection,
  },
  {
    match: (p) => p === "/voice/analytics" || p === "/voice/billing",
    section: voiceInsightsSection,
  },
];

/** Standalone pages (overview, campaigns, settings) have no horizontal sub-nav. */
export function getVoiceSectionForPath(pathname: string): VoiceSection | null {
  for (const { match, section } of sectionMatchers) {
    if (match(pathname)) return section;
  }
  return null;
}

export function isVoiceNavItemActive(
  pathname: string,
  item: VoiceNavItem,
  sectionKey: string,
): boolean {
  if (pathname === item.href) return true;
  if (sectionKey === "agents" && item.href === "/voice/agents") {
    return pathname.startsWith("/voice/agents/");
  }
  if (sectionKey === "activity" && item.href === "/voice/calls") {
    return pathname.startsWith("/voice/calls/");
  }
  return false;
}
