import type { NavItem } from "@/lib/nav";
import type { NavSection } from "@/newui-transplant/lib/nav";
import type { LucideIcon } from "lucide-react";

export type NewUiNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  matchPrefix?: string;
  matchExact?: boolean;
};

/** Production flat nav → newui NAV section shape (data boundary only). */
export function productionNavToNewUiSections(items: NavItem[]): NavSection[] {
  const sections: NavSection[] = [];
  for (const item of items) {
    const label = item.sectionLabel?.trim() || (sections.length ? sections[sections.length - 1].label : "Navigation");
    const entry: NewUiNavItem = {
      label: item.label,
      href: item.href,
      icon: item.icon,
      badge: item.badge != null ? String(item.badge) : undefined,
      matchPrefix: item.matchExact ? undefined : item.href !== "/" ? item.href : undefined,
    };
    const last = sections[sections.length - 1];
    if (!last || last.label !== label) {
      sections.push({ label, items: [entry] });
    } else {
      last.items.push(entry);
    }
  }
  return sections;
}

export function newUiBreadcrumbFromSections(
  pathname: string,
  sections: NavSection[],
  fallbackPage: string,
): { section: string; page: string } {
  for (const section of sections) {
    for (const item of section.items) {
      const match =
        item.matchPrefix
          ? pathname === item.href || pathname.startsWith(item.matchPrefix + "/") || pathname.startsWith(item.href + "/")
          : pathname === item.href || pathname.startsWith(item.href + "/");
      if (match) {
        return { section: section.label, page: item.label };
      }
    }
  }
  if (pathname.startsWith("/settings")) return { section: "Shared", page: fallbackPage || "Settings" };
  if (pathname.startsWith("/integrations")) return { section: "Shared", page: fallbackPage || "Integrations" };
  return { section: "Transovo", page: fallbackPage };
}
