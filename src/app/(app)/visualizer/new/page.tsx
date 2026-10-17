import { Suspense } from "react";
import { VisualizerNewDesignPage } from "@/newui-transplant/connected/visualizer/visualizer-new-design-page";

export default function VisualizerNewPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading wizard…</p>}>
      <VisualizerNewDesignPage />
    </Suspense>
  );
}
