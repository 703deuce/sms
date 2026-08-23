import {
  showAiRoutingAssistantInNav,
  showSrAudioInNav,
  showSrBusinessCallBack,
} from "@/lib/products/transovo-launch";

/** Smart Routing sidebar children (shared by MCTB, Numbers, and Personal nav). */
export function buildSmartRoutingNavChildren() {
  const items: Array<{ label: string; href: string }> = [
    { label: "Overview", href: "/smart-routing" },
  ];

  if (showAiRoutingAssistantInNav()) {
    items.push({ label: "AI Routing Assistant", href: "/smart-routing/ai" });
  }

  items.push(
    { label: "Call Flows", href: "/smart-routing/flows" },
    { label: "People & Destinations", href: "/smart-routing/destinations" },
    { label: "Business Hours", href: "/smart-routing/hours" },
    { label: "Activity", href: "/smart-routing/activity" },
    { label: "Analytics", href: "/smart-routing/analytics" },
  );

  if (showSrBusinessCallBack()) {
    items.push({
      label: "Business Call Back",
      href: "/smart-routing/callback",
    });
  }

  items.push({ label: "Setup", href: "/smart-routing/setup" });

  if (showSrAudioInNav()) {
    items.push({ label: "Audio", href: "/smart-routing/audio" });
  }

  return items;
}
