import { flattenNavLinks, isNavGroup, type NavItem } from "@/lib/nav";
import type { KimiNavChild, KimiNavItem } from "./types";

export function mapProductionNavToKimi(items: NavItem[]): KimiNavItem[] {
  return items.map((item) => {
    const children: KimiNavChild[] = [];
    for (const child of item.children ?? []) {
      if (isNavGroup(child)) {
        for (const link of child.children) {
          children.push({ label: link.label, href: link.href });
        }
      } else {
        children.push({ label: child.label, href: child.href });
      }
    }
    return {
      label: item.label,
      href: item.href ?? "#",
      icon: item.icon,
      badge: item.badge,
      children: children.length ? children : undefined,
      sectionLabel: item.sectionLabel,
      areaLabel: item.areaLabel,
      matchExact: item.matchExact,
    };
  });
}

export function initialsForName(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
