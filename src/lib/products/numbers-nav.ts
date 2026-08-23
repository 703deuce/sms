import {
  Activity,
  ArrowRightLeft,
  BarChart3,
  GitBranch,
  Hash,
  HelpCircle,
  LayoutDashboard,
  PhoneForwarded,
  Settings,
  Vault,
  Voicemail,
} from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { buildSmartRoutingNavChildren } from "@/lib/smart-routing/nav-children";
import { isPortInHiddenAtLaunch, isSmartRoutingInNav } from "@/lib/workspace/platform-launch";

export type NumbersNavOptions = {
  smartRoutingFlowId?: string | null;
};

/** Transovo Numbers — standalone product sidebar. */
export function buildNumbersNav(options?: NumbersNavOptions): NavItem[] {
  const items: NavItem[] = [
    {
      label: "Dashboard",
      href: "/personal",
      icon: LayoutDashboard,
      sectionLabel: "Numbers",
    },
    { label: "Find a Number", href: "/personal/numbers/premium", icon: Hash },
    { label: "My Numbers", href: "/personal/vault", icon: Vault },
    {
      label: "Forwarding",
      href: "/personal/forwarding",
      icon: PhoneForwarded,
      sectionLabel: "Services",
    },
    { label: "Voicemail", href: "/personal/voicemail", icon: Voicemail },
    { label: "Call Activity", href: "/personal/activity", icon: Activity },
  ];

  if (isSmartRoutingInNav()) {
    items.splice(6, 0, {
      label: "Smart Routing",
      href: "/smart-routing",
      icon: GitBranch,
      children: buildSmartRoutingNavChildren(options?.smartRoutingFlowId ?? null),
    });
  }

  items.push(
    {
      label: "Port Out",
      href: isPortInHiddenAtLaunch()
        ? "/personal/porting?tab=out"
        : "/personal/porting",
      icon: ArrowRightLeft,
      sectionLabel: "Manage",
    },
    { label: "Usage", href: "/personal/usage", icon: BarChart3 },
    {
      label: "Settings",
      href: "/settings/billing",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Help", href: "/contact", icon: HelpCircle },
  );

  return items;
}

export function getNumbersPageTitle(pathname: string): string {
  if (pathname === "/personal") return "";
  if (pathname.startsWith("/personal/numbers/premium")) return "";
  if (pathname.match(/^\/personal\/numbers\/[^/]+$/)) return "Number Details";
  if (pathname === "/personal/vault") return "";
  if (pathname === "/personal/forwarding") return "";
  if (pathname === "/personal/voicemail") return "";
  if (pathname === "/personal/activity") return "";
  if (pathname === "/personal/usage") return "Usage";
  if (pathname === "/personal/porting") return "Port Out";
  if (pathname.startsWith("/numbers")) return "Numbers";
  return "";
}

export function buildNumbersMobileNav() {
  return [
    { label: "Home", href: "/personal" },
    { label: "Vault", href: "/personal/vault" },
    { label: "Find", href: "/personal/numbers/premium" },
    { label: "Activity", href: "/personal/activity" },
  ];
}
