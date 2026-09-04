import type { LucideIcon } from "lucide-react";

/** Shape from Kimi session 2026-08-30T22-24-04-122Z-b95821 mock-data.ts */
export interface KimiNavChild {
  label: string;
  href: string;
}

export interface KimiNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
  children?: KimiNavChild[];
  sectionLabel?: string;
  areaLabel?: string;
}

export interface KimiCredits {
  label: string;
  remaining: number;
  total: number;
}

export interface KimiSidebarUser {
  name: string;
  initials: string;
  plan: string;
}
