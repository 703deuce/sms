import { HelpCircle, Settings } from "lucide-react";
import type { NavItem } from "@/lib/nav";

/** Shared footer links shown in every product shell sidebar. */
export function buildAccountNavItems(): NavItem[] {
  return [
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      sectionLabel: "Account",
    },
    { label: "Help", href: "/help", icon: HelpCircle },
  ];
}
