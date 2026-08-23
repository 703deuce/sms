/** Smart Routing sidebar children (shared by MCTB, Numbers, and Personal nav). */
export function buildSmartRoutingNavChildren() {
  return [
    { label: "Overview", href: "/smart-routing" },
    { label: "AI Routing Assistant", href: "/smart-routing/ai" },
    { label: "Call Flows", href: "/smart-routing/flows" },
    { label: "People & Destinations", href: "/smart-routing/destinations" },
    { label: "Business Hours", href: "/smart-routing/hours" },
    { label: "Business Callback", href: "/smart-routing/callback" },
    { label: "Audio", href: "/smart-routing/audio" },
    { label: "Activity", href: "/smart-routing/activity" },
    { label: "Setup", href: "/smart-routing/setup" },
  ];
}
