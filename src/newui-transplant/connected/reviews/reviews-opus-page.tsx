"use client";

import { cn } from "@/lib/utils";

/** Replaces legacy `ModulePage` for Reviews routes — Opus vertical rhythm only. */
export function ReviewsOpusPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}
