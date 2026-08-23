import {
  Bell,
  FileSearch,
  FileText,
  History,
  LayoutDashboard,
  Link2,
  MessageSquareText,
  QrCode,
  Send,
  Settings2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Webhook,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** Reviews platform sidebar — paired with Missed Call Text Back in the voice product shell. */
export function buildReviewsNav(): NavItem[] {
  return [
    {
      label: "Reputation Overview",
      href: "/reviews/overview",
      icon: Sparkles,
      sectionLabel: "Reviews",
    },
    { label: "Send Request", href: "/reviews/requests", icon: Send },
    { label: "Review Requests", href: "/reviews/requests", icon: MessageSquareText },
    { label: "Campaigns", href: "/reviews/campaigns", icon: FileText },
    { label: "Templates", href: "/reviews/templates", icon: FileText },
    { label: "Automations", href: "/reviews/automations", icon: Webhook },
    { label: "Contacts", href: "/reviews/contacts", icon: Users },
    {
      label: "Request History",
      href: "/reviews/requests?tab=bulk",
      icon: History,
    },
    { label: "Reviews", href: "/reviews/reviews", icon: Star },
    { label: "Review Velocity", href: "/reviews/analytics", icon: TrendingUp },
    { label: "Insights", href: "/reviews/insights", icon: Sparkles },
    { label: "Reputation Audit", href: "/reviews/audit", icon: FileSearch },
    { label: "QR Campaigns", href: "/reviews/qr-campaigns", icon: QrCode },
    { label: "Review Widget", href: "/tools/google-review-widget", icon: Star },
    { label: "Review Reply", href: "/tools/review-response-generator", icon: MessageSquareText },
    { label: "Review Sites", href: "/reviews/settings", icon: Settings2 },
    { label: "Registration", href: "/compliance", icon: Link2 },
    { label: "Alerts", href: "/reviews/alerts", icon: Bell },
    { label: "Reputation Settings", href: "/reviews/settings", icon: Settings2 },
  ];
}

export function isReviewsSectionPath(pathname: string): boolean {
  return (
    pathname.startsWith("/reviews") ||
    pathname.startsWith("/tools/google-review") ||
    pathname.startsWith("/tools/review-response")
  );
}

export function getReviewsPageTitle(pathname: string): string {
  if (pathname.startsWith("/reviews/overview")) return "Reputation Overview";
  if (pathname.startsWith("/reviews/requests")) return "Review Requests";
  if (pathname.startsWith("/reviews/campaigns")) return "Campaigns";
  if (pathname.startsWith("/reviews/templates")) return "Templates";
  if (pathname.startsWith("/reviews/automations")) return "Automations";
  if (pathname.startsWith("/reviews/contacts")) return "Contacts";
  if (pathname.startsWith("/reviews/reviews")) return "Reviews";
  if (pathname.startsWith("/reviews/analytics")) return "Review Velocity";
  if (pathname.startsWith("/reviews/insights")) return "Insights";
  if (pathname.startsWith("/reviews/audit")) return "Reputation Audit";
  if (pathname.startsWith("/reviews/qr-campaigns")) return "QR Campaigns";
  if (pathname.startsWith("/reviews/alerts")) return "Alerts";
  if (pathname.startsWith("/reviews/settings")) return "Reputation Settings";
  if (pathname.startsWith("/tools/google-review-widget")) return "Review Widget";
  if (pathname.startsWith("/tools/review-response-generator")) return "Review Reply";
  return "Reviews";
}
