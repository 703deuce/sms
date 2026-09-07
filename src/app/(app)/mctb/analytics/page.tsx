import { Suspense } from "react";
import { MctbAnalyticsView } from "@/components/mctb/analytics-view";

export default function MctbAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="mctb-page">
          <div className="mctb-page-inner">
            <div className="ref-card p-12 text-center text-sm text-muted-foreground">
              Loading analytics…
            </div>
          </div>
        </div>
      }
    >
      <MctbAnalyticsView />
    </Suspense>
  );
}
