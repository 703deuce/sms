"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { calendarReturnLabel, sanitizeReturnTo } from "@/lib/navigation/return-context";

type Props = {
  returnTo: string | null;
  fallbackHref: string;
  fallbackLabel: string;
  className?: string;
};

export function ContextBackLink({ returnTo, fallbackHref, fallbackLabel, className }: Props) {
  const safe = sanitizeReturnTo(returnTo);
  const href = safe || fallbackHref;
  const label = safe ? calendarReturnLabel(safe) : fallbackLabel;
  return (
    <Link href={href} className={className || "inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--fg)]"}>
      <ChevronLeft size={14} aria-hidden />
      {label}
    </Link>
  );
}
