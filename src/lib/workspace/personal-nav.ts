import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  CreditCard,
  GitBranch,
  Hash,
  LayoutDashboard,
  PhoneForwarded,
  Vault,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildSmartRoutingNavChildren } from "@/lib/solutions-nav";
import { isSmartRoutingSectionPath } from "@/lib/smart-routing/display";
import { isSmartRoutingInNav } from "@/lib/workspace/platform-launch";

export type PersonalNavOptions = {
  smartRoutingFlowId?: string | null;
};

/** Compact Personal sidebar — numbers platform v1 (9 primary pages). */
export function buildPersonalNav(options?: PersonalNavOptions): NavItem[] {
  const smartRoutingFlowId = options?.smartRoutingFlowId ?? null;

  const items: NavItem[] = [
    { label: "Overview", href: "/personal", icon: LayoutDashboard },
    { label: "Number Vault", href: "/personal/vault", icon: Vault },
    { label: "Find a Number", href: "/personal/numbers/premium", icon: Hash },
    { label: "Forwarding", href: "/personal/forwarding", icon: PhoneForwarded },
    { label: "Voicemail", href: "/personal/voicemail", icon: Voicemail },
    { label: "Call Activity", href: "/personal/activity", icon: Activity },
    { label: "Analytics", href: "/personal/analytics", icon: BarChart3 },
    { label: "Porting", href: "/personal/porting", icon: ArrowRightLeft },
    { label: "Billing", href: "/settings/billing", icon: CreditCard },
  ];

  if (isSmartRoutingInNav()) {
    items.splice(6, 0, {
      label: "Smart Routing",
      href: "/smart-routing",
      icon: GitBranch,
      children: buildSmartRoutingNavChildren(smartRoutingFlowId),
    });
  }

  return items;
}

export function getPersonalPageTitle(pathname: string): string {
  if (pathname === "/personal") return "";
  if (pathname.startsWith("/personal/numbers/premium")) return "";
  if (pathname.match(/^\/personal\/numbers\/[^/]+$/)) return "Number Details";
  if (pathname === "/personal/vault") return "";
  if (pathname === "/personal/forwarding") return "";
  if (pathname === "/personal/voicemail") return "";
  if (pathname === "/personal/activity") return "";
  if (pathname === "/personal/analytics") return "";
  if (pathname === "/personal/usage") return "Usage";
  if (pathname === "/personal/porting") return "Porting";
  if (isSmartRoutingSectionPath(pathname)) {
    if (pathname === "/smart-routing/new") return "Create Flow";
    if (pathname === "/smart-routing/audio") return "Audio Library";
    return "";
  }
  return "";
}
