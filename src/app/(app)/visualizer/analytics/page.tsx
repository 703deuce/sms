"use client";

import { useEffect, useState } from "react";
import { ArStatGrid } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";
import { OPUS_CARD } from "@/newui-transplant/components/app/opus-surfaces";

export default function VisualizerAnalyticsPage() {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch("/api/visualizer/analytics")
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics))
      .catch(() => {});
  }, []);

  const m = metrics || {};

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Visualizer analytics</h1>
      </header>
      <ArStatGrid>
        {[
          ["Projects created", m.projectsCreated],
          ["Generated designs", m.designsCreated],
          ["Designs shared", m.designsShared],
          ["Estimate requests", m.estimateRequests],
        ].map(([label, value]) => (
          <div key={label} className={OPUS_CARD + " p-4"}>
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{value ?? 0}</p>
          </div>
        ))}
      </ArStatGrid>
    </div>
  );
}
