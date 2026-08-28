import { CircleUser, HelpCircle, Settings } from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** Shared Account footer links shown in every product shell sidebar. */
export function buildAccountNavItems(): NavItem[] {
  return [
    {
      label: "Account",
      href: "/settings/business",
      icon: CircleUser,
      sectionLabel: "Account",
    },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Help", href: "/getting-started", icon: HelpCircle },
  ];
}
