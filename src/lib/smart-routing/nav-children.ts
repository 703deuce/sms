import { showSrBusinessCallBack } from "@/lib/products/transovo-launch";

/**
 * Smart Routing sidebar children — launch-simplified product nav.
 * AI assistant, audio library, and flow templates remain reachable via routes and in-page links.
 */
export function buildSmartRoutingNavChildren() {
  const items: Array<{ label: string; href: string; matchExact?: boolean }> = [
    { label: "Overview", href: "/smart-routing", matchExact: true },
    { label: "Call Flows", href: "/smart-routing/flows" },
    { label: "People & Destinations", href: "/smart-routing/destinations" },
    { label: "Business Hours", href: "/smart-routing/hours" },
    { label: "Activity", href: "/smart-routing/activity" },
    { label: "Analytics", href: "/smart-routing/analytics" },
  ];

  if (showSrBusinessCallBack()) {
    items.push({
      label: "Business Call Back",
      href: "/smart-routing/callback",
    });
  }

  items.push({ label: "Setup", href: "/smart-routing/setup" });

  return items;
}
