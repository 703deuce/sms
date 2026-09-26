import type { NavItem } from "@/lib/nav";

export function newUiBreadcrumbFromNav(
  pathname: string,
  navItems: NavItem[],
  fallbackPage: string,
): { section: string; page: string } {
  for (const item of navItems) {
    const match =
      item.matchExact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/");
    if (match) {
      return {
        section: item.sectionLabel?.trim() || "Transovo",
        page: item.label,
      };
    }
  }
  if (pathname.startsWith("/settings")) {
    return { section: "Shared", page: fallbackPage || "Settings" };
  }
  if (pathname.startsWith("/integrations")) {
    return { section: "Shared", page: fallbackPage || "Integrations" };
  }
  return { section: "Transovo", page: fallbackPage };
}
