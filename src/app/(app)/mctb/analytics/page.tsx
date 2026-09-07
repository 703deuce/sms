import { MctbAnalyticsView } from "@/components/mctb/analytics-view";
import { loadMctbAnalytics, type MctbAnalyticsRange } from "@/lib/mctb/analytics";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { Suspense } from "react";

function parseRange(raw: string | string[] | undefined): MctbAnalyticsRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

export default async function MctbAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspaceId } = await requireWorkspaceContext();
  const params = await searchParams;
  const range = parseRange(params.range);
  const initialData = await loadMctbAnalytics(workspaceId, range);

  return (
    <Suspense fallback={null}>
      <MctbAnalyticsView initialData={initialData} />
    </Suspense>
  );
}
