"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description: string;
  examples?: string;
  statusLabel: string;
  createHref: string;
  listHref: string;
  createLabel: string;
  viewLabel: string;
  icon: LucideIcon;
  accent: "blue" | "purple" | "green" | "amber";
};

const ACCENT_RING: Record<Props["accent"], string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  purple: "bg-violet-50 text-violet-700 ring-violet-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
};

export function BookingTypesTypeCard({
  title,
  description,
  examples,
  statusLabel,
  createHref,
  listHref,
  createLabel,
  viewLabel,
  icon: Icon,
  accent,
}: Props) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-[#e8eaef] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        "transition-colors hover:border-[#d8dbe6]",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            ACCENT_RING[accent],
          )}
          aria-hidden
        >
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#1a1d29]">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6b7280]">{description}</p>
          {examples ? (
            <p className="mt-2 text-[11.5px] leading-relaxed text-[#9ca3af]">{examples}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 text-[12.5px] font-medium text-[#8a8fa3]">{statusLabel}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={createHref}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[#5b4bff] px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#4f41e6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b4bff]"
        >
          {createLabel}
        </Link>
        <Link
          href={listHref}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e4e6ee] bg-white px-3.5 text-[13px] font-medium text-[#3c4257] transition hover:bg-[#f7f8fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5b4bff]"
        >
          {viewLabel}
        </Link>
      </div>
    </article>
  );
}
