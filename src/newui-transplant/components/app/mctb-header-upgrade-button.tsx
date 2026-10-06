"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import { Button } from "@/newui-transplant/components/ui/button";

function isMctbChromePath(pathname: string): boolean {
  return (
    pathname === "/mctb" ||
    pathname.startsWith("/mctb/") ||
    pathname === "/getting-started" ||
    pathname.startsWith("/getting-started/") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/help")
  );
}

export function MctbHeaderUpgradeButton() {
  const pathname = usePathname();
  const { planUsage, planUsageLoading } = useOpusWorkspaceData();

  if (!isMctbChromePath(pathname)) return null;
  if (planUsageLoading || !planUsage) return null;
  if (planUsage.planKey !== "free") return null;

  return (
    <Button size="sm" className="hidden shrink-0 sm:inline-flex" render={<Link href="/settings/billing" />}>
      <Sparkles className="size-3.5" aria-hidden />
      Upgrade to Pro
    </Button>
  );
}
