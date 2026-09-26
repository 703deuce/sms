import { MctbMissedCallsView } from "@/components/mctb/missed-calls-view";
import { loadMctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";
import { parseMissedCallsListQuery } from "@/lib/mctb/missed-calls-list-filters";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { NewUiMctbMissedCallsPage } from "@/newui-transplant/connected/mctb/missed-calls-page";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { Suspense } from "react";

export default async function MctbMissedCallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isNewUiStage2Enabled()) {
    return <NewUiMctbMissedCallsPage />;
  }

  const { workspaceId } = await requireWorkspaceContext();
  const params = await searchParams;
  const query = parseMissedCallsListQuery(new URLSearchParams(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v]) : [[key, value]],
    ) as [string, string][],
  ));
  const initialData = await loadMctbMissedCallsListData(workspaceId, query);

  return (
    <Suspense fallback={null}>
      <MctbMissedCallsView initialData={initialData} />
    </Suspense>
  );
}
