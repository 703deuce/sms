"use client";

import type { LucideIcon } from "lucide-react";
import { OpusIconBadge } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  centered?: boolean;
};

/** Compact scheduling page header — not the large OpusSchedulingHero. */
export function SchedulingPageHeader({
  icon: Icon,
  title,
  description,
  actions,
  className,
  centered,
}: Props) {
  if (centered) {
    return (
      <header className={cn("mx-auto max-w-[820px] pt-10 text-center", className)}>
        <h1 className="text-[1.75rem] font-semibold leading-[2.125rem] tracking-tight">{title}</h1>
        {description ? (
          <p className="mx-auto mt-2 max-w-[600px] text-sm leading-[1.3125rem] text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:min-h-[5.25rem] sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <OpusIconBadge icon={Icon} className="size-11 shrink-0 rounded-xl bg-primary/12" />
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-semibold leading-[2.125rem] tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-[1.3125rem] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
