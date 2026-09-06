"use client";

import { ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("tv-card", className)}>{children}</div>;
}

export function StatusChip({
  tone,
  children,
}: {
  tone: "emerald" | "rose" | "sky" | "neutral" | "amber";
  children: ReactNode;
}) {
  return <span className={cn("tv-chip", `tv-chip-${tone}`)}>{children}</span>;
}

export const analyticsTabs = [
  { label: "Overview", section: "overview" },
  { label: "Booking", section: "booking" },
  { label: "Reminders", section: "reminders" },
  { label: "Automations", section: "automations" },
  { label: "Reports", section: "reports" },
] as const;

export type AnalyticsSection = (typeof analyticsTabs)[number]["section"];
