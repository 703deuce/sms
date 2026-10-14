"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

/** Compact empty region (~150–180px) for scheduling overview panels. */
export function SchedulingCompactEmpty({ icon: Icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-[9.375rem] max-h-[11.25rem] flex-col items-center justify-center px-4 py-6 text-center",
        className,
      )}
    >
      <Icon className="size-9 text-muted-foreground/80" aria-hidden />
      <p className="mt-3 text-sm font-semibold leading-5">{title}</p>
      <p className="mt-1 max-w-sm text-[0.8125rem] leading-[1.25rem] text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
