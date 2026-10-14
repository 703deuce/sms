import { cn } from "@/lib/utils";

export function scoreBarColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export function scoreTextClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function trendTextClass(positive?: boolean): string {
  return cn(positive ? "text-success" : "text-destructive");
}
