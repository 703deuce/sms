"use client";

import { Tabs } from "@/components/ui/tabs";

export const voiceNavItems = [
  { label: "Overview", href: "/voice/overview" },
  { label: "Agents", href: "/voice/agents" },
  { label: "Agent Builder", href: "/voice/agents/new" },
  { label: "Phone Numbers", href: "/voice/numbers" },
  { label: "Inbound Routing", href: "/voice/inbound-routing" },
  { label: "Outbound Campaigns", href: "/voice/campaigns" },
  { label: "Calls", href: "/voice/calls" },
  { label: "Conversations", href: "/voice/conversations" },
  { label: "Knowledge Bases", href: "/voice/knowledge" },
  { label: "Tools & Integrations", href: "/voice/tools" },
  { label: "Calendars", href: "/voice/calendars" },
  { label: "Analytics", href: "/voice/analytics" },
  { label: "Testing", href: "/voice/testing" },
  { label: "Usage & Billing", href: "/voice/billing" },
  { label: "Settings", href: "/voice/settings" },
];

export function VoiceSubNav() {
  return <Tabs items={voiceNavItems} />;
}
