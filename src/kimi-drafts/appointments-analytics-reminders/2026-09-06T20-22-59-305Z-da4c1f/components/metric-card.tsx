"use client";

import type { LucideIcon } from "lucide-react";
import { Card, cn } from "./ui";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone: "primary" | "emerald" | "sky" | "rose" | "amber" | "violet";
}) {
  return (
    <Card className="tv-metric">
      <div>
        <p className="tv-metric-label">{label}</p>
        <p className="tv-metric-value">{value}</p>
        {hint ? <p className="tv-metric-hint">{hint}</p> : null}
      </div>
      <div className={cn("tv-metric-icon", `tv-tone-${tone}`)} aria-hidden="true">
        <Icon size={17} strokeWidth={2} />
      </div>
    </Card>
  );
}

export function MetricSkeleton() {
  return (
    <div className="tv-metrics">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="tv-metric">
          <div style={{ width: "100%" }}>
            <div className="tv-skel" style={{ height: 10, width: 72, marginBottom: 10 }} />
            <div className="tv-skel" style={{ height: 26, width: 56 }} />
          </div>
          <div className="tv-skel" style={{ width: 34, height: 34, borderRadius: 9, flex: "none" }} />
        </Card>
      ))}
    </div>
  );
}
