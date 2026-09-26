import type { NavItem } from "@/lib/nav";

export type NewUiNavSection = { label: string; items: NavItem[] };

/** Groups flat production nav items by `sectionLabel` (matches newui/lib/nav.ts sections). */
export function groupNavItemsBySection(items: NavItem[]): NewUiNavSection[] {
  const sections: NewUiNavSection[] = [];
  let currentLabel = "";

  for (const item of items) {
    const label = item.sectionLabel?.trim() || currentLabel || "Navigation";
    if (!sections.length || sections[sections.length - 1].label !== label) {
      sections.push({ label, items: [item] });
      currentLabel = label;
    } else {
      sections[sections.length - 1].items.push(item);
    }
  }

  return sections;
}
