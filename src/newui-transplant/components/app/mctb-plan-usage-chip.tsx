"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pill } from "@/newui-transplant/components/app/kit";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import { cn } from "@/lib/utils";

function isMctbChromePath(pathname: string): boolean {
  return (
    pathname === "/mctb" ||
    pathname.startsWith("/mctb/") ||
    pathname === "/getting-started" ||
    pathname.startsWith("/getting-started/")
  );
}

export function MctbPlanUsageChip() {
  const pathname = usePathname();
  const { planUsage, planUsageLoading } = useOpusWorkspaceData();

  if (!isMctbChromePath(pathname)) return null;
  if (planUsageLoading) {
    return (
      <div
        className="hidden h-8 w-36 animate-pulse rounded-md bg-muted/70 lg:block"
        aria-hidden
      />
    );
  }
  if (!planUsage) return null;

  const tone = planUsage.atLimit ? "warning" : "neutral";

  return (
    <Link
      href="/settings/billing"
      className={cn(
        "hidden min-w-0 max-w-[14rem] shrink-0 rounded-md border bg-card px-2.5 py-1 transition hover:bg-muted/40 lg:flex lg:flex-col",
        planUsage.atLimit && "border-amber-300/80 bg-amber-50/50",
      )}
      aria-label={planUsage.usageAriaLabel}
    >
      <span className="flex items-center gap-1.5">
        <span className="truncate text-[11px] font-semibold text-foreground">{planUsage.planLabel}</span>
        <Pill tone={tone} dot={false} className="px-1.5 py-0 text-[10px]">
          {planUsage.atLimit ? "Limit reached" : "This month"}
        </Pill>
      </span>
      <span className="truncate text-[11px] tabular-nums text-muted-foreground">
        {planUsage.usageShortLabel}
      </span>
    </Link>
  );
}
