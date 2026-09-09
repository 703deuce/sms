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
  accent?: boolean;
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
  accent = false,
}: Props) {
  return (
    <article
      className={cn(
        "appt-pilot-type-card flex h-full flex-col p-5",
        accent && "appt-pilot-type-card--accent",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="appt-pilot-type-card-icon" aria-hidden>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="appt-pilot-text-section">{title}</h2>
          <p className="mt-1 appt-pilot-text-body text-[var(--text-secondary)]">{description}</p>
          {examples ? (
            <p className="mt-2 appt-pilot-text-helper">{examples}</p>
          ) : null}
        </div>
      </div>

      <p className="mt-4 appt-pilot-text-list font-medium text-[var(--text-secondary)]">{statusLabel}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
        <Link href={createHref} className="appt-pilot-primary-btn">
          {createLabel}
        </Link>
        <Link href={listHref} className="appt-pilot-outline-btn">
          {viewLabel}
        </Link>
      </div>
    </article>
  );
}
