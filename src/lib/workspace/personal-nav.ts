import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  Ban,
  CreditCard,
  GitBranch,
  Hash,
  LayoutDashboard,
  Phone,
  PhoneForwarded,
  Vault,
  Voicemail,
  Gauge,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildSmartRoutingNavChildren } from "@/lib/solutions-nav";
import { isSmartRoutingSectionPath } from "@/lib/smart-routing/display";

export type PersonalNavOptions = {
  smartRoutingFlowId?: string | null;
};

/** Compact Personal sidebar — numbers platform + Smart Routing */
export function buildPersonalNav(options?: PersonalNavOptions): NavItem[] {
  const smartRoutingFlowId = options?.smartRoutingFlowId ?? null;

  return [
    { label: "Overview", href: "/personal", icon: LayoutDashboard },
    { label: "My Numbers", href: "/personal/numbers", icon: Phone },
    { label: "Find a Number", href: "/personal/numbers/premium", icon: Hash },
    { label: "Number Vault", href: "/personal/vault", icon: Vault },
    { label: "Forwarding", href: "/personal/forwarding", icon: PhoneForwarded },
    { label: "Voicemail", href: "/personal/voicemail", icon: Voicemail },
    { label: "Call Activity", href: "/personal/activity", icon: Activity },
    {
      label: "Smart Routing",
      href: "/smart-routing",
      icon: GitBranch,
      children: buildSmartRoutingNavChildren(smartRoutingFlowId),
    },
    { label: "Analytics", href: "/personal/analytics", icon: BarChart3 },
    { label: "Blocked", href: "/personal/blocked", icon: Ban },
    { label: "Usage", href: "/personal/usage", icon: Gauge },
    { label: "Porting", href: "/personal/porting", icon: ArrowRightLeft },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
  ];
}

export function getPersonalPageTitle(pathname: string): string {
  if (pathname === "/personal") return "";
  if (pathname === "/personal/numbers") return "My Numbers";
  if (pathname.startsWith("/personal/numbers/premium")) return "";
  if (pathname.match(/^\/personal\/numbers\/[^/]+$/)) return "Number Details";
  if (pathname === "/personal/vault") return "";
  if (pathname === "/personal/forwarding") return "";
  if (pathname === "/personal/voicemail") return "";
  if (pathname === "/personal/activity") return "";
  if (pathname === "/personal/analytics") return "";
  if (pathname === "/personal/blocked") return "Blocked Numbers";
  if (pathname === "/personal/usage") return "Usage";
  if (pathname === "/personal/porting") return "Porting";
  if (isSmartRoutingSectionPath(pathname)) {
    if (pathname === "/smart-routing/new") return "Create Flow";
    if (pathname === "/smart-routing/audio") return "Audio Library";
    return "";
  }
  return "";
}
